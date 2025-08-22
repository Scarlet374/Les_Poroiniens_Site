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
export async function fetchAllSeriesData() {
  const config = await loadGlobalConfig();
  let seriesPromises = [];

  if (config.ENV === "LOCAL_DEV" && Array.isArray(config.LOCAL_SERIES_FILES)) {
    seriesPromises = config.LOCAL_SERIES_FILES.map(async (filename) => {
      const localSeriesPath = `/data/series/${filename}`;
      try {
        const serie = await fetchData(localSeriesPath);
        const rawGithubFileUrl = `${config.URL_RAW_JSON_GITHUB}${filename}`;
        const base64Url = serie.cubari_gist_id ? serie.cubari_gist_id : btoa(rawGithubFileUrl);
        return { ...serie, base64Url };
      } catch (error) {
        console.error(`Error loading local series file ${localSeriesPath}:`, error);
        return null;
      }
    });
  } else {
    // ... (la logique de production reste la même)
    try {
      const contents = await fetchData(config.URL_GIT_CUBARI);
      if (!Array.isArray(contents)) return [];
      seriesPromises = contents
        .filter(file => file.name.endsWith(".json") && file.type === 'file')
        .map(async (file) => {
          try {
            const serie = await fetchData(file.download_url);
            const rawGithubFileUrl = `${config.URL_RAW_JSON_GITHUB}${file.name}`;
            const base64Url = serie.cubari_gist_id ? serie.cubari_gist_id : btoa(rawGithubFileUrl);
            return { ...serie, base64Url };
          } catch (error) {
            console.error(`Error loading series ${file.name}:`, error);
            return null;
          }
        });
    } catch (error) {
      console.error("Error fetching GitHub file list:", error);
      return [];
    }
  }

  const allSeriesResults = await Promise.all(seriesPromises);
  return allSeriesResults.filter(s => s && typeof s === 'object' && s.title && s.chapters);
}