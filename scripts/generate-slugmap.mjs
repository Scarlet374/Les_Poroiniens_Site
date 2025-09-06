// scripts/generate-slugmap.mjs
// Génère: functions/_slugmap.js avec la map { slugify(title) : "filename.json" }

import fs from "node:fs/promises";
import path from "node:path";

const SERIES_DIR = path.resolve("data/series");
const OUT_DIR    = path.resolve("functions");
const OUT_FILE   = path.join(OUT_DIR, "_slugmap.js");
// (optionnel) pour surcharger quelques entrées à la main :
const OVERRIDES  = path.resolve("scripts/slugmap.overrides.json");

// --- slugify identique à ton front/middleware ---
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

const baseNameNoExt = (filename) => filename.replace(/\.json$/i, "");

async function fileExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  if (!(await fileExists(SERIES_DIR))) {
    console.error(`❌ Dossier introuvable: ${SEREIS_DIR}`);
    process.exit(1);
  }

  let files = (await fs.readdir(SERIES_DIR)).filter(f => f.toLowerCase().endsWith(".json"));

  const map = Object.create(null);
  const conflicts = [];

  for (const filename of files) {
    const full = path.join(SERIES_DIR, filename);
    try {
      const raw = await fs.readFile(full, "utf8");
      const json = JSON.parse(raw);

      const title = (json && typeof json.title === "string" && json.title.trim())
        ? json.title
        : baseNameNoExt(filename);

      const key = slugify(title);
      if (!key) continue;

      if (map[key] && map[key] !== filename) {
        // Deux fichiers donnent le même slug
        // Heuristique : on préfère celui dont le nom de fichier slugifie exactement en key
        const currentScore = slugify(baseNameNoExt(map[key])) === key ? 2 : 1;
        const newScore     = slugify(baseNameNoExt(filename)) === key ? 2 : 1;

        if (newScore > currentScore) {
          conflicts.push(`• ${key}: "${map[key]}" → "${filename}"`);
          map[key] = filename;
        } else if (newScore === currentScore) {
          conflicts.push(`• ${key}: conflit entre "${map[key]}" et "${filename}" (garde le premier)`);
        }
        // sinon on garde l'existant
      } else {
        map[key] = filename;
      }
    } catch (e) {
      console.warn(`⚠️  JSON invalide ignoré: ${filename} (${e.message})`);
    }
  }

  // Overrides facultatifs
  if (await fileExists(OVERRIDES)) {
    try {
      const extra = JSON.parse(await fs.readFile(OVERRIDES, "utf8"));
      for (const [k, v] of Object.entries(extra || {})) {
        if (typeof v === "string" && v.endsWith(".json")) {
          map[k] = v;
        }
      }
      console.log(`✅ Overrides appliqués depuis ${path.relative(process.cwd(), OVERRIDES)}`);
    } catch (e) {
      console.warn(`⚠️  Overrides ignorés: ${e.message}`);
    }
  }

  // Tri pour un diff propre
  const sorted = Object.fromEntries(
    Object.entries(map).sort(([a],[b]) => a.localeCompare(b, "fr"))
  );

  const banner =
`// functions/_slugmap.js
// Mappe: slugify(title) -> filename.json
export const slugToFile = ${JSON.stringify(sorted, null, 2)};
`;

  await fs.writeFile(OUT_FILE, banner, "utf8");

  console.log(`✅ Écrit ${path.relative(process.cwd(), OUT_FILE)} avec ${Object.keys(sorted).length} entrées.`);
  if (conflicts.length) {
    console.log("⚠️  Conflits rencontrés :\n" + conflicts.join("\n"));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});