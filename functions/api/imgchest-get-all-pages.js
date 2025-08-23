export async function onRequest(context) {
  const { env } = context;
  const cacheKey = `imgchest_all_pages_combined`;
  const username = "Big_herooooo";
  const maxPages = 8;

  console.log(`[IMG_CHEST] Incoming request → Checking KV key "${cacheKey}"`);

  // 🔍 1. Tenter de lire depuis le cache KV
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
    } else {
      console.log(`[IMG_CHEST] Cache MISS → No value for key "${cacheKey}"`);
    }
  } catch (err) {
    console.error(`[IMG_CHEST] KV GET ERROR for key "${cacheKey}":`, err);
  }

  // 🛠 2. Si non trouvé, on va chercher les pages et les agréger
  let allPosts = [];

  for (let page = 1; page <= maxPages; page++) {
    const apiUrl = `https://imgchest.com/api/posts?username=${username}&sort=new&page=${page}&status=0`;
    console.log(`[IMG_CHEST] Fetching ImgChest page ${page} → ${apiUrl}`);

    try {
      const res = await fetch(apiUrl, {
        headers: {
          "User-Agent": "LesPoroïniensSite-PageFetcher/1.2",
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        console.warn(
          `[IMG_CHEST] Failed fetch (HTTP ${res.status}) → stopping`
        );
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
        console.log(
          `[IMG_CHEST] Page ${page} had less than 24 posts → end of data.`
        );
        break;
      }
    } catch (err) {
      console.error(`[IMG_CHEST] ERROR fetching page ${page}:`, err);
      break;
    }
  }

  const payload = JSON.stringify({ posts: allPosts });
  console.log(`[IMG_CHEST] Finished fetching ${allPosts.length} posts.`);

  // 3. Stocker dans Cloudflare KV
  try {
    await env.IMG_CHEST_CACHE.put(cacheKey, payload, { expirationTtl: 3600 });
    console.log(`[IMG_CHEST] KV PUT SUCCESS → Key "${cacheKey}" stored for 1h`);
  } catch (e) {
    console.error(
      `[IMG_CHEST] KV PUT ERROR → Could not store key "${cacheKey}":`,
      e
    );
  }

  return new Response(payload, {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "X-Cache": "MISS",
    },
  });
}