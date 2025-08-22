// functions/api/admin/login.js

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST") {
    return new Response("Méthode non autorisée", { status: 405 });
  }

  try {
    const { username, password } = await request.json();

    // Récupérer les secrets depuis l'environnement
    const ADMIN_USERNAME = env.ADMIN_USERNAME;
    const ADMIN_PASSWORD = env.ADMIN_PASSWORD;

    if (!ADMIN_USERNAME || !ADMIN_PASSWORD || !env.ADMIN_TOKEN) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Secrets non configurés sur le serveur.",
        }),
        { status: 500 }
      );
    }

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      const token = env.ADMIN_TOKEN;
      return new Response(JSON.stringify({ success: true, token: token }), {
        status: 200,
      });
    } else {
      return new Response(
        JSON.stringify({ success: false, message: "Identifiants incorrects." }),
        { status: 401 }
      );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, message: "Erreur interne." }),
      { status: 500 }
    );
  }
}
