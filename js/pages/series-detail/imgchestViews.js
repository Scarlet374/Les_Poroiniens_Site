// js/pages/series-detail/imgchestViews.js

let IMG_VIEWS_MODE = "bulk"; // "bulk" d'abord, "per_slug" en fallback
let _bulkViewsMap = null;
let _bulkLoaded = false;

/** Charge la map { slug -> views } via /api/imgchest-get-all-pages.
 *  Si vide → on bascule en fallback per_slug. */
export async function preloadAllImgChestViewsOnce() {
  if (_bulkLoaded) return;
  _bulkLoaded = true;

  try {
    const res = await fetch("/api/imgchest-get-all-pages", { cache: "no-store" });
    const data = await res.json();
    const posts = Array.isArray(data?.posts) ? data.posts : [];

    if (posts.length > 0) {
      _bulkViewsMap = new Map(posts.map(p => [String(p.id), Number(p.views || 0)]));
      IMG_VIEWS_MODE = "bulk";
    } else {
      IMG_VIEWS_MODE = "per_slug";
    }
  } catch {
    IMG_VIEWS_MODE = "per_slug";
  }
}

/** Récupère la vue pour un slug.
 *  - mode bulk : lit dans la map préchargée
 *  - mode per_slug : /api/imgchest-chapter-pages?id=<slug>&meta=1 */
async function getViewsForSlug(slug) {
  slug = String(slug || "").trim();
  if (!slug) return null;

  if (IMG_VIEWS_MODE === "bulk") {
    return _bulkViewsMap?.get(slug) ?? null;
  }

  try {
    const r = await fetch(`/api/imgchest-chapter-pages?id=${encodeURIComponent(slug)}&meta=1`, {
      cache: "no-store"
    });
    if (!r.ok) return null;
    const j = await r.json();
    return typeof j?.views === "number" ? j.views : null;
  } catch {
    return null;
  }
}

/** Applique les vues sur les éléments [data-imgchest-slug] (œil + compteur).
 *  Évite le spinner infini : si pas de data → affiche "–". */
export async function updateAllVisibleChapterViews(container = document) {
  const nodes = container.querySelectorAll("[data-imgchest-slug]");
  if (!nodes.length) return;

  for (const el of nodes) {
    if (el.dataset.viewsResolved === "1") continue;

    const slug = el.getAttribute("data-imgchest-slug");
    const views = await getViewsForSlug(slug);

    const target = el.querySelector(".imgchest-views") || el;
    if (typeof views === "number") {
      target.textContent = views.toLocaleString("fr-FR");
    } else {
      target.textContent = "–";
    }
    el.dataset.viewsResolved = "1";
  }
}