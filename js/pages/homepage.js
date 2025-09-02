// js/pages/homepage.js
import { fetchData, fetchAllSeriesData, fetchAllAnimeData } from "../utils/fetchUtils.js";
import { slugify, qs, qsa, limitVisibleTags } from "../utils/domUtils.js";
import { parseDateToTimestamp, timeAgo } from "../utils/dateUtils.js";

/**
 * Convertit une couleur HEX en une chaîne de valeurs R, G, B.
 * @param {string} hex - La couleur au format #RRGGBB.
 * @returns {string} Une chaîne comme "255, 100, 50".
 */
function hexToRgb(hex) {
  let c = hex.substring(1).split("");
  if (c.length === 3) {
    c = [c[0], c[0], c[1], c[1], c[2], c[2]];
  }
  c = "0x" + c.join("");
  return [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(",");
}

// CORRECTION : La fonction est maintenant à la racine du module
function truncateText(text, maxLength) {
  if (typeof text !== "string") return "";
  if (text.length > maxLength) {
    return text.substring(0, maxLength - 3) + "...";
  }
  return text;
}

// Helper pour pagination

// ------- Pagination util -------
// Stocke la page courante par section (onglet) dans sessionStorage
function getPage(sectionKey) {
  const v = sessionStorage.getItem(`pager:${sectionKey}`);
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
function setPage(sectionKey, page) {
  sessionStorage.setItem(`pager:${sectionKey}`, String(page));
}

// Crée/retourne un <nav class="pager"> après la grille
function ensurePager(gridEl, sectionKey) {
  let pager = gridEl.nextElementSibling;
  if (!pager || !pager.classList.contains("pager")) {
    pager = document.createElement("nav");
    pager.className = "pager";
    pager.dataset.key = sectionKey;
    gridEl.after(pager);
  }
  return pager;
}

// Rendu d'une page
function renderPagedGrid({ grid, items, renderFn, page, pageSize, pager, sectionKey, afterRender }) {
  const total  = items.length;
  const pages  = Math.max(1, Math.ceil(total / pageSize));
  const p      = Math.min(Math.max(1, Number(page) || 1), pages);
  const start  = (p - 1) * pageSize;
  const slice  = items.slice(start, start + pageSize);

  // Reset d'état
  grid.classList.remove("pager-ready");

  // Injecte la page
  grid.innerHTML = slice.map(renderFn).join("");

  // Révèle les cartes au frame suivant (force inline)
  requestAnimationFrame(() => {
    grid.classList.add("pager-ready");
    grid.querySelectorAll(".series-card").forEach((el, i) => {
      // supprime d'éventuelles classes de masquage connues
      el.classList.remove("hidden", "invisible", "is-hidden", "card-hidden", "fade-start");
      // force l'affichage
      el.style.opacity = "1";
      el.style.transform = "none";
      el.style.visibility = "visible";
      el.style.transition = "opacity .22s ease, transform .22s ease";
    });
  });

  if (typeof afterRender === "function") afterRender(grid);

  // --- Pager ---
  if (pages <= 1) { pager.innerHTML = ""; return; }

  const btn = (label, act, disabled = false) =>
    `<button type="button" class="pager-btn" data-act="${act}" ${disabled ? "disabled" : ""}>${label}</button>`;
  const pageBtn = (n, active) =>
    `<button type="button" class="pager-num ${active ? "is-active" : ""}" data-page="${n}">${n}</button>`;

  const maxNums = 7;
  let first = Math.max(1, p - Math.floor(maxNums / 2));
  let last  = Math.min(pages, first + maxNums - 1);
  first     = Math.max(1, last - maxNums + 1);

  let numsHtml = "";
  if (first > 1) {
    numsHtml += pageBtn(1, p === 1);
    if (first > 2) numsHtml += `<span class="pager-ellipsis">…</span>`;
  }
  for (let i = first; i <= last; i++) numsHtml += pageBtn(i, i === p);
  if (last < pages) {
    if (last < pages - 1) numsHtml += `<span class="pager-ellipsis">…</span>`;
    numsHtml += pageBtn(pages, p === pages);
  }

  pager.innerHTML =
    `${btn("«", "first", p === 1)}${btn("‹", "prev", p === 1)}<div class="pager-nums">${numsHtml}</div>${btn("›", "next", p === pages)}${btn("»", "last", p === pages)}`;

  // Events
  pager.onclick = (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.page) {
      setPage(sectionKey, parseInt(t.dataset.page, 10));
    } else {
      const act = t.dataset.act;
      if (act === "first") setPage(sectionKey, 1);
      else if (act === "prev") setPage(sectionKey, p - 1);
      else if (act === "next") setPage(sectionKey, p + 1);
      else if (act === "last") setPage(sectionKey, pages);
      else return;
    }
    renderPagedGrid({ grid, items, renderFn, page: getPage(sectionKey), pageSize, pager, sectionKey, afterRender });
  };
}

// Montage d'une section paginée (réutilisable)
function mountPagedSection({ grid, items, renderFn, sectionKey, pageSize = 5, afterRender }) {
  if (!grid) return;
  const pager = ensurePager(grid, sectionKey);
  const page  = getPage(sectionKey);
  renderPagedGrid({ grid, items, renderFn, page, pageSize, pager, sectionKey, afterRender });
}

// --- LOGIQUE DU HERO CAROUSEL ---

function renderHeroSlide(series) {
  const seriesData = series.data;
  const jsonFilename = series.filename;
  const heroColor = series.color;
  const heroColorRgb = hexToRgb(heroColor);

  const seriesSlug = slugify(seriesData.title);

    const chaptersArray = Object.entries(seriesData.chapters)
    .map(([chapNum, chapData]) => ({ chapter: chapNum, ...chapData }))
    // lisible si: Manga (group) OU Light Novel (file)
    .filter((chap) => (chap.groups && chap.groups.LesPoroïniens) || chap.file)
    .sort(
      (a, b) =>
        parseFloat(String(b.chapter).replace(",", ".")) -
        parseFloat(String(a.chapter).replace(",", "."))
    );
  const latestChapter = chaptersArray.length > 0 ? chaptersArray[0] : null;

  // Boutons
  let latestChapterButtonHtml = "";
  if (latestChapter) {
    latestChapterButtonHtml = `<a href="/${seriesSlug}/${String(latestChapter.chapter)}" class="hero-cta-button">Dernier chapitre (Ch. ${latestChapter.chapter})</a>`;
  }
  let latestEpisodeButtonHtml = "";
  if (seriesData.episodes && seriesData.episodes.length > 0) {
    const latestEpisode = [...seriesData.episodes].sort(
      (a, b) => b.indice_ep - a.indice_ep
    )[0];
    if (latestEpisode) {
      latestEpisodeButtonHtml = `<a href="/${seriesSlug}/episodes/${latestEpisode.indice_ep}" class="hero-cta-button-anime">Dernier épisode (Ep. ${latestEpisode.indice_ep})</a>`;
    }
  }

  // Statut + pastille (desktop)
  let statusText = seriesData.release_status || "En cours";
  let statusDotClass = statusText.toLowerCase().includes("fini") ? "status-dot finished" : "status-dot";
  let statusHtml = `
    <span class="status">
      <span class="${statusDotClass}"></span>
      ${statusText}
    </span>
  `;

  // Bloc info desktop
  let latestInfoHtml = "";
  if (latestChapterButtonHtml || latestEpisodeButtonHtml) {
    latestInfoHtml = `
      <div class="hero-latest-info">
        ${latestChapterButtonHtml}
        ${latestEpisodeButtonHtml}
        ${statusHtml}
      </div>
    `;
  }

  // Bloc info mobile (statut sous tags, boutons en bas)
  let mobileStatusHtml = `
    <div class="hero-mobile-status">
      <span class="status">
        <span class="${statusDotClass}"></span>
        ${statusText}
      </span>
    </div>
  `;
  let mobileActionsHtml = `
    <div class="hero-mobile-actions">
      ${latestChapterButtonHtml}
      ${latestEpisodeButtonHtml}
    </div>
  `;

  const backgroundImageUrl = seriesData.cover || "/img/placeholder_preview.png";
  const characterImageUrl = `/img/reco/${jsonFilename.replace(
    ".json",
    ".png"
  )}`;
  const description = seriesData.description
    ? seriesData.description.replace(/"/g, "&quot;")
    : "Aucune description.";

  const typeTag = seriesData.os
    ? `<span class="tag" style="background-color: rgba(${heroColorRgb}, 0.25); border-color: rgba(${heroColorRgb}, 0.5); color: ${heroColor};">One-Shot</span>`
    : `<span class="tag" style="background-color: rgba(${heroColorRgb}, 0.25); border-color: rgba(${heroColorRgb}, 0.5); color: ${heroColor};">Série</span>`;

  return `
    <div class="hero-slide" style="--bg-image: url('${backgroundImageUrl}'); --hero-color: ${heroColor}; --hero-color-rgb: ${heroColorRgb};">
      <div class="hero-slide-content">
        <div class="hero-info">
          <div class="hero-info-top">
            <p class="recommended-title">Recommandé</p>
            <a href="/${seriesSlug}" class="hero-title-link">
              <h2 class="hero-series-title">${seriesData.title}</h2>
            </a>
            <div class="hero-tags">
              ${typeTag}
              ${(seriesData.tags || [])
                .slice(0, 4)
                .map((tag) => `<span class="tag">${tag}</span>`)
                .join("")}
            </div>
            <div class="hero-mobile-status mobile-only">
              ${mobileStatusHtml}
            </div>
            <p class="hero-description">${description}</p>
          </div>
          <div class="hero-actions">
            ${latestInfoHtml}
          </div>
          <div class="hero-mobile-actions mobile-only">
            ${mobileActionsHtml}
          </div>
        </div>
        <div class="hero-image">
          <img src="${characterImageUrl}" alt="${seriesData.title}" onerror="this.style.display='none'">
        </div>
      </div>
    </div>
  `;
}

async function initHeroCarousel() {
  const track = qs(".hero-carousel-track");
  const navContainer = qs(".hero-carousel-nav");
  const nextBtn = qs(".hero-carousel-arrow.next");
  const prevBtn = qs(".hero-carousel-arrow.prev");

  if (!track || !navContainer || !nextBtn || !prevBtn) return;

  try {
    const recommendedItems = await fetchData("/data/reco.json");
    if (!recommendedItems || recommendedItems.length === 0)
      throw new Error("reco.json est vide ou introuvable.");

    const seriesDataPromises = recommendedItems.map(async (item) => {
      const data = await fetchData(`/data/series/${item.file}`);
      return { data, filename: item.file, color: item.color };
    });
    const recommendedSeries = await Promise.all(seriesDataPromises);

    track.innerHTML = recommendedSeries.map(renderHeroSlide).join("");
    navContainer.innerHTML = recommendedSeries
      .map(
        (_, index) => `<div class="hero-nav-dot" data-index="${index}"></div>`
      )
      .join("");

    const slides = qsa(".hero-slide");
    const dots = qsa(".hero-nav-dot");
    if (slides.length <= 1) {
      nextBtn.style.display = "none";
      prevBtn.style.display = "none";
      navContainer.style.display = "none";
      if (slides.length === 1) slides[0].classList.add("active");
      return;
    }

    let currentIndex = 0;
    let autoPlayInterval = null;

    function goToSlide(index) {
      slides.forEach((slide) => slide.classList.remove("active"));
      dots.forEach((dot) => dot.classList.remove("active"));
      slides[index].classList.add("active");
      dots[index].classList.add("active");
    }

    function next() {
      currentIndex = (currentIndex + 1) % slides.length;
      goToSlide(currentIndex);
    }

    function prev() {
      currentIndex = (currentIndex - 1 + slides.length) % slides.length;
      goToSlide(currentIndex);
    }

    function startAutoPlay() {
      if (autoPlayInterval) clearInterval(autoPlayInterval);
      autoPlayInterval = setInterval(next, 5000);
    }

    function stopAutoPlay() {
      clearInterval(autoPlayInterval);
    }

    nextBtn.addEventListener("click", () => {
      next();
      stopAutoPlay();
      startAutoPlay();
    });
    prevBtn.addEventListener("click", () => {
      prev();
      stopAutoPlay();
      startAutoPlay();
    });
    navContainer.addEventListener("click", (e) => {
      const dot = e.target.closest(".hero-nav-dot");
      if (dot) {
        currentIndex = parseInt(dot.dataset.index);
        goToSlide(currentIndex);
        stopAutoPlay();
        startAutoPlay();
      }
    });

    qs(".hero-carousel").addEventListener("mouseenter", stopAutoPlay);
    qs(".hero-carousel").addEventListener("mouseleave", startAutoPlay);

    goToSlide(0);
    startAutoPlay();
  } catch (error) {
    console.error("Erreur lors de l'initialisation du hero carousel:", error);
    qs("#hero-section").innerHTML =
      '<p style="text-align: center; padding: 2rem;">Impossible de charger les recommandations.</p>';
  }
}

function renderAnimeCard(anime) {
  if (!anime) return "";

  const seriesSlug = slugify(
    (anime && (anime.title || anime.seriesTitle)) || ""
  ) || (anime.slug ? slugify(anime.slug) : "");

  const detailUrl  = `/${seriesSlug}/episodes`;
  const imageUrl   = anime.cover || "/img/placeholder_preview.png";

  const studiosTxt = Array.isArray(anime.studios) ? anime.studios.join(", ") : (anime.studios || "");
  const yearTxt    = anime.year ? `<strong>Année :</strong> ${anime.year}` : "";

  const authorYearLineHtml = `
    <div class="meta series-author-year-line">
      ${studiosTxt ? `<span class="series-author-info"><strong>Studio :</strong> ${studiosTxt}</span>` : ""}
      ${studiosTxt && yearTxt ? `<span class="meta-separator-card"></span>` : ""}
      ${yearTxt ? `<span class="series-year-info">${yearTxt}</span>` : ""}
    </div>
  `;

  const tagsHtml = Array.isArray(anime.tags) && anime.tags.length
    ? `<div class="tags series-tags">${anime.tags.map(t => `<span class="tag">${t}</span>`).join("")}</div>`
    : "";

  // --- Badge spécifique ANIME ---
  // Cherche d'abord sur anime.vignette_anime, puis sur éventuel anime.series.vignette_anime
  const v = (anime && anime.vignette_anime) || (anime?.series && anime.series.vignette_anime) || null;
  let badgeHtml = "";
  if (v && v.text) {
    // hexToRgb est défini en haut de ton fichier (je l’ai vu) :contentReference[oaicite:0]{index=0}
    const color = (typeof v.color === "string" && v.color.startsWith("#")) ? v.color : "#10e0c1";
    const rgb   = hexToRgb(color);
    badgeHtml = `<span class="series-badge" style="--badge-color:${color};--badge-rgb:${rgb};">${v.text}</span>`;
  }

  // 3 derniers épisodes par date
  const eps = Array.isArray(anime.episodes) ? anime.episodes.slice() : [];
  const last3 = eps.map(e => {
      const ts = parseDateToTimestamp(e.date || e.release_date || 0);
      return { ...e, ts };
    })
    .sort((a,b) => b.ts - a.ts)
    .slice(0,3);

  const latestThreeChaptersHtml = last3.length ? `
    <div class="series-latest-chapters-container-desktop">
      ${last3.map(ep => `
        <a href="${detailUrl}" class="series-chapter-item-desktop">
          <span class="chapter-number-desktop">Ep. ${ep.index ?? "?"}</span>
          <span class="chapter-title-desktop" title="${ep.title || "Sans titre"}">${truncateText(ep.title || "Sans titre", 30)}</span>
          <span class="chapter-date-desktop">${timeAgo(ep.ts)}</span>
        </a>
      `).join("")}
    </div>` : "";

  const latestMobile = last3[0] ? `
    <div class="series-latest-chapters-container-mobile">
      <a href="${detailUrl}" class="series-chapter-item">
        <div class="series-chapter-item-main-info-mobile">
          <span class="chapter-number-small">Ep. ${last3[0].index ?? "?"}</span>
          <span class="chapter-title-small">${truncateText(last3[0].title || "Sans titre", 25)}</span>
        </div>
        <span class="chapter-date-small-mobile">${timeAgo(last3[0].ts)}</span>
      </a>
    </div>` : "";

  const descHtml = anime.description ? `<div class="series-description">${anime.description}</div>` : "";

  // rendu final (badge placé AU-DESSUS de l’image, dans .series-cover)
  return `
    <div class="series-card" data-url="${detailUrl}">
      <div class="series-cover">
        ${badgeHtml}
        <img src="${imageUrl}" alt="${anime.title}" loading="lazy" referrerpolicy="no-referrer">
      </div>
      <div class="series-info">
        <div class="series-title">${anime.title}</div>
        ${authorYearLineHtml}
        ${tagsHtml}
        ${descHtml}
        ${latestMobile}
        ${latestThreeChaptersHtml}
      </div>
    </div>
  `;
}

// --- LOGIQUE EXISTANTE POUR LES GRILLES DE SÉRIES ---

function renderSeriesCard(series) {
  if (!series || !series.chapters || !series.title || !series.cover) return "";

  const seriesSlug = slugify(series.title);

  // NEW: vignette (depuis la racine ou .series)
  const v = series.vignette || series.series?.vignette;
  let badgeHtml = "";
  if (v && v.text) {
    const color = v.color || "#10e0c1";
    const rgb = hexToRgb(color); // déjà défini en haut du fichier
    badgeHtml = `<span class="series-badge" style="--badge-color:${color};--badge-rgb:${rgb};">${v.text}</span>`;
  }

  const chaptersArray = Object.entries(series.chapters)
    .map(([chapNum, chapData]) => {
      const hasManga = !!(chapData?.groups && chapData.groups.LesPoroïniens);
      const hasLN    = !!chapData?.file;
      const readable = hasManga || hasLN;
      return {
        chapter: chapNum,
        ...chapData,
        last_updated_ts: parseDateToTimestamp(chapData?.last_updated || 0),
        url: readable ? `/${seriesSlug}/${String(chapNum)}` : null,
      };
    })
    .filter(chap => !!chap.url)
    .sort((a, b) => b.last_updated_ts - a.last_updated_ts);

  let latestChapterAsButton = "",
    latestThreeChaptersHtml = "";
  if (chaptersArray.length > 0) {
    const latestChap = chaptersArray[0];
    const chapterTitleMobile = latestChap.title || "Titre inconnu";
    const truncatedTitleMobile = truncateText(chapterTitleMobile, 25);

    latestChapterAsButton = `
      <div class="series-latest-chapters-container-mobile">
        <a href="${latestChap.url}" class="series-chapter-item">
          <div class="series-chapter-item-main-info-mobile">
            <span class="chapter-number-small">Ch. ${latestChap.chapter}</span>
            <span class="chapter-title-small" title="${chapterTitleMobile}">${truncatedTitleMobile}</span>
          </div>
          <span class="chapter-date-small-mobile">${timeAgo(
            latestChap.last_updated_ts
          )}</span>
        </a>
      </div>`;

    latestThreeChaptersHtml = `
      <div class="series-latest-chapters-container-desktop">
        ${chaptersArray
          .slice(0, 3)
          .map((chap) => {
            const chapterTitleDesktop = chap.title || "Titre inconnu";
            const truncatedTitleDesktop = truncateText(chapterTitleDesktop, 30);
            return `
            <a href="${chap.url}" class="series-chapter-item-desktop">
              <span class="chapter-number-desktop">Ch. ${chap.chapter}</span>
              <span class="chapter-title-desktop" title="${chapterTitleDesktop}">${truncatedTitleDesktop}</span>
              <span class="chapter-date-desktop">${timeAgo(
                chap.last_updated_ts
              )}</span>
            </a>`;
          })
          .join("")}
      </div>`;
  }

  const descriptionHtml = series.description
    ? `<div class="series-description">${series.description}</div>`
    : "";
  let authorString = "";
  if (series.author && series.artist && series.author !== series.artist)
    authorString = `<strong>Auteur :</strong> ${series.author} / <strong>Dess. :</strong> ${series.artist}`;
  else if (series.author)
    authorString = `<strong>Auteur :</strong> ${series.author}`;
  else if (series.artist)
    authorString = `<strong>Dess. :</strong> ${series.artist}`;
  let yearString = series.release_year
    ? `<strong>Année :</strong> ${series.release_year}`
    : "";
  let authorYearLineHtml =
    authorString || yearString
      ? `<div class="meta series-author-year-line">${
          authorString
            ? `<span class="series-author-info">${authorString}</span>`
            : ""
        }${
          authorString && yearString
            ? `<span class="meta-separator-card"></span>`
            : ""
        }${
          yearString
            ? `<span class="series-year-info">${yearString}</span>`
            : ""
        }</div>`
      : "";
  let tagsHtml =
    Array.isArray(series.tags) && series.tags.length > 0
      ? `<div class="tags series-tags">${series.tags
          .map((t) => `<span class="tag">${t}</span>`)
          .join("")}</div>`
      : "";
  const detailPageUrl = `/${seriesSlug}`;
  const imageUrl = series.cover
    ? series.cover.includes("comick.pictures")
      ? `${series.cover.slice(0, -4)}-s.jpg`
      : series.cover
    : "img/placeholder_preview.png";

  // NEW: badgeHtml placé DANS .series-cover, au-dessus de l’image
  return `
    <div class="series-card" data-url="${detailPageUrl}">
      <div class="series-cover">
        ${badgeHtml}
        <img src="${imageUrl}" alt="${series.title} – Cover" loading="lazy">
      </div>
      <div class="series-info">
        <div class="series-title">${series.title}</div>
        ${authorYearLineHtml}
        ${tagsHtml}
        ${descriptionHtml}
        ${latestChapterAsButton}
        ${latestThreeChaptersHtml}
      </div>
    </div>`;
}

function makeSeriesCardsClickable() {
  qsa(".series-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (
        e.target.closest(".series-chapter-item, .series-chapter-item-desktop")
      )
        return;
      const url = card.dataset.url;
      if (url) window.location.href = url;
    });
  });
}

// Renvoie le plus grand timestamp d'une série (chapitres ou fallback série)
function getLastUpdateStamp(series) {
  // Certains de tes JSON ont la série dans { series: {...} }, on couvre les deux cas
  const s = series?.series || series;
  const chapters = s?.chapters || {};
  let ts = 0;

  // 1) on regarde tous les chapitres
  for (const k of Object.keys(chapters)) {
    const ch = chapters[k] || {};
    const candidates = [
      ch.last_updated,    // ce que tu utilises le plus souvent
      ch.lastUpdate,
      ch.updated_at,
      ch.date,
      ch.time,
      ch.timestamp
    ];
    for (const v of candidates) {
      const n = Number(v);
      if (Number.isFinite(n) && n > ts) ts = n;
    }
  }

  // 2) fallback au niveau série si on n'a rien trouvé
  const seriesLevelCandidates = [
    s?.last_updated, s?.updated_at, s?.lastUpdate, s?.release_time
  ];
  for (const v of seriesLevelCandidates) {
    const n = Number(v);
    if (Number.isFinite(n) && n > ts) ts = n;
  }

  return ts || 0;
}

// Trie desc. (du plus récent au plus ancien)
function sortSeriesByNewest(list) {
  return [...list].sort((a, b) => getLastUpdateStamp(b) - getLastUpdateStamp(a));
}

function isDoujinshi(s)   { return !!(s && s.doujinshi === true); }
function isPornwha(s)     { return !!(s && s.pornwha === true); }
function isLightNovel(s)  { return !!(s && (s.light_novel === true || s.lightNovel === true)); } // alias toléré

export async function initHomepage() {
  // 1) Conteneurs DOM
  const seriesGridOngoing    = qs(".series-grid.on-going");
  const seriesGridOneShot    = qs(".series-grid.one-shot");
  const seriesGridDoujin     = qs(".series-grid.doujinshi");
  const seriesGridPornwha    = qs(".series-grid.pornwha");
  const seriesGridLightNovel = qs(".series-grid.light-novel");
  const seriesGridAnime      = qs(".series-grid.anime"); // ⬅️ nouveau

  // +18: local flag
  const ADULT_KEY = "adult_on";
  const adultEnabled = () => localStorage.getItem(ADULT_KEY) === "1";

  const isPornographicSeries = (s) => {
    const mt = (s?.series?.manga_type ?? s?.manga_type ?? "").toLowerCase();
    return mt === "pornographique";
  };

  const rerunCardEnhancers = (root) => {
    qsa(".series-card .series-tags", root).forEach(c => limitVisibleTags(c, 3, "plusN"));
    makeSeriesCardsClickable();
  };

  // 2) Carrousel
  await initHeroCarousel();

  // 2.5) Monte la grille ANIME (indépendante du reste)
  if (seriesGridAnime) {
    try {
      const animeItems = await fetchAllAnimeData();
      const showAdult = adultEnabled(); // même helper que pour les autres sections
      const animeFiltered = showAdult ? animeItems : animeItems.filter(a => !a.pornographic);

      // helper: parse robuste (secondes/ms/ISO)
      const __ts = (v) => {
        if (v == null || v === "") return 0;
        if (typeof v === "number") return v < 1e12 ? v * 1000 : v; // s -> ms
        const t = Date.parse(String(v));
        return Number.isFinite(t) ? t : 0;
      };

      // renvoie le timestamp du DERNIER épisode publié pour un anime
      const latestEpisodeTs = (a) => {
        const eps = Array.isArray(a.seasons)
          ? a.seasons.flatMap(s => s.episodes || [])
          : (Array.isArray(a.episodes) ? a.episodes : []);

        let max = 0;
        for (const e of eps) {
          const raw = e.ts ?? e.date ?? e.date_ep ?? e.release_date ?? null;
          const t = __ts(raw);
          if (t > max) max = t;
        }
        return max;
      };

      // 👉 tri du plus récent au plus ancien
      const animeSorted = [...animeFiltered].sort((a, b) => latestEpisodeTs(b) - latestEpisodeTs(a));

      mountPagedSection({
        grid: seriesGridAnime,
        items: animeSorted,
        renderFn: renderAnimeCard,
        sectionKey: "anime",
        pageSize: 5,
        afterRender: rerunCardEnhancers
      });
    } catch (e) {
      console.error("Anime grid error:", e);
      seriesGridAnime.innerHTML = "<p>Aucun anime.</p>";
    }
  }

  try {
    // 3) Charger (séries/LN/doujin/pornwha)
    const allSeries = await fetchAllSeriesData();
    if (!Array.isArray(allSeries) || allSeries.length === 0) {
      if (seriesGridOngoing)    seriesGridOngoing.innerHTML    = "<p>Aucune série en cours.</p>";
      if (seriesGridOneShot)    seriesGridOneShot.innerHTML    = "<p>Aucun one-shot.</p>";
      if (seriesGridDoujin)     seriesGridDoujin.innerHTML     = "<p>Aucun doujinshi.</p>";
      if (seriesGridPornwha)    seriesGridPornwha.innerHTML    = "<p>Aucun pornwha.</p>";
      if (seriesGridLightNovel) seriesGridLightNovel.innerHTML = "<p>Aucun light novel.</p>";
      // on ne return pas : la section Anime a déjà été montée ci-dessus
    }

    const showAdult = adultEnabled();

    if (!showAdult) {
      const doujSec = document.getElementById("doujinshi-section");
      const pornSec = document.getElementById("pornwha-section");
      if (doujSec) doujSec.style.display = "none";
      if (pornSec) pornSec.style.display = "none";
    }

    const doujinList     = allSeries.filter(s => isDoujinshi(s));
    const pornwhaList    = allSeries.filter(s => isPornwha(s)    && !isDoujinshi(s));
    const lightNovelList = allSeries.filter(s => isLightNovel(s) && !isDoujinshi(s) && !isPornwha(s));
    const oneShots       = allSeries.filter(s => s && s.os === true  && !isDoujinshi(s) && !isPornwha(s) && !isLightNovel(s));
    const onGoingSeries  = allSeries.filter(s => s && s.os !== true  && !isDoujinshi(s) && !isPornwha(s) && !isLightNovel(s));

    const onGoingSorted    = sortSeriesByNewest(onGoingSeries);
    const oneShotsSorted   = sortSeriesByNewest(oneShots);
    const doujinSorted     = sortSeriesByNewest(doujinList);
    const pornwhaSorted    = sortSeriesByNewest(pornwhaList);
    const lightNovelSorted = sortSeriesByNewest(lightNovelList);

    const doujinListF  = showAdult ? doujinSorted  : [];
    const pornwhaListF = showAdult ? pornwhaSorted : [];
    const lightNovelListF = lightNovelSorted.filter(s => showAdult || !isPornographicSeries(s));

    const PAGE_SIZE = 5;

    if (seriesGridOngoing) {
      mountPagedSection({
        grid: seriesGridOngoing,
        items: onGoingSorted,
        renderFn: renderSeriesCard,
        sectionKey: "ongoing",
        pageSize: PAGE_SIZE,
        afterRender: rerunCardEnhancers
      });
    }
    if (seriesGridOneShot) {
      mountPagedSection({
        grid: seriesGridOneShot,
        items: oneShotsSorted,
        renderFn: renderSeriesCard,
        sectionKey: "oneshot",
        pageSize: PAGE_SIZE,
        afterRender: rerunCardEnhancers
      });
    }
    if (seriesGridDoujin) {
      mountPagedSection({
        grid: seriesGridDoujin,
        items: doujinListF,
        renderFn: renderSeriesCard,
        sectionKey: "doujin",
        pageSize: PAGE_SIZE,
        afterRender: rerunCardEnhancers
      });
    }
    if (seriesGridPornwha) {
      mountPagedSection({
        grid: seriesGridPornwha,
        items: pornwhaListF,
        renderFn: renderSeriesCard,
        sectionKey: "pornwha",
        pageSize: PAGE_SIZE,
        afterRender: rerunCardEnhancers
      });
    }
    if (seriesGridLightNovel) {
      mountPagedSection({
        grid: seriesGridLightNovel,
        items: lightNovelListF,
        renderFn: renderSeriesCard,
        sectionKey: "lightnovel",
        pageSize: PAGE_SIZE,
        afterRender: rerunCardEnhancers
      });
    }
  } catch (error) {
    console.error("🚨 Erreur init homepage:", error);
    if (seriesGridOngoing)    seriesGridOngoing.innerHTML    = "<p>Erreur chargement séries.</p>";
    if (seriesGridOneShot)    seriesGridOneShot.innerHTML    = "<p>Erreur chargement one-shots.</p>";
    if (seriesGridDoujin)     seriesGridDoujin.innerHTML     = "<p>Erreur chargement doujinshi.</p>";
    if (seriesGridPornwha)    seriesGridPornwha.innerHTML    = "<p>Erreur chargement pornwha.</p>";
    if (seriesGridLightNovel) seriesGridLightNovel.innerHTML = "<p>Erreur chargement light novel.</p>";
  }

  window.addEventListener("adult-visibility-changed", () => location.reload());
}
