import {
    qs,
    qsa,
    slugify
} from "../utils/domUtils.js";

const mainNavLinksConfig = [{
        text: "Accueil",
        href: "/",
        icon: "fas fa-home",
        id: "home"
    },
    {
        text: "Fan-Arts",
        href: "/galerie",
        icon: "fa-solid fa-palette",
        id: "gallery",
    },
    // { text: "À propos", href: "/presentation", icon: "fas fa-user", id: "about" },
];

const subNavTitlesConfig = {
    homepage: "Sur cette page",
    seriesdetailpage: "Navigation Série",
    seriescoverspage: "Navigation Série",
};

const subNavLinksConfig = {
homepage: [
  { text: "À la une",   href: "#hero-section",       id: "hero" },
  { text: "Séries",     href: "#on-going-section",   id: "series" },
  { text: "One-Shot",   href: "#one-shot-section",   id: "oneshots" },
  { text: "Doujinshi",  href: "#doujinshi-section",  id: "doujinshi" },
  { text: "Pornwha",    href: "#pornwha-section",    id: "pornwha" },
  { text: "Light novel",href: "#lightnovel-section", id: "lightnovel" },
  { text: "Anime",      href: "#anime-section",      id: "anime" }, 
],
    galeriepage: [],
    presentationpage: [],
    seriesdetailpage: [],
    seriescoverspage: [],
};

function updateAllNavigation() {
    populateDesktopNavigation();
    populateMobileNavigation(); // Assure la cohérence si le menu mobile est ouvert pendant la navigation
    updateActiveNavLinks();
}

function getCurrentPageId() {
    return document.body.id || null;
}

function getCurrentSeriesSlugFromPath() {
    const path = window.location.pathname;
    const segments = path.split("/").filter(Boolean);
    if (segments.length > 0) {
        return segments[0];
    }
    return null;
}

function getCurrentSeriesViewFromPath() {
    const path = window.location.pathname;
    if (path.includes("/episodes")) {
        return "anime";
    }
    return "manga";
}

function renderNavLinks(container, links, isMobile = false) {
    if (!container) return;
    container.innerHTML = "";

    links.forEach((link) => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = link.href;
        if (link.id) {
            a.id = `navlink-${link.id}${isMobile ? "-mobile" : "-desktop"}`;
        }

        if (link.icon) {
            const i = document.createElement("i");
            i.className = link.icon;
            a.appendChild(i);
            a.appendChild(document.createTextNode(" "));
        }
        a.appendChild(document.createTextNode(link.text));
        li.appendChild(a);
        container.appendChild(li);
    });
}

function renderSubNavWithMore(container, links, maxVisible = 5) {
  if (!container) return;
  container.innerHTML = "";

  const visible = links.slice(0, maxVisible);
  const overflow = links.slice(maxVisible);

  // liens visibles
  visible.forEach((link) => {
    const li = document.createElement("li");
    const a  = document.createElement("a");
    a.href = link.href;
    if (link.id) a.id = `navlink-${link.id}-desktop`;
    a.textContent = link.text;
    li.appendChild(a);
    container.appendChild(li);
  });

  // menu “Plus” si nécessaire
  if (overflow.length) {
    const liMore   = document.createElement("li");
    liMore.className = "nav-more";
    liMore.innerHTML = `
      <button type="button" class="more-toggle" aria-expanded="false" aria-haspopup="true">Plus</button>
      <ul class="more-menu" role="menu"></ul>
    `;
    const menu = liMore.querySelector(".more-menu");
    overflow.forEach((link) => {
      const li  = document.createElement("li");
      const a   = document.createElement("a");
      a.href = link.href;
      if (link.id) a.id = `navlink-${link.id}-desktop`;
      a.textContent = link.text;
      li.appendChild(a);
      menu.appendChild(li);
    });
    container.appendChild(liMore);

    // interactions (ouvrir/fermer)
    const btn = liMore.querySelector(".more-toggle");
    const close = () => {
      liMore.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    };
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const open = !liMore.classList.contains("open");
      liMore.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("click", (e) => {
      if (!liMore.contains(e.target)) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  }
}

function getSubNavLinksForPage(pageId) {
    let baseLinks = [...(subNavLinksConfig[pageId] || [])];

    // ---- Cas des pages Série / Covers / Reader : on construit les liens contextuels
    if (
        pageId === "seriesdetailpage" ||
        pageId === "seriescoverspage" ||
        pageId === "readerpage"
    ) {
        const seriesSlug = getCurrentSeriesSlugFromPath();
        if (seriesSlug) {
            const coversLink = {
                text: "Galerie des Couvertures",
                href: `/${seriesSlug}/cover`,
                id: "series-covers-gallery",
            };

            if (pageId === "seriescoverspage" || pageId === "readerpage") {
                baseLinks = [{
                    text: "Retour à la Série",
                    href: `/${seriesSlug}`,
                    id: "back-to-series",
                }, ];
            } else if (pageId === "seriesdetailpage") {
                const currentView = getCurrentSeriesViewFromPath();

                if (currentView === "anime") {
                    baseLinks = [{
                            text: "Informations",
                            href: `#series-detail-section`,
                            id: "series-info"
                        },
                        {
                            text: "Épisodes",
                            href: `#chapters-list-section`,
                            id: "series-episodes"
                        },
                    ];
                } else {
                    baseLinks = [{
                            text: "Informations",
                            href: `#series-detail-section`,
                            id: "series-info"
                        },
                        {
                            text: "Galerie des Couvertures",
                            href: `/${seriesSlug}/cover`,
                            id: "series-covers-gallery"
                        },
                        {
                            text: "Chapitres",
                            href: `#chapters-list-section`,
                            id: "series-chapters"
                        },
                    ];
                }
            }
        }
    }

    // ---- Filtre +18 : si le contenu adulte est désactivé, on retire Doujinshi / Pornwha
    // (selon l'id ou, à défaut, le texte du lien)
    if (typeof isAdultOn === "function" && !isAdultOn()) {
        baseLinks = baseLinks.filter((l) => {
            const id = (l.id || l.text || "").toLowerCase();
            return id !== "doujinshi" && id !== "pornwha";
        });
    }

    return baseLinks;
}

function populateDesktopNavigation() {
  const mainNavContainer = qs("#desktop-nav-main");
  const subNavContainer  = qs("#desktop-nav-sub");
  const separator        = qs("#nav-separator");
  const currentPageId    = getCurrentPageId();

  renderNavLinks(mainNavContainer, mainNavLinksConfig, false);

  const subLinksForCurrentPage = getSubNavLinksForPage(currentPageId);
  // AVANT: renderNavLinks(subNavContainer, subLinksForCurrentPage, false);
  renderSubNavWithMore(subNavContainer, subLinksForCurrentPage, 5); // ⬅️ nouveau

  if (mainNavContainer && subNavContainer && separator) {
    if (mainNavContainer.children.length > 0 && subNavContainer.children.length > 0) {
      separator.style.display = "inline-block";
    } else {
      separator.style.display = "none";
    }
  }
}

function populateMobileNavigation() {
    const mobileMainNavContainer = qs("#mobile-nav-main");
    const mobileSubNavContainer = qs("#mobile-nav-sub");
    const mobileSubNavTitleElement = qs("#mobile-sub-nav-title");
    const mobileSubNavSection = qs("#mobile-sub-nav-section");

    const currentPageId = getCurrentPageId();

    renderNavLinks(mobileMainNavContainer, mainNavLinksConfig, true);

    const subLinksForCurrentPage = getSubNavLinksForPage(currentPageId);
    if (subLinksForCurrentPage.length > 0) {
        renderNavLinks(mobileSubNavContainer, subLinksForCurrentPage, true);
        if (mobileSubNavTitleElement) {
            mobileSubNavTitleElement.textContent =
                subNavTitlesConfig[currentPageId] || "Navigation rapide";
            mobileSubNavTitleElement.style.display = "block";
        }
        if (mobileSubNavSection) mobileSubNavSection.style.display = "block";
    } else {
        if (mobileSubNavTitleElement)
            mobileSubNavTitleElement.style.display = "none";
        if (mobileSubNavContainer) mobileSubNavContainer.innerHTML = "";
        if (mobileSubNavSection) mobileSubNavSection.style.display = "none";
    }
}

function updateThemeToggleIcon() {
    const toggleBtn = qs("#theme-toggle");
    if (toggleBtn) {
        const icon = toggleBtn.querySelector("i");
        if (icon && window.themeUtils) {
            icon.className =
                window.themeUtils.getCurrentTheme() === "dark" ?
                "fas fa-sun" :
                "fas fa-moon";
        }
    }
}

function setupThemeToggle() {
    const toggleBtn = qs("#theme-toggle");
    if (toggleBtn && window.themeUtils) {
        updateThemeToggleIcon();
        toggleBtn.addEventListener("click", () => {
            window.themeUtils.toggleTheme();
            updateThemeToggleIcon();
        });
    } else if (toggleBtn) {
        console.warn(
            "themeUtils non trouvé, le bouton de thème ne sera pas fonctionnel."
        );
    }
}

function handleAnchorLinkClick(e, linkElement) {
    const href = linkElement.getAttribute("href");
    if (!href.startsWith("#")) return;

    const targetId = href.substring(1);
    const targetElement = document.getElementById(targetId);

    if (targetElement) {
        e.preventDefault();
        const headerHeight = qs("#main-header")?.offsetHeight || 60;
        const elementPosition = targetElement.getBoundingClientRect().top;
        const offsetPosition =
            elementPosition + window.pageYOffset - headerHeight - 20;

        window.scrollTo({
            top: offsetPosition,
            behavior: "smooth",
        });

        if (history.pushState) {
            history.pushState(null, null, href);
        } else {
            window.location.hash = href;
        }
    }
}

function initAnchorLinks() {
    document.addEventListener("click", function(e) {
        const linkElement = e.target.closest("a");
        if (linkElement && linkElement.getAttribute("href")?.startsWith("#")) {
            handleAnchorLinkClick(e, linkElement);
        }
    });

    window.addEventListener("load", () => {
        if (window.location.hash) {
            const targetElement = document.getElementById(
                window.location.hash.substring(1)
            );
            if (targetElement) {
                setTimeout(() => {
                    const headerHeight = qs("#main-header")?.offsetHeight || 60;
                    const elementPosition = targetElement.getBoundingClientRect().top;
                    const offsetPosition =
                        elementPosition + window.pageYOffset - headerHeight - 20;
                    window.scrollTo({
                        top: offsetPosition,
                        behavior: "auto"
                    });
                }, 100);
            }
        }
    });
}

function updateActiveNavLinks() {
    // Normalise un chemin : supprime ".html", et transforme "/index.html" en "/"
    const normalizePath = (p) =>
        p.replace(/\/index\.html$/, "/").replace(/\.html$/, "");

    const currentPath = normalizePath(window.location.pathname);
    const navLinks = qsa("#desktop-nav-main a, #mobile-nav-main a");

    navLinks.forEach((a) => {
        const linkHref = a.getAttribute("href");
        if (linkHref) {
            const linkPath = normalizePath(linkHref);
            // La page d'accueil ('/') est active même si on est sur une sous-page qui n'a pas son propre bouton de nav
            if (linkPath === "/" && currentPath === "/") {
                a.classList.add("active-nav-link");
            } else if (linkPath !== "/" && currentPath.startsWith(linkPath)) {
                a.classList.add("active-nav-link");
            } else {
                a.classList.remove("active-nav-link");
            }
        }
    });
}

function setupMobileMenuInteractions() {
    const hamburgerBtn = qs(".hamburger-menu-btn");
    const mobileMenuOverlayContainer = qs("#main-mobile-menu-overlay");

    function openMobileMenu() {
        if (mobileMenuOverlayContainer) {
            populateMobileNavigation();
            updateActiveNavLinks();
            mobileMenuOverlayContainer.classList.add("open");
            document.body.classList.add("mobile-menu-open");
        }
        if (hamburgerBtn) hamburgerBtn.setAttribute("aria-expanded", "true");
    }

    function closeMobileMenu() {
        if (mobileMenuOverlayContainer)
            mobileMenuOverlayContainer.classList.remove("open");
        if (hamburgerBtn) hamburgerBtn.setAttribute("aria-expanded", "false");
        document.body.classList.remove("mobile-menu-open");
    }

    if (hamburgerBtn && mobileMenuOverlayContainer) {
        hamburgerBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (mobileMenuOverlayContainer.classList.contains("open")) {
                closeMobileMenu();
            } else {
                openMobileMenu();
            }
        });

        mobileMenuOverlayContainer.addEventListener("click", (e) => {
            if (e.target === mobileMenuOverlayContainer) closeMobileMenu();
        });

        mobileMenuOverlayContainer.addEventListener("click", (e) => {
            if (e.target.closest(".close-mobile-menu-btn")) {
                closeMobileMenu();
            } else if (e.target.closest("a")) {
                setTimeout(closeMobileMenu, 150);
            }
        });
    }
}

const ADULT_KEY = "adult_on";

export function isAdultOn() {
    return localStorage.getItem(ADULT_KEY) === "1";
}
export function setAdultOn(v) {
    localStorage.setItem(ADULT_KEY, v ? "1" : "0");
    document.documentElement.classList.toggle("adult-on", !!v);
}

// ---- Recherche --------------------------------------------------------------

// cache mémoire
let __seriesIndex = null; // [{ slug, title, haystack, isAdult }]
let __seriesIndexLoading = null;

function stripAccents(str) {
    return (str || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

function isSeriesAdult(s) {
    // champs usuels dans tes JSON: pornwha/doujinshi/light_novel + manga_type
    const adultByType =
        s.pornwha === true ||
        s.doujinshi === true ||
        s.manga_type?.toLowerCase() === "pornographique";

    return !!adultByType;
}

function buildEntryFromSeriesJson(slugFromFile, s) {
    const urlSlug = slugify(s.title || slugFromFile); // <-- même logique que tes cartes

    const texts = [
        s.title,
        ...(Array.isArray(s.alternative_titles) ? s.alternative_titles : []),
        s.author,
        s.artist,
        s.magazine,
        String(s.release_year || ""),
        ...(Array.isArray(s.tags) ? s.tags : []),
    ].filter(Boolean).map(String);

    return {
        // on garde l’ancien slug si tu veux t’en servir ailleurs,
        // mais la redirection utilisera urlSlug
        slug: slugFromFile,
        urlSlug, // <-- pour la redirection
        title: s.title || slugFromFile,
        isAdult: isSeriesAdult(s),
        haystack: stripAccents(texts.join(" | ")),
    };
}


// essaie plusieurs sources pour récupérer la liste des séries
async function loadSeriesIndex() {
    if (__seriesIndex) return __seriesIndex;
    if (__seriesIndexLoading) return __seriesIndexLoading;

    __seriesIndexLoading = (async () => {
        // 1) le plus simple/rapide si tu peux le générer côté build :
        //    /data/search-index.json -> [{slug,title, ...champs utiles...}]
        try {
            const r = await fetch("/data/search-index.json", {
                cache: "no-store"
            });
            if (r.ok) {
                const arr = await r.json();
                __seriesIndex = arr.map((x) => ({
                    slug: x.slug,
                    urlSlug: x.urlSlug || slugify(x.title || x.slug || ""), // <-- calcule si absent
                    title: x.title || x.slug,
                    isAdult: (x.isAdult ?? isSeriesAdult(x)),
                    haystack: stripAccents(
                        [
                            x.title,
                            ...(x.alternative_titles || []),
                            x.author,
                            x.artist,
                            x.magazine,
                            String(x.release_year || ""),
                            ...(x.tags || []),
                        ].filter(Boolean).join(" | ")
                    ),
                }));
                return __seriesIndex;
            }

        } catch (_) {}

        // 2) si une fonction globale existe déjà (ex: utilisée par la homepage)
        if (typeof window.fetchAllSeriesData === "function") {
            const all = await window.fetchAllSeriesData();
            __seriesIndex = all.map((s) => buildEntryFromSeriesJson(s.slug, s));
            return __seriesIndex;
        }

        // 3) fallback: manifeste des séries -> on fetch chaque JSON
        //    essaie plusieurs noms possibles
        const manifestCandidates = [
            "/data/series-manifest.json",
            "/data/series-list.json",
            "/data/config.json", // si ça contient une liste exploitable
        ];

        let manifest = null;
        for (const url of manifestCandidates) {
            try {
                const r = await fetch(url, {
                    cache: "no-store"
                });
                if (r.ok) {
                    manifest = await r.json();
                    break;
                }
            } catch (_) {}
        }

        if (!manifest) {
            console.warn("[search] Impossible de charger un manifeste de séries.");
            __seriesIndex = [];
            return __seriesIndex;
        }

        // différentes formes possibles :
        // - ["redo_of_healer","girls_x_vampire",...]
        // - [{slug:"redo_of_healer", json:"/data/Kaifuku_...json"}, ...]
        // - {series:[...]} ou {allSeries:[...]} etc.
        let list = manifest;
        if (Array.isArray(manifest.series)) list = manifest.series;
        if (Array.isArray(manifest.allSeries)) list = manifest.allSeries;

        // Normalise une entrée du manifeste en { slug, jsonPath? }
        const norm = (item) => {
            if (typeof item === "string") return {
                slug: item,
                json: `/data/${item}.json`
            };
            if (item && typeof item === "object") {
                return {
                    slug: item.slug || item.id || item.path?.replace(/\.json$/, "") || "",
                    json: item.json ||
                        item.path ||
                        (item.slug ? `/data/${item.slug}.json` : null),
                };
            }
            return null;
        };

        const normalized = (list || []).map(norm).filter((x) => x && x.slug);

        const results = [];
        for (const it of normalized) {
            try {
                const r = await fetch(it.json || `/data/${it.slug}.json`, {
                    cache: "no-store",
                });
                if (!r.ok) continue;
                const s = await r.json();
                results.push(buildEntryFromSeriesJson(it.slug, s));
            } catch (_) {}
        }

        __seriesIndex = results;
        return __seriesIndex;
    })();

    return __seriesIndexLoading;
}

function searchSeries(query, {
    limit = 8
} = {}) {
    const q = stripAccents(query).trim();
    if (!q) return [];

    const tokens = q.split(/\s+/).filter(Boolean);
    const showAdult = isAdultOn();

    const scored = [];
    for (const item of __seriesIndex || []) {
        if (!showAdult && item.isAdult) continue;
        // petit scoring : +2 si dans le titre, +1 pour chaque token trouvé ailleurs
        let score = 0;
        const hay = item.haystack;
        const inTitle = stripAccents(item.title);
        for (const t of tokens) {
            if (inTitle.includes(t)) score += 2;
            else if (hay.includes(t)) score += 1;
            else {
                score = -1; // token non présent -> éliminé
                break;
            }
        }
        if (score >= 0) scored.push({
            ...item,
            score
        });
    }

    scored.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
    return scored.slice(0, limit);
}

function renderSuggestions(list, container, input, activeIndex = -1) {
    if (!list.length) {
        container.hidden = true;
        container.innerHTML = "";
        input.setAttribute("aria-expanded", "false");
        input.removeAttribute("aria-activedescendant");
        return;
    }

    container.innerHTML = list
        .map((x, i) => {
            const id = `sugg-${i}`;
            const active = i === activeIndex;
            return `
        <button
          id="${id}"
          class="suggest-item ${active ? "is-active" : ""}"
          role="option"
          aria-selected="${active ? "true" : "false"}"
          data-urlslug="${x.urlSlug}" // <-- Correction ici
          data-idx="${i}"
          type="button"
        >
          <span class="suggest-title">${x.title}</span>
          ${x.isAdult ? '<span class="suggest-adult">18+</span>' : ""}
        </button>`;
        })
        .join("");

    container.hidden = false;
    input.setAttribute("aria-expanded", "true");
    if (activeIndex >= 0) {
        input.setAttribute("aria-activedescendant", `sugg-${activeIndex}`);
        // s'assure que l'élément actif est visible dans la liste
        const el = container.querySelector(`#sugg-${activeIndex}`);
        el?.scrollIntoView({
            block: "nearest"
        });
    } else {
        input.removeAttribute("aria-activedescendant");
    }
}


function goToSerie(urlSlug) {
  if (!urlSlug) return;
  window.location.href = `/${urlSlug}`;
}

async function initHeaderSearch() {
    const form = document.getElementById("site-search");
    const input = document.getElementById("site-search-input");
    const box = document.getElementById("search-suggest");
    if (!form || !input || !box) return;

    await loadSeriesIndex();

    let lastSuggestions = [];
    let activeIndex = -1; // -1 = rien de sélectionné

    const update = () => {
        const q = input.value;
        if (!q || q.length < 2) {
            lastSuggestions = [];
            activeIndex = -1;
            renderSuggestions(lastSuggestions, box, input, activeIndex);
            return;
        }
        lastSuggestions = searchSeries(q, {
            limit: 8
        });
        activeIndex = -1;
        renderSuggestions(lastSuggestions, box, input, activeIndex);
    };

    input.addEventListener("input", update);

    // Navigation clavier
    input.addEventListener("keydown", (e) => {
        if (box.hidden && !["ArrowDown", "ArrowUp", "Enter"].includes(e.key)) return;

        if (e.key === "Escape") {
            renderSuggestions([], box, input);
            return;
        }

        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!lastSuggestions.length) return;
            activeIndex = (activeIndex + 1) % lastSuggestions.length;
            renderSuggestions(lastSuggestions, box, input, activeIndex);
            return;
        }

        if (e.key === "ArrowUp") {
            e.preventDefault();
            if (!lastSuggestions.length) return;
            activeIndex = (activeIndex <= 0) ? lastSuggestions.length - 1 : activeIndex - 1;
            renderSuggestions(lastSuggestions, box, input, activeIndex);
            return;
        }

        if (e.key === "Home") {
            if (!lastSuggestions.length) return;
            e.preventDefault();
            activeIndex = 0;
            renderSuggestions(lastSuggestions, box, input, activeIndex);
            return;
        }

        if (e.key === "End") {
            if (!lastSuggestions.length) return;
            e.preventDefault();
            activeIndex = lastSuggestions.length - 1;
            renderSuggestions(lastSuggestions, box, input, activeIndex);
            return;
        }

        if (e.key === "Enter") {
            if (activeIndex >= 0 && lastSuggestions[activeIndex]) {
                e.preventDefault();
                goToSerie(lastSuggestions[activeIndex].urlSlug);
            }
            // sinon, laisse le submit handler décider (meilleur résultat)
        }
    });

    // Submit (Enter sans sélection active)
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const q = input.value.trim();
        if (!q) return;
        const results = lastSuggestions.length ?
            lastSuggestions :
            searchSeries(q, {
                limit: 1
            });
        if (results.length) goToSerie(results[0].urlSlug);
    });

    // Clic souris sur une suggestion
    box.addEventListener("click", (e) => {
        const btn = e.target.closest(".suggest-item");
        if (!btn) return;
        goToSerie(btn.dataset.urlslug);
    });

    // Surligne au survol (meilleur feedback)
    box.addEventListener("mousemove", (e) => {
        const btn = e.target.closest(".suggest-item");
        if (!btn) return;
        const idx = Number(btn.dataset.idx);
        if (!Number.isNaN(idx) && idx !== activeIndex) {
            activeIndex = idx;
            renderSuggestions(lastSuggestions, box, input, activeIndex);
        }
    });

    // Ferme la liste quand on clique ailleurs
    document.addEventListener("click", (e) => {
        if (!form.contains(e.target)) {
            renderSuggestions([], box, input);
            activeIndex = -1;
        }
    });

    // Filtre +18 : on réinitialise la recherche
    window.addEventListener("adult-visibility-changed", () => {
        input.value = "";
        lastSuggestions = [];
        activeIndex = -1;
        renderSuggestions(lastSuggestions, box, input, activeIndex);
    });
}

export function initHeader() {
    // initialisations habituelles
    setupThemeToggle();
    populateDesktopNavigation();
    initAnchorLinks();

    // garder la nav en phase si ta SPA déclenche un évènement de route
    document.body.addEventListener("routeChanged", () => {
        updateAllNavigation();
    });

    // --- Bouton +18
    const adultBtn = document.getElementById("adult-toggle");
    if (adultBtn) {
        const on = isAdultOn();

        // état initial (classe racine + visuel du bouton + accessibilité)
        document.documentElement.classList.toggle("adult-on", on);
        adultBtn.classList.toggle("on", on);
        adultBtn.setAttribute("aria-pressed", on ? "true" : "false");
        adultBtn.title = on ? "Contenu +18 : affiché" : "Contenu +18 : masqué";

        adultBtn.addEventListener("click", () => {
            const next = !isAdultOn();

            // persistance + classe racine
            setAdultOn(next); // (si setAdultOn ne toggle pas la classe, on garde la ligne ci-dessous)
            document.documentElement.classList.toggle("adult-on", next);

            // état visuel + a11y
            adultBtn.classList.toggle("on", next);
            adultBtn.setAttribute("aria-pressed", next ? "true" : "false");
            adultBtn.title = next ? "Contenu +18 : affiché" : "Contenu +18 : masqué";

            // la navigation peut contenir des liens à masquer (doujinshi/pornwha)
            updateAllNavigation();

            // notifier les pages (ex: homepage fait un reload à la réception)
            window.dispatchEvent(
                new CustomEvent("adult-visibility-changed", {
                    detail: {
                        on: next
                    }
                })
            );
        });
    }

    // === Recherche ===
    initHeaderSearch(); // <--- AJOUT

// Ouverture/fermeture mobile
const headerContainer = document.querySelector('.header-container');
const openBtn  = document.querySelector('.mobile-search-btn');
const closeBtn = document.querySelector('.close-search-btn');
const inputEl  = document.getElementById('site-search-input');
const suggest  = document.getElementById('search-suggest');

if (openBtn && headerContainer && inputEl) {
  openBtn.addEventListener('click', () => {
    headerContainer.classList.add('search-open');
    inputEl.value = '';
    if (suggest) suggest.hidden = true;
    setTimeout(() => inputEl.focus(), 0);
  });
}

if (closeBtn && headerContainer) {
  closeBtn.addEventListener('click', () => {
    headerContainer.classList.remove('search-open');
    if (suggest) suggest.hidden = true;
  });
}

// Fermer avec Échap
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && headerContainer?.classList.contains('search-open')) {
    headerContainer.classList.remove('search-open');
    if (suggest) suggest.hidden = true;
  }
});
}

export {
    setupMobileMenuInteractions
};