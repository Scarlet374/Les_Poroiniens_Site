export async function onRequest(context) {
  const { env } = context;

  // 🔧 1) lis le username depuis l'env (à créer dans Pages → Settings → Environment variables)
  const username = env.IMG_CHEST_USERNAME || "votre_username_imgchest";
  // 🔧 2) mets le username dans la clé de cache pour éviter tout mélange
  const cacheKey = `imgchest_all_pages_${username}`;
  const maxPages = 8;

  console.log(`[IMG_CHEST] Incoming request → Checking KV key "${cacheKey}"`);

  // 1. KV GET
  try {
    const cached = await env.IMG_CHEST_CACHE.get(cacheKey);
    if (cached) {
      console.log(`[IMG_CHEST] Cache HIT → key "${cacheKey}"`);
      return new Response(cached, {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "X-Cache": "HIT",
        },
      });
    }
  } catch (err) {
    console.error(`[IMG_CHEST] KV GET ERROR for key "${cacheKey}":`, err);
  }

  // 2. Fetch des pages ImgChest
  let allPosts = [];
  for (let page = 1; page <= maxPages; page++) {
    const apiUrl = `https://imgchest.com/api/posts?username=${encodeURIComponent(username)}&sort=new&page=${page}&status=0`;
    console.log(`[IMG_CHEST] Fetching ImgChest page ${page} → ${apiUrl}`);

    try {
      const res = await fetch(apiUrl, {
        headers: {
          // 🔧 3) User-Agent : mets ton site/domaine
          "User-Agent": "LesPoroïniens/1.0 (+https://ton-domaine.tld)",
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        console.warn(`[IMG_CHEST] Failed fetch (HTTP ${res.status}) → stopping`);
        break;
      }

      const json = await res.json();
      if (!json.data || json.data.length === 0) {
        console.log(`[IMG_CHEST] No more data on page ${page}, stopping.`);
        break;
      }

      const simplified = json.data.map((post) => ({
        id: post.slug || post.id,
        views: post.views,
        title: post.title,
        nsfw: post.nsfw,
      }));

      allPosts.push(...simplified);

      if (json.data.length < 24) {
        console.log(`[IMG_CHEST] Page ${page} had less than 24 posts → end of data.`);
        break;
      }
    } catch (err) {
      console.error(`[IMG_CHEST] ERROR fetching page ${page}:`, err);
      break;
    }
  }

  const payload = JSON.stringify({ posts: allPosts });
  console.log(`[IMG_CHEST] Finished fetching ${allPosts.length} posts.`);

  // 3. KV PUT
  try {
    await env.IMG_CHEST_CACHE.put(cacheKey, payload, { expirationTtl: 3600 });
    console.log(`[IMG_CHEST] KV PUT SUCCESS → Key "${cacheKey}" stored for 1h`);
  } catch (e) {
    console.error(`[IMG_CHEST] KV PUT ERROR → Could not store key "${cacheKey}":`, e);
  }

  return new Response(payload, {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "X-Cache": "MISS",
    },
  });
}