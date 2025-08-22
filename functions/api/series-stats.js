// functions/api/series-stats.js

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const seriesSlug = url.searchParams.get("slug");

    const headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=60, s-maxage=60" // Cache court
    };

    if (!seriesSlug) {
        return new Response(JSON.stringify({ error: "Le paramètre 'slug' est manquant." }), { status: 400, headers });
    }

    try {
        const cacheKey = `interactions:${seriesSlug}`;
        const cachedData = await env.INTERACTIONS_CACHE.get(cacheKey, 'json');

        if (cachedData) {
            return new Response(JSON.stringify(cachedData), { headers });
        } else {
            // Si aucune donnée n'existe, retourner un objet vide
            return new Response(JSON.stringify({}), { headers });
        }
    } catch (error) {
        console.error(`[API series-stats] Erreur pour le slug '${seriesSlug}':`, error);
        return new Response(JSON.stringify({ error: "Impossible de récupérer les statistiques de la série." }), { status: 500, headers });
    }
}