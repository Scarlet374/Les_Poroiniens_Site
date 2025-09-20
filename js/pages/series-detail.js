// js/pages/series-detail.js
import { slugify, qs } from "../utils/domUtils.js";
import { fetchData, fetchAllSeriesData, fetchSeriesDataBySlug  } from "../utils/fetchUtils.js";
import { renderMangaView } from "./series-detail/mangaView.js";
import {
  renderEpisodesListView,
  renderEpisodePlayerView,
} from "./series-detail/animeView.js"; 
import { renderGameView } from "./series-detail/gameView.js";

export async function initSeriesDetailPage() {
  const seriesDetailSection = qs("#series-detail-section");
  if (!seriesDetailSection) return;

  try {
    const dataPlaceholder = qs("#series-data-placeholder");
    if (
      !dataPlaceholder ||
      !dataPlaceholder.textContent ||
      dataPlaceholder.textContent.includes("SERIES_DATA_PLACEHOLDER")
    ) {
      throw new Error("Les données de la série n'ont pas été injectées dans la page.");
    }

    const currentSeriesData = JSON.parse(dataPlaceholder.textContent);
    const seriesSlug = slugify(currentSeriesData.title);

    if (!currentSeriesData) {
      seriesDetailSection.innerHTML = `<p>Données de la série non valides.</p>`;
      document.title = `Les Poroïniens – Série non trouvée`;
      return;
    }

    const initialPath = window.location.pathname;

    function handleRouting(path) {
      const segments = path.split("/").filter((p) => p !== "");
      let view = currentSeriesData.game ? "game" : "manga";
      let subViewIdentifier = null;

      if (segments.length > 1) {
        if (segments[1] === "episodes") {
          view = "episodes_list";
          if (segments.length > 2) {
            view = "episode_player";
            subViewIdentifier = segments[2];
          }
        } else if (segments[1] !== "cover") {
          view = "chapter_redirect";
          subViewIdentifier = segments[1];
        }
      }

      switch (view) {
        case "manga":
          renderMangaView(currentSeriesData, seriesSlug);
          // insère les recommandations une fois la vue rendue
          requestAnimationFrame(() => {
            renderRecommendations(currentSeriesData, seriesSlug);
          });
          break;
        
        case "game":
          renderGameView(currentSeriesData);
          // Si tu veux garder les recommandations sous la fiche jeu :
          requestAnimationFrame(() => {
            renderRecommendations(currentSeriesData, seriesSlug);
          });
          break;

        case "episodes_list":
          renderEpisodesListView(currentSeriesData, seriesSlug);
          break;

        case "episode_player":
          renderEpisodePlayerView(currentSeriesData, seriesSlug, subViewIdentifier);
          break;

        case "chapter_redirect":
          // Redirection gérée par le lecteur interne maintenant
          window.location.href = `/${seriesSlug}/${subViewIdentifier}`;
          break;
      }

      const routeChangeEvent = new CustomEvent("routeChanged", {
        detail: { path: path },
        bubbles: true,
        cancelable: true,
      });
      document.body.dispatchEvent(routeChangeEvent);
    }

    // --- GESTION DES ÉVÉNEMENTS DE NAVIGATION ---
    seriesDetailSection.addEventListener("click", (e) => {
      const link = e.target.closest("a");
      if (!link) return;

      const href = link.getAttribute("href");
      if (!href || href.startsWith("#") || link.target === "_blank") return;

      const isSpaLink =
        link.classList.contains("detail-nav-button") ||
        link.classList.contains("player-episode-item") ||
        link.classList.contains("episode-nav-button") ||
        link.classList.contains("detail-episode-item");

      if (isSpaLink) {
        e.preventDefault();
        if (href !== window.location.pathname) {
          history.pushState({ path: href }, "", href);
          handleRouting(href);
          window.scrollTo(0, 0);
        }
      }
    });

    window.addEventListener("popstate", () => {
      handleRouting(window.location.pathname);
    });

    // --- CHARGEMENT INITIAL ---
    handleRouting(initialPath);
  } catch (error) {
    console.error("🚨 Erreur lors de l'initialisation de la page de détail de série:", error);
    seriesDetailSection.innerHTML = `<p>Erreur lors du chargement des détails de la série. ${error.message}</p>`;
  }
}

/* ------------------------------------------------------------------ */
/* Recommandations (3 œuvres partageant des tags avec la série courante) */
/* ------------------------------------------------------------------ */

async function renderRecommendations(currentSeriesData, seriesSlug) {
  try {
    const host = qs("#series-detail-section");
    if (!host) return;

    // 👉 ancre : sous les chapitres (manga) OU sous la fiche JV (.gv), sinon à la fin
    const anchor = host.querySelector(".chapters-accordion-container, .gv") || host;

    // --- helpers +18 (mêmes règles que la homepage) ---
    const ADULT_KEY = "adult_on";
    const adultEnabled = () => localStorage.getItem(ADULT_KEY) === "1";
    const isPornographicSeries = (s) => {
      const mt = (s?.series?.manga_type ?? s?.manga_type ?? "").toLowerCase();
      return mt === "pornographique";
    };

    // image pour carte (manga + JV)
    const firstPreviewImage = (s) => {
      const p = s?.preview_image;
      if (!p) return null;
      if (Array.isArray(p)) return p.find(Boolean) || null;
      const keys = Object.keys(p).sort((a,b)=>parseInt(a,10)-parseInt(b,10));
      for (const k of keys) if (p[k]) return p[k];
      return null;
    };
    const cardImage = (s) => {
      let img = s?.cover || firstPreviewImage(s) || "/img/placeholder_preview.png";
      if (img && img.includes("comick.pictures")) img = img.replace(/\.(jpg|jpeg|png|webp)$/i, "-s.jpg");
      return img;
    };

    // ===== section =====
    let section = document.getElementById("recommendations-section");
    if (!section) {
      section = document.createElement("section");
      section.id = "recommendations-section";
      section.className = "series-section recommendations-section"; // ← classe attendue par ta CSS
      section.innerHTML = `
        <div class="reco-panel">
          <h3 class="section-title">Recommandations</h3>
          <div class="series-grid series-reco-grid"></div>
        </div>`;
      // 👉 on garde la section DANS #series-detail-section
      if (anchor === host) host.appendChild(section);
      else anchor.insertAdjacentElement("afterend", section);
    } else {
      section.querySelector(".series-reco-grid").innerHTML = "";
      section.style.display = "";
    }

    const showAdult = adultEnabled();

    // 1) lire l’index (tags)
    const idx = await fetchData("/data/search-index.json");
    const items = Array.isArray(idx) ? idx
                : Array.isArray(idx?.items) ? idx.items
                : Array.isArray(idx?.series) ? idx.series
                : [];
    if (!items.length) { section.style.display = "none"; return; }

    // 2) dataset complet (pour cover / flags)
    const allSeries = await fetchAllSeriesData();
    const bySlug = new Map(allSeries.map(s => [slugify(s.title || ""), s]));

    // 3) tags de la fiche courante
    const baseTags = new Set((currentSeriesData.tags || []).map(t => String(t).toLowerCase()));

    // 4) candidates: ≥1 tag commun, exclut la fiche courante
    let candidates = items.map(it => {
      const tags = (it.tags || []).map(t => String(t).toLowerCase());
      const slug = slugify(it.title || "");
      const overlap = tags.filter(t => baseTags.has(t)).length;
      return { slug, overlap };
    }).filter(x => x.slug && x.slug !== seriesSlug && x.overlap > 0);

    // 5) filtre +18 OFF
    if (!showAdult) {
      candidates = candidates.filter(x => {
        const s = bySlug.get(x.slug);
        if (!s) return false;
        if (isPornographicSeries(s)) return false;
        if (s.doujinshi === true) return false;
        if (s.pornwha === true) return false;
        return true;
      });
    }
    if (!candidates.length) { section.style.display = "none"; return; }

    // 6) priorité ≥2 tags communs
    const pool = candidates.filter(x => x.overlap >= 2);
    const source = pool.length >= 3 ? pool : candidates;

    // 7) shuffle & pick 3
    const arr = source.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    const chosen = arr.slice(0, 3);

    // 8) rendu des cartes
    const grid = section.querySelector(".series-reco-grid");
    grid.innerHTML = chosen.map(({ slug }) => {
      const serie = bySlug.get(slug);
      if (!serie) return "";
      const href = `/${slug}`;
      const imageUrl = cardImage(serie);
      const tagsHtml = Array.isArray(serie.tags) && serie.tags.length
        ? `<div class="tags series-tags">${serie.tags.slice(0,3).map(t => `<span class="tag">${t}</span>`).join("")}</div>`
        : "";
      return `
        <div class="series-card" data-url="${href}">
          <div class="series-cover">
            <img src="${imageUrl}" alt="${serie.title || slug}" loading="lazy"
                 onerror="this.src='/img/placeholder_preview.png'">
          </div>
          <div class="series-info">
            <div class="series-title">${serie.title || slug}</div>
            ${tagsHtml}
          </div>
        </div>`;
    }).join("");

    // cartes cliquables
    grid.querySelectorAll(".series-card").forEach(card => {
      card.addEventListener("click", (e) => {
        if (e.target.closest(".series-chapter-item, .series-chapter-item-desktop, a, button")) return;
        const url = card.dataset.url;
        if (url) window.location.href = url;
      });
    });

    // ✅ Forcer l’affichage (neutralise les classes/animations qui laissent l’opacité à 0)
    requestAnimationFrame(() => {
      const HIDDEN = ["hidden","invisible","is-hidden","card-hidden","fade-start","reveal-hidden","lazy-hidden","fade-in-up","sr-only","visually-hidden"];

      // titre + section
      const titleEl = section.querySelector(".section-title");
      [section, titleEl, grid].forEach(el => {
        if (!el) return;
        HIDDEN.forEach(c => el.classList.remove(c));
        el.style.opacity = "1";
        el.style.transform = "none";
        el.style.filter = "none";
      });

      // la grille utilise parfois un flag 'pager-ready' pour retirer l'opacité via CSS
      grid.classList.add("pager-ready");

      // chaque carte
      grid.querySelectorAll(".series-card").forEach(el => {
        HIDDEN.forEach(c => el.classList.remove(c));
        el.style.opacity = "1";
        el.style.transform = "none";
        el.style.filter = "none";
      });
    });


    // ✅ forcer visibilité du titre (si des classes d’animation restent)
    const titleEl = section.querySelector(".section-title");
    ["is-hidden","hidden","reveal-hidden","lazy-hidden","fade-in-up","sr-only","visually-hidden"].forEach(c => {
      section.classList.remove(c);
      titleEl?.classList.remove(c);
    });
    section.style.opacity = "";
    titleEl && (titleEl.style.opacity = "");

  } catch (e) {
    console.error("Reco error:", e);
  }
}