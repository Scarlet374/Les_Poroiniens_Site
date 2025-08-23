// functions/api/log-action.js

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST") {
    return new Response("Méthode non autorisée", { status: 405 });
  }

  try {
    const payload = await request.json();
    const { seriesSlug, actions } = payload;

    if (!seriesSlug || !Array.isArray(actions) || actions.length === 0) {
      return new Response(JSON.stringify({ error: "Données invalides." }), {
        status: 400,
      });
    }

    // NOUVELLE LOGIQUE : Créer une clé unique pour chaque envoi de log
    // Cela évite les race conditions.
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const logKey = `log:${seriesSlug}:${uniqueId}`;

    // On écrit directement les actions dans cette nouvelle clé unique, sans lire au préalable.
    await env.INTERACTIONS_LOG.put(logKey, JSON.stringify(actions));

    return new Response(
      JSON.stringify({ success: true, logged: actions.length }),
      { status: 200 }
    );
  } catch (error) {
    console.error("[API log-action] Erreur:", error);
    return new Response(
      JSON.stringify({ error: "Erreur interne du serveur." }),
      { status: 500 }
    );
  }
}