export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "X-Cache": "MISS",
  };

  if (!id) {
    return new Response(JSON.stringify({ error: "Le paramètre 'id' est manquant." }), {
      status: 400,
      headers,
    });
  }

  const cacheKey = `imgchest_chapter_${id}`;

  try {
    // 1) KV GET
    const cachedData = await env.IMG_CHEST_CACHE.get(cacheKey);
    if (cachedData) {
      console.log(`[IMG_CHEST_CHAPTER] Cache HIT → key "${cacheKey}"`);
      headers["X-Cache"] = "HIT";
      return new Response(cachedData, { headers });
    }
    console.log(`[IMG_CHEST_CHAPTER] Cache MISS → key "${cacheKey}"`);

    // 2) fetch page ImgChest
    const res = await fetch(`https://imgchest.com/p/${id}`, {
      headers: {
        // 🔧 Mets ton UA
        "User-Agent": "LesPoroïniens/1.0 (+https://https://lesporoiniens.org)",
      },
    });
    if (!res.ok) {
      throw new Error(`Erreur HTTP ${res.status} lors de la récupération de la page ImgChest.`);
    }
    const responseText = await res.text();

    // 3) extraire le JSON de la page
    const match = responseText.match(/<div id="app" data-page="([^"]+)"><\/div>/);
    if (!match || !match[1]) {
      throw new Error("Impossible de trouver les données de la page dans la réponse d'ImgChest.");
    }

    const jsonDataString = match[1].replaceAll("&quot;", '"');
    const pageData = JSON.parse(jsonDataString);
    const files = pageData?.props?.post?.files;

    if (!files || !Array.isArray(files)) {
      throw new Error("Le format des données d'ImgChest a changé, la liste des fichiers est introuvable.");
    }

    const payload = JSON.stringify(files);

    // 4) KV PUT (30 jours)
    await env.IMG_CHEST_CACHE.put(cacheKey, payload, { expirationTtl: 2592000 });
    console.log(`[IMG_CHEST_CHAPTER] KV PUT SUCCESS → Key "${cacheKey}" stored for 30 days`);

    return new Response(payload, { headers });
  } catch (error) {
    console.error(`[IMG_CHEST_CHAPTER] Erreur pour l'ID '${id}':`, error.message);
    const errorResponse = {
      error: "Impossible de récupérer les données du chapitre.",
      details: error.message,
    };
    return new Response(JSON.stringify(errorResponse), { status: 500, headers });
  }
}