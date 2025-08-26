// scripts/generate-search-index.mjs
import { promises as fs } from "node:fs";
import { join, resolve, basename } from "node:path";
import glob from "tiny-glob";

/**
 * Répertoires/chemins : adapte si besoin
 */
const DATA_DIR = resolve("data");
const OUT_FILE  = resolve("data/search-index.json");

/** Détermine si une série est +18 */
function isAdult(series) {
  const t = (series.manga_type || "").toLowerCase();
  return series.pornwha === true || series.doujinshi === true || t === "pornographique";
}

/** Slug cohérent avec le front : accents → rien, non-alphanum → '_' */
function toSlug(s) {
  return String(s || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** On considère que c'est une “série” si: titre + (chapitres) ou (light_novel true) */
function looksLikeSeries(json) {
  if (!json || typeof json !== "object") return false;
  if (typeof json.title !== "string" || !json.title.trim()) return false;

  const hasChapters =
    json.chapters &&
    typeof json.chapters === "object" &&
    Object.keys(json.chapters).length > 0;

  return hasChapters || json.light_novel === true;
}

function pick(x, keys) {
  const out = {};
  for (const k of keys) if (x[k] !== undefined) out[k] = x[k];
  return out;
}

async function run() {
  // On liste tous les .json mais on ignore explicitement quelques patterns de config courants
  const files = await glob("**/*.json", {
    cwd: DATA_DIR,
    ignore: [
      "**/search-index*.json",
      "**/manifest*.json",
      "**/config/**",
      "**/configs/**",
      "**/*config*.json",
      "**/colors*.json",
      "**/colour*.json",
      "**/header*.json",
      "**/og-*.json",
      "**/admin*.json",
      "**/dashboard*.json"
    ],
  });

  const out = [];
  for (const rel of files) {
    const full = join(DATA_DIR, rel);
    try {
      const raw  = await fs.readFile(full, "utf8");
      const json = JSON.parse(raw);

      // On ne garde que ce qui ressemble à une série
      if (!looksLikeSeries(json)) {
        continue;
      }

      // slug : json.slug > sinon depuis le titre > sinon depuis le nom de fichier
      const slug =
        (json.slug && json.slug.trim()) ||
        toSlug(json.title) ||
        toSlug(basename(rel, ".json"));

      const doc = {
        slug,
        title: json.title || slug,
        ...pick(json, [
          "alternative_titles",
          "author",
          "artist",
          "magazine",
          "release_year",
          "tags",
          "manga_type",
          "pornwha",
          "doujinshi",
          "light_novel",
        ]),
      };

      doc.isAdult = isAdult(doc);
      out.push(doc);
    } catch (e) {
      console.warn("Skip invalid JSON:", rel, e.message);
    }
  }

  // Tri stable
  out.sort((a, b) => a.title.localeCompare(b.title, "fr"));

  await fs.writeFile(OUT_FILE, JSON.stringify(out), "utf8");
  console.log(`Wrote ${OUT_FILE} (${out.length} series)`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
/**
 * Pour exécuter ce script :
 *   node --no-warnings --loader ts-node/esm scripts/generate-search-index.mjs
 *
 * Puis copier/coller le fichier data/search-index.json dans static/
 *
 * Note : on utilise tiny-glob (plus rapide que glob) et pas glob.glob car pas de callback
 */