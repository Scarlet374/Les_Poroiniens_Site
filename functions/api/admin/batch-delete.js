// functions/api/admin/batch-delete.js
export async function onRequest({ request, env }) {
  // --- Auth simple par token (comme le reste de l'admin)
  const auth = request.headers.get("Authorization") || "";
  if (auth !== `Bearer ${env.ADMIN_TOKEN}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    const body = await request.json();

    // Formats acceptés :
    //  A) { seriesSlug, chapterNumber, commentIds: [..] }
    //  B) { items: [ { seriesSlug, chapterNumber, commentIds: [..] }, ... ] }
    const items = Array.isArray(body?.items)
      ? body.items
      : [{
          seriesSlug: body?.seriesSlug,
          chapterNumber: body?.chapterNumber,
          commentIds: body?.commentIds
        }];

    const results = [];

    for (const it of items) {
      const seriesSlug = String(it?.seriesSlug || "").trim();
      const chapterKey = String(it?.chapterNumber || "").trim();
      const ids = Array.isArray(it?.commentIds) ? it.commentIds.filter(Boolean) : [];

      if (!seriesSlug || !chapterKey || ids.length === 0) {
        results.push({ seriesSlug, chapter: chapterKey, ok: false, reason: "payload invalide" });
        continue;
      }

      const cacheKey = `interactions:${seriesSlug}`;
      let data = await env.INTERACTIONS_CACHE.get(cacheKey, "json");
      if (!data || typeof data !== "object") data = {};

      const entry = data[chapterKey];
      const beforeCount = entry?.comments?.length || 0;

      if (!entry || !Array.isArray(entry.comments) || beforeCount === 0) {
        results.push({ seriesSlug, chapter: chapterKey, ok: true, deleted: 0 });
        continue;
      }

      // Filtre : on supprime les commentaires dont l'id est dans ids
      const beforeComments = entry.comments;
      const afterComments = beforeComments.filter(c => !ids.includes(c?.id));
      const deletedCount = beforeComments.length - afterComments.length;

      entry.comments = afterComments;
      data[chapterKey] = entry;

      // Ecrit la nouvelle version en cache (publication)
      await env.INTERACTIONS_CACHE.put(cacheKey, JSON.stringify(data));

      // --- Journalisation (audit) dans INTERACTIONS_LOG
      if (env.INTERACTIONS_LOG) {
        const logKey = `deleted:${seriesSlug}:${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
        const logPayload = {
          type: "delete",
          at: Date.now(),
          by: env.ADMIN_USERNAME || "admin",
          ip: request.headers.get("CF-Connecting-IP") || null,
          userAgent: request.headers.get("User-Agent") || null,
          seriesSlug,
          chapterNumber: chapterKey,
          deletedIds: ids,
          beforeCount,
          afterCount: afterComments.length
        };
        // Conserve 1 an (ajuste à ton goût)
        await env.INTERACTIONS_LOG.put(logKey, JSON.stringify(logPayload), {
          expirationTtl: 60 * 60 * 24 * 365
        });
      }

      results.push({ seriesSlug, chapter: chapterKey, ok: true, deleted: deletedCount });
    }

    return new Response(JSON.stringify({ ok: true, results }), { headers });
  } catch (e) {
    console.error("[admin/batch-delete] error:", e);
    return new Response(JSON.stringify({ ok: false, error: "Server error" }), {
      status: 500,
      headers
    });
  }
}