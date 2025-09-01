// js/pages/galerie.js
import { fetchData } from '../utils/fetchUtils.js';
import { parseDateToTimestamp, formatDateForGallery } from '../utils/dateUtils.js';
import { initLazyLoadObserver, initMainScrollObserver } from '../components/observer.js';
import { qs, qsa } from '../utils/domUtils.js';

// --- VARIABLES GLOBALES DU MODULE ---
let allColosData = [];
let authorsInfoData = {};
let selectedArtistIds = new Set();
let currentSortMode = 'date-desc'; // 'date-desc', 'date-asc', 'chapter-desc', 'chapter-asc'

// --- Série (état + helper) ---
let selectedSeriesSlug = "ALL";

function prettifySlug(slug = "") {
  return slug
    .split("_")
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

// --- SÉLECTEURS DOM ---
const galleryGridContainer = qs('#gallery-grid-container');
const totalCountSpan = qs('#colo-total-count');

// Nouveaux sélecteurs pour le filtre custom
const customFilter = qs('#custom-artist-filter');
const filterToggleBtn = qs('.custom-dropdown-toggle', customFilter);
const filterMenu = qs('.custom-dropdown-menu', customFilter);
const filterText = qs('#custom-filter-text', customFilter);

// Sélecteurs Lightbox
const lightboxModal = qs('#lightbox-modal');
const lightboxImg = qs('#lightbox-img');
const lightboxCloseBtn = qs('.lightbox-close');

// --- FONCTIONS DE RENDU ---

function renderColoCard(colo, author) {
  const authorName = author?.username || 'Artiste inconnu';
  const previewUrl = `https://file.garden/aKS5jUD-slfn6iFT/${colo.id}.webp`;

  const seriesTitle =
    (colo.series_title && String(colo.series_title).trim()) ||
    (colo.series_slug ? prettifySlug(String(colo.series_slug)) : "");

  return `
    <div class="colo-card" data-colo-id="${colo.id}">
      <img class="lazy-load-gallery"
           src="/img/placeholder_preview.png"
           alt="${seriesTitle ? seriesTitle + ' — ' : ''}Colorisation Chap. ${colo.chapitre || 'N/A'} par ${authorName}"
           data-src="${previewUrl}">
      <div class="colo-card-overlay">
        ${seriesTitle ? `<div class="series-pill">${seriesTitle}</div>` : ""}
        <p>Chap. ${colo.chapitre || 'N/A'}${colo.page ? `, Page ${colo.page}` : ''}</p>
        <p>Par ${authorName}</p>
      </div>
    </div>`;
}


function getSocialsHTML(links, typeClassPrefix) {
  if (!links || Object.values(links).every(val => !val)) return '';
  let html = `<div class="${typeClassPrefix}-socials">`;
  if (links.twitter) html += `<a href="${links.twitter}" target="_blank" rel="noopener noreferrer"><i class="fab fa-twitter"></i> Twitter</a>`;
  if (links.instagram) html += `<a href="${links.instagram}" target="_blank" rel="noopener noreferrer"><i class="fab fa-instagram"></i> Instagram</a>`;
  if (links.tiktok) html += `<a href="${links.tiktok}" target="_blank" rel="noopener noreferrer"><i class="fab fa-tiktok"></i> TikTok</a>`;
  if (links.reddit) html += `<a href="${links.reddit}" target="_blank" rel="noopener noreferrer"><i class="fab fa-reddit"></i> Reddit</a>`;
  html += '</div>';
  return html;
}

// --- LOGIQUE LIGHTBOX ---

function displayLightboxInfo(colo, author) {
  const desktopArtistBlock = qs('.lightbox-info-panel-desktop .lightbox-artist-info-block');
  const desktopColoBlock = qs('.lightbox-info-panel-desktop .lightbox-colo-info-block');
  const mobileArtistInfoContainer = qs('.lightbox-info-panel-mobile .lightbox-artist-info');
  const mobileColoInfoContainer = qs('.lightbox-info-panel-mobile .lightbox-colo-info');

  let artistHtmlContent = '<p class="lightbox-info-placeholder">Infos artiste non disponibles.</p>';
  if (author && colo) {
    const occurrenceCount = allColosData.filter(c => String(c.author_id) === String(colo.author_id)).length;
    artistHtmlContent = `
      <div class="artist-header">
        <img src="${author.profile_img || '/img/profil.png'}" alt="Photo de profil de ${author.username}" class="lightbox-artist-pfp" loading="lazy">
        <div class="artist-text-details">
          <h3 class="lightbox-artist-name">${author.username}</h3>
          <span class="artist-occurrence-count">(${occurrenceCount} colo${occurrenceCount > 1 ? 's' : ''})</span>
        </div>
      </div>
      ${getSocialsHTML(author, 'lightbox-artist')}
    `;
  }

  let coloHtmlContent = '<p class="lightbox-info-placeholder">Infos colorisation non disponibles.</p>';
  if (colo) {
    coloHtmlContent = `
      <p><strong>Chapitre :</strong> ${colo.chapitre || 'N/A'}${colo.page ? `, Page ${colo.page}` : ''}</p>
      <p><strong>Date :</strong> ${formatDateForGallery(colo.date)}</p>
      <p><strong>ID :</strong> ${colo.id}</p>
      ${getSocialsHTML(colo, 'lightbox-colo')}
    `;
  }

  if (desktopArtistBlock) desktopArtistBlock.innerHTML = artistHtmlContent;
  if (desktopColoBlock) desktopColoBlock.innerHTML = coloHtmlContent;
  if (mobileArtistInfoContainer) mobileArtistInfoContainer.innerHTML = artistHtmlContent;
  if (mobileColoInfoContainer) mobileColoInfoContainer.innerHTML = coloHtmlContent;
}

function openLightboxForId(coloId) {
  if (!coloId) return;
  const selectedColo = allColosData.find(c => c.id.toString() === coloId.toString());

  if (selectedColo && lightboxModal && lightboxImg) {
    lightboxImg.src = `https://file.garden/aKS5jUD-slfn6iFT/${selectedColo.id}.png`;
    const author = authorsInfoData[selectedColo.author_id];
    displayLightboxInfo(selectedColo, author);
    lightboxModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    history.replaceState({ coloId: coloId }, '', `/galerie/${coloId}`);
  }
}

function closeLightbox() {
  if (lightboxModal) lightboxModal.style.display = 'none';
  if (lightboxImg) lightboxImg.src = "";
  document.body.style.overflow = 'auto';

  if (window.location.pathname !== '/galerie' && window.location.pathname !== '/galerie/') {
    history.replaceState(null, '', '/galerie');
  }
}

// --- LOGIQUE FILTRE & AFFICHAGE ---

function updateFilterText() {
  if (!filterText) return;

  if (selectedArtistIds.size === 0) {
    filterText.textContent = "Tous les artistes";
  } else if (selectedArtistIds.size === 1) {
    const artistId = selectedArtistIds.values().next().value;
    filterText.textContent = authorsInfoData[artistId]?.username || "1 artiste sélectionné";
  } else {
    filterText.textContent = `${selectedArtistIds.size} artistes sélectionnés`;
  }
}

function populateCustomArtistFilter() {
  if (!filterMenu) return;

  const artistCounts = allColosData.reduce((acc, colo) => {
    acc[colo.author_id] = (acc[colo.author_id] || 0) + 1;
    return acc;
  }, {});

  const sortedAuthors = Object.entries(authorsInfoData)
    .sort(([, a], [, b]) => (a.username || "").localeCompare(b.username || ""));

  filterMenu.innerHTML = sortedAuthors.map(([id, author]) => {
    const count = artistCounts[id] || 0;
    if (count === 0) return '';

    // CORRECTION: L'input est maintenant un sibling avant le label.
    // L'id et le for les lient.
    return `
      <div class="custom-dropdown-option" role="option">
        <input type="checkbox" value="${id}" id="artist-filter-${id}">
        <label for="artist-filter-${id}">
          <img src="${author.profile_img || '/img/profil.png'}" class="artist-pfp" alt="Profil de ${author.username}" loading="lazy">
          <span class="artist-name">${author.username}</span>
          <span class="artist-count">${count}</span>
        </label>
      </div>`;
  }).join('');

  // L'event listener reste le même et fonctionnera correctement avec la nouvelle structure.
  qsa('input[type="checkbox"]', filterMenu).forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const artistId = e.target.value;
      if (e.target.checked) {
        selectedArtistIds.add(artistId);
      } else {
        selectedArtistIds.delete(artistId);
      }
      updateFilterText();
      displayColos();
    });
  });
}

function displayColos() {
  if (!galleryGridContainer || !allColosData.length || !Object.keys(authorsInfoData).length) {
    if (galleryGridContainer) {
      galleryGridContainer.innerHTML = "<p>Aucune colorisation à afficher.</p>";
    }
    if (totalCountSpan) totalCountSpan.textContent = "(0)";
    return;
  }

  // 1) Base
  let colosToDisplay = allColosData.slice();

  // 2) Filtre ARTISTE
  if (selectedArtistIds && selectedArtistIds.size > 0) {
    colosToDisplay = colosToDisplay.filter(c => selectedArtistIds.has(String(c.author_id)));
  }

  // 3) Filtre SÉRIE
  if (typeof selectedSeriesSlug !== "undefined" && selectedSeriesSlug !== "ALL") {
    colosToDisplay = colosToDisplay.filter(c => String(c.series_slug || "") === String(selectedSeriesSlug));
  }

  // 4) Tri
  switch (currentSortMode) {
    case "date-desc":
      colosToDisplay.sort((a, b) => parseDateToTimestamp(b.date) - parseDateToTimestamp(a.date));
      break;
    case "date-asc":
      colosToDisplay.sort((a, b) => parseDateToTimestamp(a.date) - parseDateToTimestamp(b.date));
      break;
    case "chapter-desc":
      colosToDisplay.sort((a, b) => (parseInt(b.chapitre) || 0) - (parseInt(a.chapitre) || 0));
      break;
    case "chapter-asc":
      colosToDisplay.sort((a, b) => (parseInt(a.chapitre) || 0) - (parseInt(b.chapitre) || 0));
      break;
    default:
      // rien
      break;
  }

  // 5) Rendu / message si vide
  if (colosToDisplay.length === 0) {
    galleryGridContainer.innerHTML = "<p>Aucun résultat pour ces filtres.</p>";
    if (totalCountSpan) totalCountSpan.textContent = "(0)";
    return;
  }

  galleryGridContainer.innerHTML = colosToDisplay.map(colo => {
    const author = authorsInfoData[colo.author_id];
    return renderColoCard(colo, author);
  }).join("");

  // 6) Interactions cartes (lightbox)
  qsa(".colo-card", galleryGridContainer).forEach(card => {
    if (!card.dataset.lightboxListenerAttached) {
      card.addEventListener("click", () => openLightboxForId(card.dataset.coloId));
      card.dataset.lightboxListenerAttached = "true";
    }
  });

  // 7) Lazy-load + scroll observer
  initLazyLoadObserver("img.lazy-load-gallery");
  initMainScrollObserver("#gallery-grid-container .colo-card");

  // 8) Masonry
  const masonry = new Masonry(galleryGridContainer, {
    itemSelector: ".colo-card",
    columnWidth: ".colo-card",
    percentPosition: true,
    gutter: 8,
    transitionDuration: 0,
    initLayout: false,
  });

  imagesLoaded(galleryGridContainer).on("progress", () => {
    masonry.layout();
  });

  // 9) Relayout opportuniste au chargement
  let relayoutInterval = setInterval(() => masonry.layout(), 500);
  setTimeout(() => clearInterval(relayoutInterval), 5000);

  // 10) Compteur affiché dans le titre
  if (totalCountSpan) {
    totalCountSpan.textContent = `(${colosToDisplay.length})`;
  }
}


function getSortModeText(mode) {
  switch(mode) {
    case 'date-desc': return 'Date (récent)';
    case 'date-asc': return 'Date (ancien)';
    case 'chapter-desc': return 'Chapitre (décroissant)';
    case 'chapter-asc': return 'Chapitre (croissant)';
    default: return 'Date (récent)';
  }
}

function updateSortMode(newMode) {
  if (['date-desc', 'date-asc', 'chapter-desc', 'chapter-asc'].includes(newMode)) {
    currentSortMode = newMode;
    // Update sort text and active state
    const sortText = qs('#custom-sort-text');
    if (sortText) {
      sortText.textContent = getSortModeText(newMode);
    }
    // Update active state in dropdown
    qsa('#custom-sort-filter .custom-dropdown-option').forEach(option => {
      option.classList.toggle('active', option.dataset.sort === newMode);
    });
    displayColos();
  }
}

// --- FONCTION D'INITIALISATION ---

export async function initGaleriePage() {
  if (!galleryGridContainer) {
    console.warn("[Galerie] Initialisation annulée: conteneur de la galerie non trouvé.");
    return;
  }

  // petit helper centralisé pour (re)rendre la grille + pastilles
  const rerenderGallery = () => {
    // ta fonction existante qui applique les filtres (artiste/tri) et remplit le DOM
    displayColos();
    // ajoute la pastille "titre de série" sur les cartes visibles
    try {
      const itemsForPill = (typeof applySeriesFilterToRender === "function")
        ? applySeriesFilterToRender(allColosData)
        : allColosData;
    } catch (e) {
      // si les helpers n'existent pas encore, on ignore silencieusement
      // console.debug("Series pill skipped:", e);
    }
  };

  try {
    const [colos, authors] = await Promise.all([
      fetchData('/data/colos/colos.json', { noCache: true }),
      fetchData('/data/colos/author_info.json', { noCache: true })
    ]);

    if (!colos || !authors) throw new Error("Données de colos ou d'auteurs manquantes.");

    allColosData = colos;
    authorsInfoData = authors;

    // === Série : construit la liste des séries (slug -> titre) et branche le dropdown ===
const seriesRoot  = document.getElementById("custom-series-filter");
const seriesBtn   = seriesRoot?.querySelector(".custom-dropdown-toggle");
const seriesMenu  = seriesRoot?.querySelector(".custom-dropdown-menu");
const seriesLabel = seriesRoot?.querySelector("#custom-series-text") || seriesBtn?.querySelector("span");

if (seriesRoot && seriesBtn && seriesMenu) {
  // 1) options
  const index = new Map(); // slug -> titre
  for (const c of allColosData) {
    if (!c?.series_slug) continue;
    const slug  = String(c.series_slug);
    const title = (c.series_title && String(c.series_title).trim()) || prettifySlug(slug);
    if (!index.has(slug)) index.set(slug, title);
  }
  // remet "Toutes les séries", puis ajoute les séries triées
  seriesMenu.innerHTML = `
    <div class="custom-dropdown-option" data-series="ALL" role="option">
      <i class="fas fa-layer-group"></i>
      <span class="series-name">Toutes les séries</span>
    </div>
  ` + Array.from(index.entries())
           .sort((a,b)=>a[1].localeCompare(b[1], "fr", {sensitivity:"base"}))
           .map(([slug,title]) => `
              <div class="custom-dropdown-option" data-series="${slug}" role="option">
                <i class="fas fa-book"></i>
                <span class="series-name">${title}</span>
              </div>
           `).join("");

  const setSeriesActive = (slug) => {
  seriesMenu.querySelectorAll(".custom-dropdown-option[data-series]")
    .forEach(opt => opt.classList.toggle("active", opt.dataset.series === slug));
};

  setSeriesActive(selectedSeriesSlug || "ALL");

  // 2) toggle open/close
  seriesBtn.addEventListener("click", () => {
    const isExpanded = seriesBtn.getAttribute("aria-expanded") === "true";
    seriesBtn.setAttribute("aria-expanded", String(!isExpanded));
    seriesMenu.classList.toggle("show");
  });
  document.addEventListener("click", (e) => {
    if (!seriesRoot.contains(e.target)) {
      seriesBtn.setAttribute("aria-expanded", "false");
      seriesMenu.classList.remove("show");
    }
  });

  // 3) choix d'une série -> filtre + re-render
  seriesMenu.addEventListener("click", (e) => {
    const opt = e.target.closest(".custom-dropdown-option[data-series]");
    if (!opt) return;
    selectedSeriesSlug = opt.dataset.series || "ALL";
    const txt = opt.querySelector(".series-name")?.textContent || "Toutes les séries";
    if (seriesLabel) seriesLabel.textContent = txt;

    // marque l’option comme active
    setSeriesActive(selectedSeriesSlug);

    seriesBtn.setAttribute("aria-expanded", "false");
    seriesMenu.classList.remove("show");
    displayColos(); // relance le rendu
  });
}

    if (totalCountSpan) {
      totalCountSpan.textContent = `(${allColosData.length})`;
    }

    // ➜ intègre le filtre SÉRIE (helpers déjà collés ailleurs)
    if (typeof initSeriesFilterForGallery === "function") {
      await initSeriesFilterForGallery(allColosData, rerenderGallery);
      // NB: si ta version de initSeriesFilterForGallery n'accepte pas de callback,
      // elle relancera elle-même render(); notre callback supplémentaire sera ignoré sans effet.
    }

    // Set up sort dropdown
    const sortFilter = qs('#custom-sort-filter');
    const sortToggleBtn = qs('.custom-dropdown-toggle', sortFilter);
    const sortMenu = qs('.custom-dropdown-menu', sortFilter);

    if (sortToggleBtn && sortMenu) {
      // Toggle dropdown
      sortToggleBtn.addEventListener('click', () => {
        const isExpanded = sortToggleBtn.getAttribute('aria-expanded') === 'true';
        sortToggleBtn.setAttribute('aria-expanded', !isExpanded);
        sortMenu.classList.toggle('show');
      });

      // Handle option clicks
      qsa('.custom-dropdown-option', sortMenu).forEach(option => {
        option.addEventListener('click', () => {
          updateSortMode(option.dataset.sort);
          sortToggleBtn.setAttribute('aria-expanded', 'false');
          sortMenu.classList.remove('show');
          // on relance le rendu pour refléter le nouveau tri + pastilles
          rerenderGallery();
        });
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!sortFilter.contains(e.target)) {
          sortToggleBtn.setAttribute('aria-expanded', 'false');
          sortMenu.classList.remove('show');
        }
      });
    }

    // Initialize sort state
    updateSortMode(currentSortMode);

    // filtre ARTISTE (ton existant)
    populateCustomArtistFilter();

    if (filterToggleBtn && filterMenu) {
      filterToggleBtn.addEventListener('click', () => {
        const isExpanded = filterToggleBtn.getAttribute('aria-expanded') === 'true';
        filterToggleBtn.setAttribute('aria-expanded', !isExpanded);
        filterMenu.classList.toggle('show');
      });

      document.addEventListener('click', (e) => {
        if (!customFilter.contains(e.target)) {
          filterToggleBtn.setAttribute('aria-expanded', 'false');
          filterMenu.classList.remove('show');
        }
      });
    }

    // Lightbox
    if (lightboxModal && lightboxCloseBtn) {
      lightboxCloseBtn.addEventListener('click', closeLightbox);
      lightboxModal.addEventListener('click', (e) => {
        if (e.target === lightboxModal) closeLightbox();
      });
    }

    window.addEventListener('popstate', (event) => {
      const path = window.location.pathname;
      const galleryPathMatch = path.match(/^\/galerie\/(\d+)\/?$/);
      if (galleryPathMatch) {
        openLightboxForId(galleryPathMatch[1]);
      } else {
        closeLightbox();
      }
    });

    // premier rendu + pastilles
    rerenderGallery();

    const galleryPathMatch = window.location.pathname.match(/^\/galerie\/(\d+)\/?$/);
    if (galleryPathMatch) {
      const coloIdFromUrl = galleryPathMatch[1];
      setTimeout(() => openLightboxForId(coloIdFromUrl), 100);
    }

  } catch (error) {
    console.error("Erreur d'initialisation de la galerie:", error);
    if (galleryGridContainer) {
      galleryGridContainer.innerHTML = `<p>Erreur lors du chargement de la galerie. Détails : ${error.message}</p>`;
    }
  }
}
