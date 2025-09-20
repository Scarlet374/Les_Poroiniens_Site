// js/utils/fetchUtils.js
import { slugify } from './domUtils.js'; // Assurez-vous que slugify est bien importé

let CONFIG_CACHE = null;

/**
 * Fonction de fetch générique avec gestion des erreurs.
 * @param {string} url - L'URL à fetch.
 * @param {object} [options={}] - Options pour fetch.
 * @returns {Promise<any>} Les données JSON parsées ou le texte brut en cas d'erreur de parsing JSON.
 */
export async function fetchData(url, options = {}) {
  const fetchOptions = { method: 'GET', ...options };
  
  try {
    const response = await fetch(url, fetchOptions);
    if (!response.ok) {
      let errorBody = "No error body.";
      try {
        errorBody = await response.text();
      } catch (textError) {
        console.warn("Could not read error response body as text.", textError);
      }
      throw new Error(`HTTP error! status: ${response.status} for ${url}. Body: ${errorBody.substring(0, 200)}`);
    }

    const responseText = await response.text();
    try {
      return JSON.parse(responseText);
    } catch (jsonError) {
      console.warn(`Response from ${url} was not valid JSON. Content: "${responseText.substring(0, 100)}..."`, jsonError);
      throw new Error(`Failed to parse JSON from ${url}. Content: ${responseText.substring(0, 100)}`);
    }

  } catch (error) {
    console.error(`Could not fetch or process data from ${url}:`, error);
    throw error;
  }
}

/**
 * Charge la configuration globale du site (config.json).
 * @returns {Promise<object>} La configuration.
 */
export async function loadGlobalConfig() {
  if (CONFIG_CACHE) {
    return CONFIG_CACHE;
  }
  const localConfigPath = '/data/config.json';
  try {
    const config = await fetchData(localConfigPath);
    CONFIG_CACHE = config;
    return CONFIG_CACHE;
  } catch (error) {
    console.error(`FATAL: Failed to load global configuration from ${localConfigPath}. Error:`, error);
    CONFIG_CACHE = { ENV: "ERROR_FALLBACK" };
    throw new Error(`Critical: Could not load global configuration from ${localConfigPath}.`);
  }
}

// --- Détection + normalisation "anime présent" ---------------------------
function hasAnime(meta) {
  if (!meta || typeof meta !== "object") return false;
  if (Array.isArray(meta.episodes) && meta.episodes.length) return true;       // tes épisodes à plat
  if (meta.media?.anime?.entries?.length) return true;                         // futur schéma v2
  return false;
}

function normalizeAnime(meta, filename) {
  if (!hasAnime(meta)) return null;

  // Source "anime" v1 (tes *_an) si présente, sinon info de base
  const entry = meta.media?.anime?.entries?.[0] || meta.anime?.[0] || null;

  const cover     = entry?.cover || entry?.cover_an || meta.cover_an || meta.cover || "/img/placeholder_preview.png";
  const type      = entry?.type  || entry?.type_an  || "";
  const status    = entry?.status|| entry?.status_an|| "";
  const studios   = entry?.studios || entry?.studios_an || [];
  const dateStart = entry?.date_start || entry?.date_start_an || meta.date_start || "";

  const tags        = entry?.tags || meta.tags || [];
  const description = entry?.description || meta.description || "";

  // --- Détection +18 (depuis manga_type ou tags) ---
  const mangaType = String(
    meta?.series?.manga_type ??
    meta?.manga_type ??
    meta?.media?.manga?.manga_type ??
    entry?.manga_type ?? ""
  ).toLowerCase();

  const has18Tag = (
    (Array.isArray(meta?.tags)  ? meta.tags  : []).concat(
    Array.isArray(entry?.tags) ? entry.tags : [])
  ).some(t => String(t).includes("+18") || /adult|nsfw/i.test(String(t)));

  const pornographic = (mangaType === "pornographique") || has18Tag;

  // Épisodes (mappe tes champs indice_ep/date_ep/title_ep)
  let episodes = [];
  if (Array.isArray(meta.episodes)) {
    episodes = meta.episodes.map(e => ({
      type:  e.type,
      id:    e.id,
      index: e.indice_ep ?? e.index ?? e.ep ?? null,
      date:  typeof e.date_ep === "string" ? parseInt(e.date_ep, 10) : (e.date_ep ?? e.date ?? null),
      title: e.title_ep ?? e.title ?? ""
    }));
  } else if (entry?.episodes) {
    episodes = entry.episodes;
  } else if (entry?.seasons) {
    Object.values(entry.seasons).forEach(arr => { if (Array.isArray(arr)) episodes.push(...arr); });
  }

  // Slug depuis le nom de fichier (fallback titre)
  const baseName = (filename ? filename.replace(/\.json$/,'') : (meta.slug || meta.file || meta.title || ''));
  const slug = (typeof window !== "undefined" && window.slugify)
    ? window.slugify(String(baseName))
    : String(baseName).toLowerCase().replace(/\s+/g,'-');

  // Année (pour l’affichage à droite)
  let year = "";
  if (typeof dateStart === "number") year = String(new Date(dateStart*1000).getFullYear());
  else if (typeof dateStart === "string") {
    const parts = dateStart.split(/[\/\-]/); year = parts[parts.length-1] || "";
  }

  return {
    __kind: "anime",
    slug,
    title: meta.title || "(Sans titre)",
    cover,
    type,
    status,
    studios,
    year,
    tags,
    description,
    episodes,
    episodesCount: Array.isArray(episodes) ? episodes.length : 0,
    pornographic, // ⬅️ flag +18 pour filtrer côté homepage
  };
}

/**
 * Charge TOUTES les fiches listées en config et retourne
 * toutes les "cartes anime" (y compris si le fichier a des chapitres).
 */
export async function fetchAllAnimeData() {
  const config = await loadGlobalConfig();

  let fileList = [];
  if (config.ENV === "LOCAL_DEV" && Array.isArray(config.LOCAL_SERIES_FILES)) {
    fileList = config.LOCAL_SERIES_FILES.map(name => ({ name, url: `/data/series/${name}` }));
  } else {
    const contents = await fetchData(config.URL_GIT_CUBARI);
    if (Array.isArray(contents)) {
      fileList = contents
        .filter(f => f.type === "file" && f.name.endsWith(".json"))
        .map(f => ({ name: f.name, url: f.download_url }));
    }
  }

  const results = await Promise.all(fileList.map(async ({ name, url }) => {
    try {
      const meta = await fetchData(url);               // <- JSON série (manga/LN)
      const norm = normalizeAnime(meta, name);         // <- ce que tu fais déjà

      // ⬇️ Ajout MINIMAL : on propage la pastille de la fiche série vers chaque objet anime
      const addBadge = (a) => {
        if (!a) return null;
        const v = a.vignette_anime ?? meta?.vignette_anime ?? null;
        // on garde aussi une réf “series” si tu veux y accéder côté render
        const parentSeries = a.series || { title: meta?.title, slug: meta?.slug };
        return { ...a, vignette_anime: v, series: parentSeries };
      };

      return Array.isArray(norm) ? norm.map(addBadge) : addBadge(norm);
    } catch (e) {
      const msg = String(e?.message || e);
      if (msg.includes("status: 404")) { console.warn("⏭️  Skip missing series file:", name); return null; }
      console.error("Anime file load error:", name, e);
      return null;
    }
  }));

  // ⬇️ IMPORTANT : on aplatit (si normalizeAnime a renvoyé des tableaux), puis on filtre les nuls
  return results.flatMap(x => Array.isArray(x) ? x : [x]).filter(Boolean);
}

// --- NOUVELLE FONCTION OPTIMISÉE ---
/**
 * Récupère les données d'UNE SEULE série en se basant sur son slug.
 * @param {string} slug - Le slug de la série à trouver (ex: "kaoru_hana_wa_rin_to_saku").
 * @returns {Promise<object|null>} L'objet de la série ou null si non trouvée.
 */
export async function fetchSeriesDataBySlug(slug) {
    const config = await loadGlobalConfig();
    let foundFile;

    if (config.ENV === "LOCAL_DEV") {
        const localFiles = config.LOCAL_SERIES_FILES || [];
        const foundFilename = localFiles.find(filename => slugify(filename.replace('.json', '')) === slug);
        if (foundFilename) {
            foundFile = {
                path: `/data/series/${foundFilename}`,
                name: foundFilename
            };
        }
    } else {
        const contents = await fetchData(config.URL_GIT_CUBARI);
        if (Array.isArray(contents)) {
            const foundGithubFile = contents.find(file => file.name.endsWith('.json') && slugify(file.name.replace('.json', '')) === slug);
            if (foundGithubFile) {
                foundFile = {
                    path: foundGithubFile.download_url,
                    name: foundGithubFile.name
                };
            }
        }
    }

    if (foundFile) {
        try {
            const serie = await fetchData(foundFile.path);
            const rawGithubFileUrl = `${config.URL_RAW_JSON_GITHUB}${foundFile.name}`;
            const base64Url = serie.cubari_gist_id ? serie.cubari_gist_id : btoa(rawGithubFileUrl);
            return { ...serie, base64Url };
        } catch (error) {
            console.error(`Error loading the specific series file ${foundFile.name}:`, error);
            return null;
        }
    }

    console.warn(`Series with slug "${slug}" not found.`);
    return null;
}


/**
 * Récupère TOUTES les données des séries. Utile pour la page d'accueil.
 * @returns {Promise<Array<object>>} Un tableau d'objets série.
 */
let SERIES_CACHE = null;

export async function fetchAllSeriesData({ force = false, cache = "force-cache" } = {}) {
  if (!force && SERIES_CACHE) return SERIES_CACHE;

  const config = await loadGlobalConfig();
  let seriesPromises = [];

  if (config.ENV === "LOCAL_DEV" && Array.isArray(config.LOCAL_SERIES_FILES)) {
    seriesPromises = config.LOCAL_SERIES_FILES.map(async (filename) => {
      const url = `/data/series/${filename}`;
      try {
        const serie = await fetchData(url, { cache }); // ⬅ hint cache pour fichiers locaux
        const rawGithubFileUrl = `${config.URL_RAW_JSON_GITHUB}${filename}`;
        const base64Url = serie.cubari_gist_id ? serie.cubari_gist_id : btoa(rawGithubFileUrl);
        return { ...serie, base64Url };
      } catch (e) {
        console.error(`Error loading local series file ${url}:`, e);
        return null;
      }
    });
  } else {
    try {
      const contents = await fetchData(config.URL_GIT_CUBARI, { cache });
      if (!Array.isArray(contents)) return [];
      seriesPromises = contents
        .filter(f => f.type === "file" && f.name.endsWith(".json"))
        .map(async (file) => {
          try {
            const serie = await fetchData(file.download_url, { cache });
            const rawGithubFileUrl = `${config.URL_RAW_JSON_GITHUB}${file.name}`;
            const base64Url = serie.cubari_gist_id ? serie.cubari_gist_id : btoa(rawGithubFileUrl);
            return { ...serie, base64Url };
          } catch (e) {
            console.error(`Error loading series ${file.name}:`, e);
            return null;
          }
        });
    } catch (e) {
      console.error("Error fetching GitHub file list:", e);
      return [];
    }
  }

  const all = (await Promise.all(seriesPromises))
    // ⬇️ NE PLUS filtrer par "chapters" -> on garde JV, LN sans chapitres, etc.
    .filter(s => s && typeof s === "object" && s.title);

  SERIES_CACHE = all;
  return all;
}