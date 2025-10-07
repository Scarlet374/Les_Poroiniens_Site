// js/index.js
import { loadComponent, qs } from "./utils/domUtils.js";
import {
  initHeader,
  setupMobileMenuInteractions,
} from "./components/header.js";
import { initMainScrollObserver } from "./components/observer.js";

async function initCommonComponents() {
  const headerPlaceholder = qs("#main-header");
  const mobileMenuPlaceholder = qs("#main-mobile-menu-overlay");
  const loadPromises = [];

  if (headerPlaceholder) {
    loadPromises.push(
      loadComponent(headerPlaceholder, "/includes/header.html")
    );
  } else {
    console.warn("Placeholder #main-header not found. Cannot load header.");
  }

  if (mobileMenuPlaceholder) {
    loadPromises.push(
      loadComponent(mobileMenuPlaceholder, "/includes/mobile-menu.html")
    );
  } else {
    console.warn(
      "Placeholder #main-mobile-menu-overlay not found. Cannot load mobile menu."
    );
  }

  if (loadPromises.length > 0) {
    try {
      await Promise.all(loadPromises);
      console.log("Common components (header/menu) loaded.");
    } catch (error) {
      console.error("Error loading one or more common components:", error);
    }
  }

  if (headerPlaceholder && headerPlaceholder.innerHTML.trim() !== "") {
    try {
      initHeader();
    } catch (e) {
      console.error("Error initializing header:", e);
    }
  }

  if (mobileMenuPlaceholder && mobileMenuPlaceholder.innerHTML.trim() !== "") {
    if (typeof setupMobileMenuInteractions === "function") {
      try {
        setupMobileMenuInteractions();
      } catch (e) {
        console.error("Error setting up mobile menu interactions:", e);
      }
    } else {
      console.error(
        "setupMobileMenuInteractions is not available or was not loaded correctly."
      );
    }
  }
}

async function routeAndInitPage() {
  const path = window.location.pathname;

  if (path === "/awards" || path === "/awards.html") {
    // on force l’id pour router sur awards
    document.body.id = "awardspage";
  }

  const bodyId = document.body.id;
  console.log(`Routing for path: "${path}", bodyId: "${bodyId}"`);

  switch (bodyId) {
    case "homepage":
      console.log("Initializing homepage.");
      const { initHomepage } = await import("./pages/homepage.js");
      await initHomepage();
      initMainScrollObserver();
      break;

    case "galeriepage":
      console.log("Initializing galerie page.");
      const { initGaleriePage } = await import("./pages/galerie.js");
      await initGaleriePage();
      initMainScrollObserver();
      break;

    case "presentationpage":
      console.log("Initializing presentation page.");
      const { initPresentationPage } = await import("./pages/presentation.js");
      initPresentationPage();
      initMainScrollObserver();
      break;

    case "seriescoverspage":
      console.log("Initializing series covers page.");
      const { initSeriesCoversPage } = await import("./pages/series-covers.js");
      await initSeriesCoversPage();
      initMainScrollObserver();
      break;

    case "seriesdetailpage":
      console.log("Initializing series detail page.");
      const { initSeriesDetailPage } = await import("./pages/series-detail.js");
      await initSeriesDetailPage();
      break;

    case "awardspage":
      console.log("Initializing awards page.");
      const { initAwardsPage } = await import("./pages/awards.js");
      await initAwardsPage();
      initMainScrollObserver();
      break;

    case "readerpage": {
      console.log("Initializing Reader page (auto-select LN or Manga).");

      const ph = document.querySelector("#reader-data-placeholder");
      let readerData = null;
      try {
        if (!ph || !ph.textContent || ph.textContent.includes("READER_DATA_PLACEHOLDER")) {
          throw new Error("Données lecteur absentes ou non injectées.");
        }
        readerData = JSON.parse(ph.textContent);
      } catch (e) {
        console.error("Impossible de lire #reader-data-placeholder:", e);
      }

      let isLN = false;
      if (readerData && readerData.series) {
        const s = readerData.series;
        const chap = s.chapters?.[readerData.chapterNumber];
        if (s.light_novel || s.lightNovel) isLN = true;
        if (chap && chap.file) isLN = true;   // fallback béton
      }
      console.log("LN detection →", isLN, readerData);

      try {
        if (isLN) {
          const { initNovelReader } = await import("/js/pages/series-detail/LNReader/reader.js");
          await initNovelReader();
        } else {
          const { initMangaReader } = await import("/js/pages/series-detail/MangaReader/reader.js");
          await initMangaReader();
        }
      } catch (err) {
        console.error("Erreur initialisation lecteur:", err);
        // ⚠️ ne JAMAIS retomber sur le lecteur manga si isLN === true
        if (!isLN) {
          try {
            const { initMangaReader } = await import("/js/pages/series-detail/MangaReader/reader.js");
            await initMangaReader();
          } catch (e2) {
            console.error("Fallback Manga reader failed:", e2);
          }
        }
      }
      break;
    }

    default:
      console.log(
        "Aucune logique JS spécifique pour cet ID de body ou route non reconnue:",
        bodyId,
        path
      );
      // On peut toujours appeler l'observer pour des pages inconnues qui pourraient avoir des éléments animables.
      initMainScrollObserver();
      break;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const bodyId = document.body.id;
  console.log("DOMContentLoaded event fired.");

  // On ne charge les composants communs (header/menu) que si ce n'est pas une page d'admin
  const isAdminPage =
    bodyId === "dashboardpage" ||
    window.location.pathname.startsWith("/admins");

  try {
    if (!isAdminPage) {
      await initCommonComponents();
    }
    await routeAndInitPage();
    console.log("Page initialization complete.");
  } catch (error) {
    console.error("Error during page initialization process:", error);
  }
});
