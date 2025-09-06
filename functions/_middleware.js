// functions/_middleware.js
import { slugToFile } from "./_slugmap.js";

function slugify(text) {
  if (!text) return "";
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[\s\u3000]+/g, "_")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "_");
}

function generateMetaTags(meta) {
  const title = meta.title || "Les Poroïniens";
  const description =
    meta.description ||
    "Retrouvez toutes les sorties des Poroïniens en un seul et unique endroit !";
  const imageUrl = meta.image || new URL("/img/banner.jpg", meta.url).toString();
  const url = meta.url || "https://lesporoiniens.org";

  return `
    <title>${title}</title>
    <meta name="description" content="${description}">
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:url" content="${url}" />
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${imageUrl}">
  `;
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const originalPathname = url.pathname;

  // Normalisation basique
  let pathname =
    originalPathname.endsWith("/") && originalPathname.length > 1
      ? originalPathname.slice(0, -1)
      : originalPathname;
  if (pathname.endsWith(".html")) pathname = pathname.slice(0, -5);
  if (pathname === "/index") pathname = "/";

  // --- Pages spéciales (ex: galerie) ---
  if (pathname.startsWith("/galerie")) {
    const metaData = {
      title: "Galerie - Les Poroïniens",
      description: "Découvrez toutes les colorisations et fan-arts de la communauté !",
      htmlFile: "/galerie.html",
    };
    const assetUrl = new URL(metaData.htmlFile, url.origin);
    const response = await env.ASSETS.fetch(assetUrl);
    let html = await response.text();
    const tags = generateMetaTags({ ...metaData, url: url.href });
    html = html.replace("<!-- DYNAMIC_OG_TAGS_PLACEHOLDER -->", tags);
    return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
  }

  // --- Pages statiques ---
  const staticPageMeta = {
    "/": {
      title: "Accueil - Les Poroïniens",
      description:
        "Retrouvez toutes les sorties des Poroïniens en un seul et unique endroit !",
      htmlFile: "/index.html",
      image: "/img/banner.jpg",
    },
    "/presentation": {
      title: "Questions & Réponses - Les Poroïniens",
      description:
        "Les réponses des Poroïniens à vos questions sur son parcours dans le scantrad.",
      htmlFile: "/presentation.html",
    },
  };
  if (staticPageMeta[pathname]) {
    const metaData = staticPageMeta[pathname];
    const assetUrl = new URL(metaData.htmlFile, url.origin);
    const response = await env.ASSETS.fetch(assetUrl);
    let html = await response.text();
    const tags = generateMetaTags({ ...metaData, url: url.href });
    html = html.replace("<!-- DYNAMIC_OG_TAGS_PLACEHOLDER -->", tags);
    return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
  }

  // --- Laisse passer les assets ---
  const knownPrefixes = ["/css/", "/js/", "/img/", "/data/", "/includes/", "/functions/", "/api/", "/fonts/", "/ln/"];
  if (knownPrefixes.some((prefix) => originalPathname.startsWith(prefix))) {
    return next();
  }

  // --- Routage dynamique séries / lecteur ---
  try {
    const segments = originalPathname.split("/").filter(Boolean);
    if (segments.length === 0) return next(); // racine déjà gérée

    const seriesSlug = segments[0];

    // 1) Trouver le fichier via le slug map (aucun scan, 0 fetch supplémentaire)
    const matchFilename =
      slugToFile[seriesSlug] ||
      slugToFile[seriesSlug.replace(/-/g, "_")] ||
      slugToFile[seriesSlug.replace(/_/g, "-")];

    // 2) Charger UNIQUEMENT cette série si on a un match
    let seriesData = null;
    let ogImageUrl = new URL("/img/banner.jpg", url.origin).toString(); // défaut générique
    if (matchFilename) {
      const jsonUrl = new URL(`/data/series/${matchFilename}`, url.origin);
      const resp = await env.ASSETS.fetch(jsonUrl);
      if (resp.ok) {
        seriesData = await resp.json();
        const ogImageFilename = matchFilename.replace(".json", ".png");
        ogImageUrl = new URL(`/img/banner/${ogImageFilename}`, url.origin).toString();
      }
    }

    // 3) Routes
    const isChapterRoute =
      (segments.length === 2 || segments.length === 3) && !isNaN(parseFloat(segments[1]));
    const isEpisodes = segments.length > 1 && segments[1] === "episodes";
    const isCover = segments.length > 1 && segments[1] === "cover";

    // --- LECTEUR (/slug/123[/x]) ---
    if (isChapterRoute) {
      const chapterNumber = segments[1];
      const assetUrl = new URL("/reader.html", url.origin);
      let html = await env.ASSETS.fetch(assetUrl).then((res) => res.text());

      if (seriesData?.chapters && seriesData.chapters[chapterNumber]) {
        const metaData = {
          title: `${seriesData.title} - Chapitre ${chapterNumber} | Les Poroïniens`,
          description: `Lisez le chapitre ${chapterNumber} de ${seriesData.title}. ${seriesData.description || ""}`,
          image: ogImageUrl,
        };
        const tags = generateMetaTags({ ...metaData, url: url.href });
        html = html
          .replace("<!-- DYNAMIC_OG_TAGS_PLACEHOLDER -->", tags)
          .replace("<!-- READER_DATA_PLACEHOLDER -->", JSON.stringify({ series: seriesData, chapterNumber }));
      } else {
        // fallback : pas d'injection, le front fera le fetch client → pas de boucle
        const tags = generateMetaTags({
          title: "Lecture - Les Poroïniens",
          description: "",
          image: ogImageUrl,
          url: url.href,
        });
        html = html
          .replace("<!-- DYNAMIC_OG_TAGS_PLACEHOLDER -->", tags)
          .replace("<!-- READER_DATA_PLACEHOLDER -->", "READER_DATA_PLACEHOLDER");
      }

      return new Response(html, { headers: { "Content-Type": "text/html; charset=UTF-8" } });
    }

    // --- ÉPISODES (/slug/episodes[/<n>]) ---
    if (isEpisodes) {
      const animeInfo = seriesData?.anime && seriesData.anime[0] ? seriesData.anime[0] : null;
      const metaData =
        segments.length === 3
          ? {
              title: `Épisode ${segments[2]} de ${seriesData?.title || ""} - Les Poroïniens`,
              description: `Regardez l'épisode ${segments[2]} de l'anime ${seriesData?.title || ""}.`,
              image: animeInfo?.cover_an || ogImageUrl,
            }
          : {
              title: `Épisodes de ${seriesData?.title || ""} - Les Poroïniens`,
              description: `Liste de tous les épisodes de l'anime ${seriesData?.title || ""}.`,
              image: animeInfo?.cover_an || ogImageUrl,
            };

      const assetUrl = new URL("/series-detail.html", url.origin);
      let html = await env.ASSETS.fetch(assetUrl).then((res) => res.text());

      const tags = generateMetaTags({ ...metaData, url: url.href });
      html = html.replace("<!-- DYNAMIC_OG_TAGS_PLACEHOLDER -->", tags);

      // injection si on a les données; sinon placeholder (fallback client côté front)
      html = html.replace(
        "<!-- SERIES_DATA_PLACEHOLDER -->",
        seriesData ? JSON.stringify(seriesData) : "SERIES_DATA_PLACEHOLDER"
      );

      return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
    }

    // --- GALERIE DE COUVERTURES (/slug/cover) ---
    if (isCover) {
      const metaData = {
        title: `Couvertures de ${seriesData?.title || ""} - Les Poroïniens`,
        description: `Découvrez toutes les couvertures de la série ${seriesData?.title || ""} !`,
        image: ogImageUrl,
      };
      const assetUrl = new URL("/series-covers.html", url.origin);
      let html = await env.ASSETS.fetch(assetUrl).then((res) => res.text());
      const tags = generateMetaTags({ ...metaData, url: url.href });
      html = html.replace("<!-- DYNAMIC_OG_TAGS_PLACEHOLDER -->", tags);
      return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
    }

    // --- PAGE DÉTAIL (/slug) ---
    if (segments.length === 1) {
      const metaData = {
        title: `${seriesData?.title || ""} - Les Poroïniens`,
        description: seriesData?.description || "",
        image: ogImageUrl,
      };
      const assetUrl = new URL("/series-detail.html", url.origin);
      let html = await env.ASSETS.fetch(assetUrl).then((res) => res.text());
      const tags = generateMetaTags({ ...metaData, url: url.href });
      html = html.replace("<!-- DYNAMIC_OG_TAGS_PLACEHOLDER -->", tags);

      // injection si on a trouvé la série, sinon placeholder (fallback front)
      html = html.replace(
        "<!-- SERIES_DATA_PLACEHOLDER -->",
        seriesData ? JSON.stringify(seriesData) : "SERIES_DATA_PLACEHOLDER"
      );

      return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
    }
  } catch (error) {
    console.error(`Error during dynamic routing for "${originalPathname}":`, error);
  }

  // Pas concerné → main HTML / 404 CF Pages
  return next();
}