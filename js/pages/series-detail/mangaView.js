// js/pages/series-detail/mangaView.js
import { qs, qsa, slugify } from "../../utils/domUtils.js";
import { timeAgo, parseDateToTimestamp } from "../../utils/dateUtils.js";
import {
  preloadAllImgChestViewsOnce,
  updateAllVisibleChapterViews,
} from "./imgchestViews.js";
import { generateNavTabs, generateSeriesHeader } from "./components.js";
import { initMainScrollObserver } from "../../components/observer.js";
import {
  fetchSeriesStats,
  getLocalInteractionState,
  setLocalInteractionState,
  queueAction,
} from "../../utils/interactions.js";

let currentVolumeSortOrder = "desc";
let currentSeriesStats = {};

function saveReadingProgress(seriesSlug, chapterNumber) {
  if (!seriesSlug || !chapterNumber) return;
  try {
    localStorage.setItem(
      `reading_progress_${seriesSlug}`,
      chapterNumber.toString()
    );
  } catch (e) {
    console.error("Erreur lors de la sauvegarde de la progression:", e);
  }
}
function getReadingProgress(seriesSlug) {
  try {
    return localStorage.getItem(`reading_progress_${seriesSlug}`);
  } catch (e) {
    console.error("Erreur lors de la lecture de la progression:", e);
    return null;
  }
}
function renderReadingActions(seriesData, seriesSlug) {
  const container = qs("#reading-actions-container");
  if (!container) return;
  const chapters = Object.entries(seriesData.chapters || {})
    .filter(([, chapData]) => chapData.groups && chapData.groups.LesPoroïniens)
    .map(([chapNum]) => chapNum);
  chapters.sort(
    (a, b) =>
      parseFloat(String(a).replace(",", ".")) -
      parseFloat(String(b).replace(",", "."))
  );
  if (chapters.length === 0) {
    container.innerHTML = "";
    return;
  }
  const lastReadChapter = getReadingProgress(seriesSlug);
  const lastChapter = chapters[chapters.length - 1];
  let nextChapter = null;
  if (lastReadChapter) {
    const lastReadIndex = chapters.indexOf(lastReadChapter);
    if (lastReadIndex !== -1 && lastReadIndex < chapters.length - 1) {
      nextChapter = chapters[lastReadIndex + 1];
    }
  }
  const lastChapterUrl = `/${seriesSlug}/${String(lastChapter)}`;
  const nextChapterUrl = nextChapter
    ? `/${seriesSlug}/${String(nextChapter)}`
    : null;
  let buttonsHtml = "";
  if (nextChapterUrl) {
    buttonsHtml += `<a href="${nextChapterUrl}" class="reading-action-button continue"><i class="fas fa-play"></i> Continuer (Ch. ${nextChapter})</a>`;
  } else if (lastReadChapter && lastReadChapter === lastChapter) {
    buttonsHtml += `<span class="reading-action-button disabled"><i class="fas fa-check"></i> À jour</span>`;
  }
  if (!lastReadChapter || lastReadChapter !== lastChapter) {
    buttonsHtml += `<a href="${lastChapterUrl}" class="reading-action-button start"><i class="fas fa-fast-forward"></i> Dernier Chapitre (Ch. ${lastChapter})</a>`;
  }
  container.innerHTML = buttonsHtml;
}

function handleChapterLikeClick(e, seriesSlug) {
  const likeContainer = e.target.closest(".detail-chapter-likes");
  if (!likeContainer) return;
  e.preventDefault();
  e.stopPropagation();
  const chapterItem = e.target.closest("a.detail-chapter-item");
  const chapterNumber = chapterItem.dataset.chapterNumber;
  const interactionKey = `interactions_${seriesSlug}_${chapterNumber}`;
  let localState = getLocalInteractionState(interactionKey);
  const wasLiked = localState.hasLiked || false;

  // Correction ici : on prend le texte et on le parse, on ne garde pas le compte en mémoire
  const currentLikesText = likeContainer.textContent.trim();
  const currentLikes = parseInt(currentLikesText.match(/\d+/)?.[0] || "0", 10);

  likeContainer.innerHTML = `<i class="fas fa-heart"></i> ${
    wasLiked ? currentLikes - 1 : currentLikes + 1
  }`;
  likeContainer.classList.toggle("liked", !wasLiked);
  queueAction(seriesSlug, {
    type: wasLiked ? "unlike" : "like",
    chapter: chapterNumber,
  });
  localState.hasLiked = !wasLiked;
  setLocalInteractionState(interactionKey, localState);
}

function renderChaptersListForVolume(chaptersToRender, seriesSlug) {
  return chaptersToRender
    .map((c) => {
      const isLicensed =
        c.licencied &&
        c.licencied.length > 0 &&
        (!c.groups || c.groups.LesPoroïniens === "");
      const chapterClass = isLicensed
        ? "detail-chapter-item licensed-chapter-item"
        : "detail-chapter-item";
      let href = "",
        viewsHtml = "";

      const interactionKey = `interactions_${seriesSlug}_${c.chapter}`;
      const localState = getLocalInteractionState(interactionKey);
      const serverStats = currentSeriesStats[c.chapter] || {
        likes: 0,
        comments: [],
      };

      // ↓↓↓ LA CORRECTION EST ICI ↓↓↓
      // Logique de comptage optimiste au chargement de la liste
      let displayLikes = serverStats.likes;
      if (localState.hasLiked) {
        // Si l'état local dit "liké", on s'assure que le compteur est au moins de 1 de plus
        // que ce que le serveur dit, s'il n'est pas déjà plus élevé.
        // (cas où le serveur n'est pas encore à jour).
        displayLikes = Math.max(
          displayLikes,
          (currentSeriesStats[c.chapter]?.likes || 0) + 1
        );
      }
      // ↑↑↑ FIN DE LA CORRECTION ↑↑↑

      const likesHtml = `<span class="detail-chapter-likes ${
        localState.hasLiked ? "liked" : ""
        }" title="J'aime" data-like-count="${displayLikes}"><i class="fas fa-heart"></i> ${displayLikes}</span>`;
      const commentsHtml = `<span class="detail-chapter-comments" title="Commentaires" data-comment-count="${serverStats.comments?.length || 0}"><i class="fas fa-comment"></i> ${
        serverStats.comments?.length || 0
      }</span>`;

      // Support LN : un chapitre LN a "file"
      const isLN = !!c.file;
      if (!isLicensed && ((c.groups && c.groups.LesPoroïniens) || isLN)) {
        href = `/${seriesSlug}/${String(c.chapter)}`;
        if (c.groups && c.groups.LesPoroïniens && c.groups.LesPoroïniens.includes("/proxy/api/imgchest/chapter/")) {
          const parts = c.groups.LesPoroïniens.split("/");
          const imgchestPostId = parts[parts.length - 1];
          viewsHtml = `<span class="detail-chapter-views" data-imgchest-id="${imgchestPostId}"><i class="fas fa-circle-notch fa-spin"></i></span>`;
        }
      }
      const collabHtml = c.collab
        ? `<span class="detail-chapter-collab">${c.collab}</span>`
        : "";

      return `<a ${
        href ? `href="${href}"` : ""
      } class="${chapterClass}" data-chapter-number="${
        c.chapter
      }"><div class="chapter-main-info"><span class="detail-chapter-number">Chapitre ${
        c.chapter
      }</span><span class="detail-chapter-title">${
        c.title || "Titre inconnu"
      }</span></div><div class="chapter-side-info">${likesHtml}${commentsHtml}${viewsHtml}${collabHtml}<span class="detail-chapter-date">${timeAgo(
        c.last_updated_ts
      )}</span></div></a>`;
    })
    .join("");
}

function displayGroupedChapters(seriesData, seriesSlug) {
  const chaptersContainer = qs(".chapters-accordion-container");
  if (!chaptersContainer) return;
  const currentSeriesAllChaptersRaw = Object.entries(
    seriesData.chapters || {}
  ).map(([chapNum, chapData]) => ({
    chapter: chapNum,
    ...chapData,
    last_updated_ts: parseDateToTimestamp(chapData.last_updated || 0),
  }));
  if (currentSeriesAllChaptersRaw.length === 0) {
    chaptersContainer.innerHTML = "<p>Aucun chapitre à afficher.</p>";
    return;
  }
  let grouped = new Map();
  let volumeLicenseInfo = new Map();
  currentSeriesAllChaptersRaw.forEach((chap) => {
    const volKey =
      chap.volume && String(chap.volume).trim() !== ""
        ? String(chap.volume).trim()
        : "hors_serie";
    if (!grouped.has(volKey)) grouped.set(volKey, []);
    grouped.get(volKey).push(chap);
    if (
      chap.licencied &&
      chap.licencied.length > 0 &&
      (!chap.groups || chap.groups.LesPoroïniens === "")
    ) {
      if (!volumeLicenseInfo.has(volKey))
        volumeLicenseInfo.set(volKey, chap.licencied);
    }
  });
  for (const [, chapters] of grouped.entries()) {
    chapters.sort((a, b) => {
      const chapA = parseFloat(String(a.chapter).replace(",", "."));
      const chapB = parseFloat(String(b.chapter).replace(",", "."));
      return currentVolumeSortOrder === "desc" ? chapB - chapA : chapA - chapB;
    });
  }
  let sortedVolumeKeys = [...grouped.keys()].sort((a, b) => {
    const isAHorsSerie = a === "hors_serie";
    const isBHorsSerie = b === "hors_serie";
    if (isAHorsSerie || isBHorsSerie) {
      if (isAHorsSerie && !isBHorsSerie)
        return currentVolumeSortOrder === "desc" ? -1 : 1;
      if (!isAHorsSerie && isBHorsSerie)
        return currentVolumeSortOrder === "desc" ? 1 : -1;
      return 0;
    }
    const numA = parseFloat(String(a).replace(",", "."));
    const numB = parseFloat(String(b).replace(",", "."));
    return currentVolumeSortOrder === "desc" ? numB - numA : numA - numB;
  });
  chaptersContainer.innerHTML = sortedVolumeKeys
    .map((volKey) => {
      const volumeDisplayName =
        volKey === "hors_serie" ? "Hors-série" : `Volume ${volKey}`;
      const chaptersInVolume = grouped.get(volKey);
      const licenseDetails = volumeLicenseInfo.get(volKey);
      const isActiveByDefault = true;
      let volumeHeaderContent = `<h4 class="volume-title-main">${volumeDisplayName}`;
      if (licenseDetails) {
        volumeHeaderContent += `${licenseDetails[1]
          ? ` <span class="volume-release-date">(${licenseDetails[1]})</span> `
          : ""
          }`
        volumeHeaderContent += `<span class="volume-license-text">Disponible en papier, commandez-le <a href="${licenseDetails[0]
          }" target="_blank" rel="noopener noreferrer" class="volume-license-link">ici !</a></span>`;
      }
      volumeHeaderContent += "</h4>"
      return `<div class="volume-group"><div class="volume-header ${
        isActiveByDefault ? "active" : ""
      }" data-volume="${volKey}">${volumeHeaderContent}<i class="fas fa-chevron-down volume-arrow ${
        isActiveByDefault ? "rotated" : ""
      }"></i></div><div class="volume-chapters-list">${renderChaptersListForVolume(
        chaptersInVolume,
        seriesSlug
      )}</div></div>`;
    })
    .join("");
  updateAllVisibleChapterViews();
  qsa(".volume-group", chaptersContainer).forEach((group) => {
    const header = group.querySelector(".volume-header");
    const content = group.querySelector(".volume-chapters-list");
    const arrow = header.querySelector(".volume-arrow");
    if (!header || !content || !arrow) return;
    content.style.maxHeight = header.classList.contains("active")
      ? content.scrollHeight + "px"
      : "0px";
    header.addEventListener("click", () => {
      header.classList.toggle("active");
      arrow.classList.toggle("rotated");
      content.style.maxHeight = header.classList.contains("active")
        ? content.scrollHeight + "px"
        : "0px";
    });
  });
}

export async function renderMangaView(seriesData, seriesSlug) {
  const container = qs("#series-detail-section");
  if (!container || !seriesData) return;
  const navTabsHtml = generateNavTabs(seriesData, seriesSlug, "manga");
  const chaptersSectionHtml = `<div id="chapters-list-section" class="chapters-main-header"><h3 class="section-title">Liste des chapitres</h3><div class="chapter-sort-filter"><button id="sort-volumes-btn" class="sort-button" title="Trier les volumes"><i class="fas fa-sort-numeric-down-alt"></i></button></div></div><div class="chapters-accordion-container"></div>`;
  container.innerHTML = `${generateSeriesHeader(
    seriesData
  )}<div id="reading-actions-container"></div>${navTabsHtml}${chaptersSectionHtml}`;
  document.title = `BigSolo – ${seriesData.title}`;
  currentSeriesStats = await fetchSeriesStats(seriesSlug);
  displayGroupedChapters(seriesData, seriesSlug);
  renderReadingActions(seriesData, seriesSlug);
  preloadAllImgChestViewsOnce();
  const sortButton = qs("#sort-volumes-btn");
  if (sortButton) {
    sortButton.addEventListener("click", function () {
      currentVolumeSortOrder =
        currentVolumeSortOrder === "desc" ? "asc" : "desc";
      this.querySelector("i").className =
        currentVolumeSortOrder === "desc"
          ? "fas fa-sort-numeric-down-alt"
          : "fas fa-sort-numeric-up-alt";
      displayGroupedChapters(seriesData, seriesSlug);
    });
  }
  const chapterListContainer = qs(".chapters-accordion-container");
  if (chapterListContainer) {
    chapterListContainer.addEventListener("click", (e) => {
      if (e.target.closest(".detail-chapter-likes")) {
        handleChapterLikeClick(e, seriesSlug);
      } else {
        const chapterLink = e.target.closest("a.detail-chapter-item");
        if (chapterLink && chapterLink.dataset.chapterNumber) {
          saveReadingProgress(seriesSlug, chapterLink.dataset.chapterNumber);
        }
      }
    });
  }
  initMainScrollObserver();
}
