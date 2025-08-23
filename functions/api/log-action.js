// functions/api/log-action.js
export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST") {
    return new Response("Méthode non autorisée", { status: 405 });
  }

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    const body = await request.json();

    // 1) Normalise les actions (tolère plusieurs formes de payload)
    let actions = [];
    if (Array.isArray(body?.actions)) actions = body.actions;
    else if (Array.isArray(body)) actions = body;
    else if (body?.action) actions = [body.action];

    if (!actions.length) {
      return new Response(JSON.stringify({ error: "Données invalides (actions manquantes)." }), {
        status: 400, headers
      });
    }

    // 2) Regroupe par seriesSlug (top-level ou dans chaque action)
    const groups = new Map(); // slug -> [actions]
    for (const a of actions) {
      const slug = String(body?.seriesSlug || a?.seriesSlug || a?.slug || "").trim();
      if (!slug) continue;
      if (!groups.has(slug)) groups.set(slug, []);
      groups.get(slug).push(a);
    }

    if (groups.size === 0) {
      return new Response(JSON.stringify({ error: "seriesSlug manquant." }), {
        status: 400, headers
      });
    }

    // 3) Pour chaque série, applique les actions dans INTERACTIONS_CACHE
    for (const [seriesSlug, group] of groups) {
      const cacheKey = `interactions:${seriesSlug}`;
      let data = await env.INTERACTIONS_CACHE.get(cacheKey, "json");
      if (!data || typeof data !== "object") data = {};

      for (const a of group) {
        const chap = String(a.chapter ?? a.chapterNumber ?? "").trim();
        if (!chap) continue;
        if (!data[chap]) data[chap] = { likes: 0, comments: [] };
        const entry = data[chap];

        if (a.type === "comment" && a.comment) {
          const c = a.comment;
          if (c?.id) {
            const i = entry.comments.findIndex(x => x.id === c.id);
            if (i >= 0) entry.comments[i] = c; else entry.comments.push(c);
          } else {
            entry.comments.push(c);
          }
        } else if (a.type === "like") {
          let delta = 0;
          if (typeof a.delta === "number") delta = a.delta;
          else if ("liked" in a) delta = a.liked ? 1 : -1;
          else delta = 1;
          entry.likes = Math.max(0, (entry.likes || 0) + delta);
        }
      }

      await env.INTERACTIONS_CACHE.put(cacheKey, JSON.stringify(data));
    }

    // 4) Journal brut (optionnel) pour audit
    if (env.INTERACTIONS_LOG) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await env.INTERACTIONS_LOG.put(
        `log:batch:${id}`,
        JSON.stringify({ at: Date.now(), actions }),
        { expirationTtl: 60 * 60 * 24 * 30 }
      );
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch (err) {
    console.error("[API log-action] Erreur:", err);
    return new Response(JSON.stringify({ error: "Erreur interne du serveur." }), {
      status: 500, headers
    });
  }
}