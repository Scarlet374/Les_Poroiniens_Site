// js/pages/series-detail/imgchestViews.js
import { qsa } from '../../utils/domUtils.js';

let imgChestPostViewsCache = new Map();
let isLoadingImgChestViews = false;
let allImgChestViewsPreloadedAttempted = false;

async function preloadAllImgChestViewsOnce() {
  if (allImgChestViewsPreloadedAttempted || isLoadingImgChestViews) return;

  isLoadingImgChestViews = true;

  try {
    const response = await fetch(`/api/imgchest-get-all-pages`);
    if (!response.ok) throw new Error(`Proxy request failed: ${response.status}`);
    const data = await response.json();

    if (Array.isArray(data.posts)) {
      data.posts.forEach(post => {
        if (post.id && typeof post.views !== 'undefined') {
          imgChestPostViewsCache.set(post.id, post.views);
        }
      });
    }

    allImgChestViewsPreloadedAttempted = true;
    updateAllVisibleChapterViews();

  } catch (error) {
    console.error(`[Views] Error fetching all pages combined:`, error);
  } finally {
    isLoadingImgChestViews = false;
  }
}

function updateAllVisibleChapterViews() {
  qsa('.detail-chapter-views[data-imgchest-id]').forEach(viewElement => {
    const postId = viewElement.dataset.imgchestId;
    if (imgChestPostViewsCache.has(postId)) {
      const views = imgChestPostViewsCache.get(postId);
      viewElement.innerHTML = `<i class="fas fa-eye"></i> ${views.toLocaleString('fr-FR')}`;
    } else if (allImgChestViewsPreloadedAttempted && !isLoadingImgChestViews) {
      viewElement.innerHTML = `<i class="fas fa-eye-slash" title="Vues non disponibles"></i>`;
    }
  });
}

export { preloadAllImgChestViewsOnce, updateAllVisibleChapterViews };