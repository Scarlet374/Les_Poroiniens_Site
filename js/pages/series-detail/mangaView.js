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
import { parseChapterKey } from "../../utils/chapters.js";

// --- Helpers Chapitre/Extra ---

function buildDisplayLabelFromKey(key, title) {
  const tRaw = String(title || "").trim();

  // normalisation (ignore accents) pour détecter Prologue / Épilogue
  const tNorm = tRaw
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

  const isPrologue = /^prologue\b/.test(tNorm);
  const isEpilogue = /^epilogue\b/.test(tNorm);

  if (isPrologue || isEpilogue) {
    // Dans ce cas, on n'affiche QUE “Prologue” ou “Épilogue”
    // et on supprime le sous-titre pour éviter “Titre inconnu”.
    return { heading: tRaw, title: "", suppressTitle: true };
  }

  // Gestion Extra via clé "1.1", "2.3", etc.
  const { maj, min } = parseChapterKey(key);
  const isExtra = min > 0;

  if (isExtra) {
    const cleanTitle = tRaw.replace(/^Extra\s*\d+\s*:\s*/i, "").trim();
    return { heading: `Extra ${min}`, title: cleanTitle };
  }

  // Chapitre classique
  return { heading: `Chapitre ${maj}`, title: tRaw };
}

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

  // Chapitres lisibles = Manga (groups.LesPoroïniens) OU LN (file),
  // en excluant les chapitres licenciés sans lien lisible.
  const readableChapters = Object.entries(seriesData.chapters || {})
    .filter(([_, chapData]) => {
      const isLicensed =
        chapData.licencied &&
        chapData.licencied.length > 0 &&
        (!chapData.groups || chapData.groups.LesPoroïniens === "");
      if (isLicensed) return false;

      const isManga = !!(chapData.groups && chapData.groups.LesPoroïniens);
      const isLN    = !!chapData.file;
      return isManga || isLN;
    })
    .map(([chapNum]) => chapNum);

  // tri numérique (supporte 1, 1.5, "1,5", etc.)
  readableChapters.sort(
    (a, b) =>
      parseFloat(String(a).replace(",", ".")) -
      parseFloat(String(b).replace(",", "."))
  );

  if (readableChapters.length === 0) {
    container.innerHTML = "";
    return;
  }

  const lastReadChapter = getReadingProgress(seriesSlug);
  const lastChapter = readableChapters[readableChapters.length - 1];

  let nextChapter = null;
  if (lastReadChapter) {
    const lastIdx = readableChapters.indexOf(lastReadChapter);
    if (lastIdx !== -1 && lastIdx < readableChapters.length - 1) {
      nextChapter = readableChapters[lastIdx + 1];
    }
  }

  const lastChapterUrl = `/${seriesSlug}/${String(lastChapter)}`;
  const nextChapterUrl = nextChapter ? `/${seriesSlug}/${String(nextChapter)}` : null;

  let buttonsHtml = "";

  // Bouton "Continuer"
  if (nextChapterUrl) {
    buttonsHtml += `
      <a href="${nextChapterUrl}" class="reading-action-button continue">
        <i class="fas fa-play"></i> Continuer (Ch. ${nextChapter})
      </a>`;
  } else if (lastReadChapter && lastReadChapter === lastChapter) {
    buttonsHtml += `
      <span class="reading-action-button disabled">
        <i class="fas fa-check"></i> À jour
      </span>`;
  }

  // Bouton "Dernier Chapitre"
  if (!lastReadChapter || lastReadChapter !== lastChapter) {
    buttonsHtml += `
      <a href="${lastChapterUrl}" class="reading-action-button start">
        <i class="fas fa-fast-forward"></i> Dernier Chapitre (Ch. ${lastChapter})
      </a>`;
  }

  // Bouton "Avancement"
  const showProgress = shouldShowProgress(seriesData);
  if (showProgress) {
    buttonsHtml += `
      <button type="button" class="reading-action-button start progress-btn">
        <i class="fas fa-tasks"></i> Avancement
      </button>
    `;
  }
  container.innerHTML = buttonsHtml;

  if (showProgress) {
    const progressBtn = container.querySelector('.progress-btn');
    if (progressBtn) {
      const progressModal = createProgressModal(seriesData);
      progressBtn.addEventListener('click', () => progressModal.open());
    }
  }

  container.innerHTML = buttonsHtml;

  // --- branchement du modal "Avancement" ---
  const progressBtn = container.querySelector(".progress-btn");
  if (progressBtn) {
    const progressModal = createProgressModal(seriesData); // défini plus bas
    progressBtn.addEventListener("click", () => progressModal.open());
  }
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

      const lbl = buildDisplayLabelFromKey(c.chapter, c.title);

      return `<a ${href ? `href="${href}"` : ""} class="${chapterClass}" data-chapter-number="${c.chapter}">
        <div class="chapter-main-info">
          <span class="detail-chapter-number">${lbl.heading}</span>
          ${
            lbl.suppressTitle
              ? ""
              : `<span class="detail-chapter-title">${lbl.title ? lbl.title : ""}</span>`
          }
        </div>
        <div class="chapter-side-info">
          ${likesHtml}${viewsHtml}${collabHtml}
          <span class="detail-chapter-date">${timeAgo(c.last_updated_ts)}</span>
        </div>
      </a>`;
    })
    .join("");
}

function displayGroupedChapters(seriesData, seriesSlug) {
  const chaptersContainer = qs(".chapters-accordion-container");
  if (!chaptersContainer) return;
  const currentSeriesAllChaptersRaw = Object.entries(seriesData.chapters || {})
    .map(([chapNum, chapData]) => {
      // Cherche la meilleure date disponible
      const candidates = [
        chapData.last_updated,
        chapData.updated_at,
        chapData.lastUpdate,
        chapData.date,
        chapData.time,
        chapData.timestamp
      ];
      let ts = NaN;
      for (const v of candidates) {
        const t = parseDateToTimestamp(v);
        if (!Number.isNaN(t)) { ts = t; break; } // prend le 1er valide
      }
      return {
        chapter: chapNum,
        ...chapData,
        last_updated_ts: ts,
      };
    });
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
      const A = parseChapterKey(a.chapter);
      const B = parseChapterKey(b.chapter);

      // tri par numéro principal puis sous-numéro (extras)
      if (A.maj !== B.maj) {
        return currentVolumeSortOrder === "desc" ? B.maj - A.maj : A.maj - B.maj;
      }
      return currentVolumeSortOrder === "desc" ? B.min - A.min : A.min - B.min;
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
  document.title = `Les Poroïniens – ${seriesData.title}`;
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

/* Bouton avancement*/
function createProgressModal(seriesData) {
  const { map, order, paused, upToDate } = parseProgress(seriesData.Avancement || {});
  const icon = ok => ok ? '✅' : '❌';

  // Tuile dynamique (si jamais on affiche la grille)
  const gridHTML = order.map(label => `
    <div class="progress-item" role="group" aria-label="${esc(label)}">
      <span class="label">${esc(label)}</span>
      <span class="state ${map[label] ? 'ok' : 'ko'}" aria-hidden="true">${icon(map[label])}</span>
    </div>
  `).join('');

  // Panneaux spéciaux
  const pauseHTML = `
    <div class="progress-pause">
      <strong>La série est en pause.</strong><br>
      ${seriesData.pause_reason ? esc(seriesData.pause_reason) : 'Aucune justification fournie.'}
    </div>
  `;

  const upHTML = `
    <div class="progress-up2date">
      <strong>Nous avons traduit tous les chapitres de cette série.</strong>
    </div>
  `;

  // Affichage : priorité Pause > À jour > Grille
  const showOnlyPause = paused === true;
  const showOnlyUpToDate = !showOnlyPause && (upToDate === true);
  const showGrid = !showOnlyPause && !showOnlyUpToDate && order.length > 0;

  const noteHTML = showGrid ? `
    <div class="progress-note">
      Avancement du prochain chapitre. Les étapes cochées sont terminées, les croix sont en cours ou à faire.
    </div>
  ` : '';

  const noStepsHTML = (!showOnlyPause && !showOnlyUpToDate && !showGrid)
    ? `<div class="progress-note">Aucune étape fournie pour cette série.</div>`
    : '';

  const backdrop = document.createElement('div');
  backdrop.className = 'progress-backdrop';
  backdrop.innerHTML = `
    <div class="progress-modal" role="dialog" aria-modal="true" aria-label="Avancement du prochain chapitre">
      <div class="progress-header">
        <div class="progress-title">Avancement du prochain chapitre</div>
        <button class="progress-close" aria-label="Fermer">✕</button>
      </div>
      <div class="progress-body">
        ${showOnlyPause ? pauseHTML : ''}
        ${showOnlyUpToDate ? upHTML : ''}
        ${showGrid ? `<div class="progress-grid">${gridHTML}</div>` : ''}
        ${noteHTML}
        ${noStepsHTML}
      </div>
    </div>
  `;

  const close = () => backdrop.classList.remove('active');
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
  backdrop.querySelector('.progress-close').addEventListener('click', close);
  const escHandler = ev => { if (ev.key === 'Escape' && backdrop.classList.contains('active')) { close(); document.removeEventListener('keydown', escHandler); } };
  document.addEventListener('keydown', escHandler);

  document.body.appendChild(backdrop);
  return { open(){ backdrop.classList.add('active'); } };
}

// échappe le texte injecté
function esc(str){
  return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}

// normalise une clé: supprime accents, espaces multiples, met en minuscule
function normKey(k){
  return String(k || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // accents
    .replace(/\s+/g, " ")                               // espaces multiples
    .replace(/\u00A0/g, " ")                            // NBSP -> espace
    .trim().toLowerCase();
}

/**
 * Parse Avancement (objet ou tableau) -> { map, order, paused, upToDate }
 * - order: liste des libellés à afficher (on exclut "En pause" et "A jour/À jour")
 * - paused: true si "En pause" === O(=true)
 * - upToDate: true si "A jour"/"À jour" === O(=true)
 */
function parseProgress(avancement){
  let order = [];
  let map = {};
  let paused = false;
  let upToDate = false;

  const isOn = (v) => {
    if (v === undefined || v === null) return false;
    if (typeof v === "boolean") return v;
    const s = String(v).trim().toLowerCase();
    return ["o","oui","y","yes","true","1","✓","✅"].includes(s);
  };

  const SPECIALS = {
    pause: ["en pause"],
    up: ["a jour","à jour","a jour","à jour"] // support espaces & NBSP
  };

  // — cas tableau: on respecte l'ordre fourni
  if (Array.isArray(avancement)) {
    avancement.forEach(obj => {
      const key = Object.keys(obj || {})[0];
      if (!key) return;
      const nk = normKey(key);
      if (SPECIALS.pause.includes(nk)) { paused = isOn(obj[key]); return; }
      if (SPECIALS.up.includes(nk))    { upToDate = isOn(obj[key]); return; }
      map[key] = isOn(obj[key]);       // on garde le libellé d'origine pour l'affichage
      order.push(key);
    });
  }
  // — cas objet simple
  else if (avancement && typeof avancement === "object") {
    // ordre canonique d'abord si présent, puis les autres
    const BASE = ['Raw','Traduction','Clean','Relecture','Lettrage','Correction','En pause','A jour','À jour'];
    const keys = Object.keys(avancement);

    // détecte les spéciaux
    keys.forEach(k => {
      const nk = normKey(k);
      if (SPECIALS.pause.includes(nk)) paused   = isOn(avancement[k]);
      if (SPECIALS.up.includes(nk))    upToDate = isOn(avancement[k]);
    });

    // construit map + order
    BASE.forEach(k => {
      if (k in avancement) {
        const nk = normKey(k);
        if (SPECIALS.pause.includes(nk) || SPECIALS.up.includes(nk)) return; // on n'affiche pas dans la grille
        map[k] = isOn(avancement[k]);
        order.push(k);
      }
    });
    // ajoute les autres clés non listées dans BASE
    keys.forEach(k => {
      const nk = normKey(k);
      if (SPECIALS.pause.includes(nk) || SPECIALS.up.includes(nk)) return;
      if (!order.includes(k)) { map[k] = isOn(avancement[k]); order.push(k); }
    });
  }

  return { map, order, paused, upToDate };
}

// Affiche-t-on le bouton ?  (si étapes, ou pause, ou à-jour)
function shouldShowProgress(seriesData){
  if (!seriesData || !seriesData.Avancement) return false;
  const { order, paused, upToDate } = parseProgress(seriesData.Avancement);
  return paused || upToDate || order.length > 0;
}