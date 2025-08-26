import { promises as fs } from "node:fs";
import { join, resolve, basename } from "node:path";
import glob from "tiny-glob";

/**
 * Adjust paths if your repo structure differs.
 */
const DATA_DIR = resolve("data");
const OUT_FILE = resolve("data/search-index.json");

function isAdult(series) {
  const t = (series.manga_type || "").toLowerCase();
  return (
    series.pornwha === true ||
    series.doujinshi === true ||
    t === "pornographique"
  );
}

function pick(x, keys) {
  const out = {};
  for (const k of keys) if (x[k] !== undefined) out[k] = x[k];
  return out;
}

async function run() {
  const files = await glob("**/*.json", { cwd: DATA_DIR });
  const seriesFiles = files.filter((f) => {
    const low = f.toLowerCase();
    // ignore the index itself and any non-series files you may have
    return !low.includes("search-index") && !low.includes("manifest");
  });

  const out = [];
  for (const rel of seriesFiles) {
    const full = join(DATA_DIR, rel);
    try {
      const raw = await fs.readFile(full, "utf8");
      const json = JSON.parse(raw);

      // slug from filename by default (my convention)
      const slug = (json.slug || basename(rel, ".json")).trim();

      const obj = {
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

      obj.isAdult = isAdult(obj);

      out.push(obj);
    } catch (e) {
      console.warn("Skip invalid JSON:", rel, e.message);
    }
  }

  // stable order (optional)
  out.sort((a, b) => a.title.localeCompare(b.title, "fr"));

  await fs.writeFile(OUT_FILE, JSON.stringify(out), "utf8");
  console.log(`Wrote ${OUT_FILE} (${out.length} series)`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});