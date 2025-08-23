export async function onRequest({ env, request }) {
  const raw = env.IMG_CHEST_USERNAME || "LesPoroïniens";

  // Variantes candidates (on garde l'original + versions "déaccentuées")
  const ascii = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const candidates = Array.from(new Set([
    raw, ascii, raw.toLowerCase(), ascii.toLowerCase(),
  ]));

  const H = {
    Accept: "application/json",
    // UA ASCII (certains proxies refusent les headers non-ASCII)
    "User-Agent": "LesPoroiniens-Fetch/1.0 (+https://lesporoiniens.org)"
  };

  let chosen = null;
  let firstOk = null;
  let lastDebug = { candidate: null, status: null, body: null, url: null };

  // 1) Teste la page 1 avec chaque variante
  for (const name of candidates) {
    const url = `https://imgchest.com/api/posts?username=${encodeURIComponent(name)}&sort=new&page=1&status=0`;
    try {
      const res = await fetch(url, { headers: H });
      const text = await res.text(); // on prend le brut pour debug
      lastDebug = {
        candidate: name,
        status: res.status,
        url,
        body: text.slice(0, 200) // 200 premiers chars pour inspection
      };

      if (!res.ok) continue;

      let json;
      try { json = JSON.parse(text); } catch { continue; }

      if (Array.isArray(json?.data) && json.data.length > 0) {
        chosen = name;
        firstOk = json;
        break;
      }
    } catch (e) {
      lastDebug = { candidate: name, status: "fetch_error", url, body: String(e).slice(0,200) };
    }
  }

  // 2) Si rien n'a marché → renvoyer le debug
  if (!chosen) {
    return new Response(JSON.stringify({ posts: [], debug: {
      tested: candidates, last: lastDebug
    }}), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "X-User-Selected": "none",
        "X-Cache": "MISS"
      },
      status: 200
    });
  }

  // 3) Essaie de servir depuis KV (clé dépendante de la variante qui marche)
  const cacheKey = `imgchest_all_pages_${chosen}`;
  try {
    const cached = await env.IMG_CHEST_CACHE.get(cacheKey);
    if (cached) {
      return new Response(cached, {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "X-User-Selected": chosen,
          "X-Cache": "HIT"
        }
      });
    }
  } catch {}

  // 4) Agrégation
  const simplify = (json) => (json?.data || []).map(p => ({
    id: p.slug || p.id,
    views: p.views,
    title: p.title,
    nsfw: p.nsfw
  }));

  let allPosts = simplify(firstOk);
  const maxPages = 8;

  for (let page = 2; page <= maxPages; page++) {
    const url = `https://imgchest.com/api/posts?username=${encodeURIComponent(chosen)}&sort=new&page=${page}&status=0`;
    try {
      const res = await fetch(url, { headers: H });
      if (!res.ok) break;
      const j = await res.json();
      const items = simplify(j);
      if (!items.length) break;
      allPosts.push(...items);
      if (!j.data || j.data.length < 24) break; // fin de pagination
    } catch { break; }
  }

  const payload = JSON.stringify({ posts: allPosts });

  // 5) Cache 1h uniquement si on a des résultats
  if (allPosts.length) {
    try { await env.IMG_CHEST_CACHE.put(cacheKey, payload, { expirationTtl: 3600 }); } catch {}
  }

  return new Response(payload, {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "X-User-Selected": chosen,
      "X-Cache": "MISS"
    }
  });
}
