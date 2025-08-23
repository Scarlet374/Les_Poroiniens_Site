// functions/api/imgchest-chapter-pages.js
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const metaOnly = url.searchParams.get("meta") === "1";

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "X-Cache": "MISS",
  };

  if (!id) {
    return new Response(JSON.stringify({ error: "Le paramètre 'id' est manquant." }), {
      status: 400, headers
    });
  }

  const baseKey = `imgchest_chapter_${id}`;
  const metaKey = `imgchest_chapter_meta_${id}`;

  // --- KV HIT ?
  try {
    if (metaOnly) {
      const cachedMeta = await env.IMG_CHEST_CACHE.get(metaKey);
      if (cachedMeta) {
        headers["X-Cache"] = "HIT";
        return new Response(cachedMeta, { headers });
      }
    } else {
      const cached = await env.IMG_CHEST_CACHE.get(baseKey);
      if (cached) {
        headers["X-Cache"] = "HIT";
        return new Response(cached, { headers });
      }
    }
  } catch (_) { /* noop */ }

  try {
    // Fetch la page publique ImgChest
    const res = await fetch(`https://imgchest.com/p/${id}`, {
      headers: {
        "User-Agent": "LesPoroiniens-PageFetcher/1.2", // ASCII
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    // Extrait le JSON dans <div id="app" data-page="..."></div>
    const m = html.match(/<div id="app" data-page="([^"]+)"><\/div>/);
    if (!m || !m[1]) throw new Error("Markup ImgChest non reconnu");

    const page = JSON.parse(m[1].replaceAll("&quot;", '"'));
    const post = page?.props?.post || {};
    const files = Array.isArray(post.files) ? post.files : [];
    const views =
      typeof post.views === "number" ? post.views
      : (post.stats && typeof post.stats.views === "number" ? post.stats.views : null);

    if (metaOnly) {
      const payload = JSON.stringify({ id, views });
      // on peut mettre un TTL plus court si tu veux ; 7 jours c’est déjà bien
      await env.IMG_CHEST_CACHE.put(metaKey, payload, { expirationTtl: 60 * 60 * 24 * 7 });
      return new Response(payload, { headers });
    } else {
      const payload = JSON.stringify(files);
      // cache long pour les fichiers (30 jours)
      await env.IMG_CHEST_CACHE.put(baseKey, payload, { expirationTtl: 60 * 60 * 24 * 30 });
      return new Response(payload, { headers });
    }
  } catch (error) {
    const errorResponse = {
      error: "Impossible de récupérer les données du chapitre.",
      details: String(error?.message || error),
    };
    return new Response(JSON.stringify(errorResponse), { status: 500, headers });
  }
}