// functions/api/process-log.js

// La fonction peut maintenant être déclenchée par un cron OU par une requête GET/POST manuelle
export async function onRequest(context) {
  const { env } = context;
  console.log(
    "CRON/MANUAL: Démarrage du traitement des logs d'interactions..."
  );

  try {
    const list = await env.INTERACTIONS_LOG.list({ prefix: "log:" });
    if (list.keys.length === 0) {
      console.log("CRON/MANUAL: Aucun log à traiter. Terminé.");
      return new Response("Aucun log à traiter.", { status: 200 });
    }

    const logsBySeries = {};
    for (const key of list.keys) {
      const parts = key.name.split(":");
      if (parts.length >= 2) {
        const seriesSlug = parts[1];
        if (!logsBySeries[seriesSlug]) {
          logsBySeries[seriesSlug] = [];
        }
        logsBySeries[seriesSlug].push(key.name);
      }
    }

    let totalActionsProcessed = 0;

    for (const seriesSlug in logsBySeries) {
      const cacheKey = `interactions:${seriesSlug}`;
      let seriesInteractions =
        (await env.INTERACTIONS_CACHE.get(cacheKey, "json")) || {};

      for (const logKey of logsBySeries[seriesSlug]) {
        const logActionsText = await env.INTERACTIONS_LOG.get(logKey);
        if (logActionsText) {
          const logActions = JSON.parse(logActionsText);

          for (const action of logActions) {
            const { chapter, type, payload } = action;

            // ↓↓↓ LA MODIFICATION EST ICI ↓↓↓
            // On vérifie si l'identifiant est pour un épisode (commence par "ep-")
            const isEpisode = String(chapter).startsWith("ep-");

            // Initialiser l'objet si nécessaire, avec la bonne structure
            if (!seriesInteractions[chapter]) {
              if (isEpisode) {
                seriesInteractions[chapter] = { likes: 0 }; // Pas de commentaires pour les épisodes
              } else {
                seriesInteractions[chapter] = { likes: 0, comments: [] };
              }
            }

            // Appliquer les actions
            if (type === "like") {
              seriesInteractions[chapter].likes =
                (seriesInteractions[chapter].likes || 0) + 1;
            } else if (type === "unlike") {
              seriesInteractions[chapter].likes = Math.max(
                0,
                (seriesInteractions[chapter].likes || 0) - 1
              );
            }

            // Les actions de commentaires ne seront traitées que si ce n'est pas un épisode
            else if (!isEpisode) {
              if (type === "add_comment") {
                if (
                  !seriesInteractions[chapter].comments.some(
                    (c) => c.id === payload.id
                  )
                ) {
                  seriesInteractions[chapter].comments.push(payload);
                }
              } else if (type === "like_comment") {
                const comment = seriesInteractions[chapter].comments.find(
                  (c) => c.id === payload.commentId
                );
                if (comment) {
                  comment.likes = (comment.likes || 0) + 1;
                }
              } else if (type === "unlike_comment") {
                const comment = seriesInteractions[chapter].comments.find(
                  (c) => c.id === payload.commentId
                );
                if (comment) {
                  comment.likes = Math.max(0, (comment.likes || 0) - 1);
                }
              }
            }
            // ↑↑↑ FIN DE LA MODIFICATION ↑↑↑
          }
          totalActionsProcessed += logActions.length;
        }
        await env.INTERACTIONS_LOG.delete(logKey);
      }

      await env.INTERACTIONS_CACHE.put(
        cacheKey,
        JSON.stringify(seriesInteractions)
      );
      console.log(
        `CRON/MANUAL: Traité ${logsBySeries[seriesSlug].length} fichiers de log pour la série "${seriesSlug}".`
      );
    }

    console.log(
      `CRON/MANUAL: Traitement terminé. ${totalActionsProcessed} actions au total.`
    );
    return new Response(
      `Traitement terminé. ${totalActionsProcessed} actions traitées.`,
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "CRON/MANUAL: Erreur critique lors du traitement des logs:",
      error
    );
    return new Response("Erreur lors du traitement.", { status: 500 });
  }
}