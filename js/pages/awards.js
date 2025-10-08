// /js/pages/awards.js

// --------- Utils ----------
const q = (sel, root = document) => root.querySelector(sel);
const el = (tag, cls) => { const n = document.createElement(tag); if (cls) n.className = cls; return n; };

// --------- Config ----------
const DATA_URL = "/data/2025.json";

// --------- État global ----------
let AWARDS_DATA = null;
let ROUTE_BOUND = false;

// --------- Boot ----------
export async function initAwardsPage() {
  console.log("✅ initAwardsPage()");
  ensureAwardsStyles();
  ensureAwardsSkeleton();

  try {
    if (!AWARDS_DATA) {
      AWARDS_DATA = await loadData();
    }

    renderHero(AWARDS_DATA);

    // Router hash (#cat/<id>)
    const applyRoute = () => {
    const m = location.hash.match(/^#cat\/([a-z0-9._-]+)$/i);
    if (m) {
        renderCategoryDetail(AWARDS_DATA, m[1]);   // vue DÉTAIL
    } else {
        renderHomeGrid(AWARDS_DATA);               // vue GRILLE
        disableKeyNav();                           // ← pas de flèches clavier sur l’accueil
    }
    };

    // Bind une seule fois
    if (!ROUTE_BOUND) {
      window.addEventListener("hashchange", applyRoute);
      // Délégation minimale pour la grille & "Accueil"
      const root = getRoot();
      root.addEventListener("click", (e) => {
        const card = e.target.closest(".category-card");
        if (card) { location.hash = "#cat/" + card.dataset.id; return; }
        if (e.target.closest(".awards-back-home")) { location.hash = ""; return; }
      });
      ROUTE_BOUND = true;
    }

    // Premier rendu
    applyRoute();

  } catch (err) {
    console.error(err);
    getRoot().innerHTML = `<div class="error">Impossible de charger les Awards.</div>`;
  }
}

// --- KeyNav global (flèches ← → entre catégories) ---
const KeyNav = {
  ids: [],
  cur: 0,
  enabled: false,
  bound: false,
};

function isTypingContext() {
  const ae = document.activeElement;
  const tag = (ae?.tagName || "").toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || ae?.isContentEditable;
}

function onKeyDown(e) {
  if (!KeyNav.enabled) return;
  if (!location.hash.startsWith("#cat/")) return;
  if (isTypingContext()) return;
  if (e.altKey || e.ctrlKey || e.metaKey) return;

  if (e.key === "ArrowRight") {
    e.preventDefault();
    const next = (KeyNav.cur + 1) % KeyNav.ids.length;
    location.hash = "#cat/" + KeyNav.ids[next];
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    const prev = (KeyNav.cur - 1 + KeyNav.ids.length) % KeyNav.ids.length;
    location.hash = "#cat/" + KeyNav.ids[prev];
  }
}

function enableKeyNav(ids, curIndex) {
  KeyNav.ids = ids;
  KeyNav.cur = Math.max(0, Math.min(curIndex ?? 0, ids.length - 1));
  KeyNav.enabled = true;
  if (!KeyNav.bound) {
    window.addEventListener("keydown", onKeyDown);
    KeyNav.bound = true;
  }
}

function disableKeyNav() {
  KeyNav.enabled = false;
}

// --------- DOM helpers ----------
function getRoot() {
  return q("#awards-categories") || document.body;
}

function ensureAwardsStyles() {
  if (!document.querySelector('link[href*="/css/pages/awards.css"]')) {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "/css/pages/awards.css";
    document.head.appendChild(l);
  }
}

function ensureAwardsSkeleton() {
  if (q("#awards-categories")) return;
  const main = q("main") || document.body;
  main.innerHTML = `
    <section class="awards-hero">
      <img id="awards-hero-banner" alt="Bannière Awards" />
      <div class="awards-hero-overlay">
        <h1 id="awards-title">Awards</h1>
        <p id="awards-subtitle"></p>
        <p id="awards-dates" class="awards-dates"></p>
        <p id="awards-desc" class="awards-desc"></p>
      </div>
    </section>
    <section class="awards-categories" id="awards-categories"></section>
  `;
}

// --------- Data ----------
async function loadData() {
  const res = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Awards JSON introuvable");
  return res.json();
}

// --------- Render: Hero ----------
function formatDateRange(openISO, closeISO) {
  try {
    const f = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" });
    return `Votes : ${f.format(new Date(openISO))} → ${f.format(new Date(closeISO))}`;
  } catch { return ""; }
}

function renderHero(data) {
  const b = q("#awards-hero-banner");
  if (b) { b.src = data.banner || ""; b.alt = data.title || "Awards"; }
  const title = q("#awards-title"); if (title) title.textContent = data.title || "Awards";
  const sub = q("#awards-subtitle"); if (sub) sub.textContent = data.subtitle || "";
  const desc = q("#awards-desc"); if (desc) desc.textContent = data.description || "";
  const dates = q("#awards-dates");
  if (dates && data.vote?.open_at && data.vote?.close_at) {
    dates.textContent = formatDateRange(data.vote.open_at, data.vote.close_at);
  }
}

// --------- Render: Home grid ----------
function renderHomeGrid(data) {
  const root = getRoot();
  root.innerHTML = `<div class="categories-grid" id="awards-grid"></div>`;
  const grid = q("#awards-grid");

    for (const c of data.categories) {
    const winner = c.result?.winner_id
        ? (c.nominees || []).find(n => n.id === c.result.winner_id)
        : null;

    const card = el("article", "category-card");
    card.dataset.id = c.id;

    card.innerHTML = `
        <div class="category-card-cover ${winner ? "" : "is-empty"}">
        ${winner ? `<img class="category-card-winner" src="${winner.image}" alt="${winner.title}">` : ""}
        </div>

        <div class="category-card-body">
        ${winner ? `<span class="category-card-badge inline">Vainqueur</span>` : ""}
        ${c.subtitle ? `<div class="category-card-sub">${c.subtitle}</div>` : ""}
        <h3 class="category-card-title">${c.title}</h3>
        <button class="category-card-open" aria-label="Ouvrir la catégorie">→</button>
        </div>
    `;

    grid.appendChild(card);
    }
}

// --------- Helpers for category detail ----------
function getDefaultSelectedNomineeId(cat) {
  return cat?.result?.winner_id || cat?.nominees?.[0]?.id || null;
}

function getNomineeById(cat, id) {
  return (cat?.nominees || []).find(n => n.id === id) || null;
}

// --- YouTube helpers ---
function parseStartSecondsFromQuery(url) {
  try {
    const u = new URL(url, location.origin);
    // t=90 | t=1m30s | start=90
    if (u.searchParams.has("start")) return parseInt(u.searchParams.get("start"), 10) || 0;
    if (u.searchParams.has("t")) {
      const t = u.searchParams.get("t");
      if (/^\d+$/.test(t)) return parseInt(t, 10);
      // 1m30s, 2m, 45s
      const m = t.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/i);
      if (m) {
        const h = parseInt(m[1] || "0", 10);
        const mnt = parseInt(m[2] || "0", 10);
        const s = parseInt(m[3] || "0", 10);
        return h * 3600 + mnt * 60 + s;
      }
    }
  } catch {}
  return 0;
}

function extractYouTubeId(input) {
  if (!input) return null;
  const str = typeof input === "string" ? input : (input.youtube || input.url || "");
  if (!str) return null;
  // patterns: https://youtu.be/ID ; https://www.youtube.com/watch?v=ID ; /embed/ID
  const idFromWatch = str.match(/[?&]v=([\w-]{11})/);
  if (idFromWatch) return idFromWatch[1];
  const idFromShort = str.match(/youtu\.be\/([\w-]{11})/);
  if (idFromShort) return idFromShort[1];
  const idFromEmbed = str.match(/\/embed\/([\w-]{11})/);
  if (idFromEmbed) return idFromEmbed[1];
  // raw ID ?
  if (/^[\w-]{11}$/.test(str)) return str;
  return null;
}

function buildYouTubeEmbedUrl(video) {
  if (!video) return null;
  const urlStr = typeof video === "string" ? video : (video.youtube || video.url || "");
  const id = extractYouTubeId(video);
  if (!id) return null;
  const start = typeof video === "object" && typeof video.start === "number"
    ? video.start
    : parseStartSecondsFromQuery(urlStr);
  const params = new URLSearchParams({
    rel: "0",
    start: String(start || 0),
    modestbranding: "1",
    // autoplay off par défaut (politiques navigateurs)
    // autoplay: "1", mute: "1"
  });
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}

// Rend le média du hero (image ou iframe)
function renderHeroMedia(nominee, fallbackImage) {
  const media = document.querySelector(".hero-media");
  if (!media) return;
  const img = media.querySelector(".hero-image");
  const iframe = media.querySelector(".hero-video");
  const embed = buildYouTubeEmbedUrl(nominee?.video);

  if (embed) {
    iframe.src = embed;
    iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share");
    iframe.setAttribute("allowfullscreen", "true");
    iframe.loading = "lazy";
    media.classList.add("is-video");
  } else {
    iframe.src = ""; // stop lecture si on revient à l'image
    img.src = getHeroSrc(nominee, fallbackImage);
    img.alt = nominee?.title || "";
    media.classList.remove("is-video");
  }
}

// Choix des images avec rétro-compatibilité
function getThumbSrc(n) {
  // ordre: thumb → cover → character → image → poster
  return n.thumb || n.cover || n.character || n.image || n.poster || "";
}
function getHeroSrc(n, fallback) {
  // ordre: hero → character → cover → image → poster → fallback
  return n.hero || n.character || n.cover || n.image || n.poster || fallback || "";
}

// --------- Render: Category detail ----------
function renderCategoryDetail(data, catId, selectedId = null) {
  const cat = data.categories.find(c => c.id === catId) || data.categories[0];

  const ids = data.categories.map(c => c.id);
  const idx = ids.indexOf(cat.id);
  enableKeyNav(ids, idx);
  const prevId = ids[(idx - 1 + ids.length) % ids.length];
  const nextId = ids[(idx + 1) % ids.length];

  const winner = cat.result?.winner_id
    ? (cat.nominees || []).find(n => n.id === cat.result.winner_id)
    : null;

  // --- sélection initiale (winner -> 1er nominé) OU celle passée en paramètre
  const selectedNomineeId = (selectedId ?? getDefaultSelectedNomineeId(cat));
  const selectedNominee = getNomineeById(cat, selectedNomineeId);

const root = getRoot();
  root.innerHTML = `
    <nav class="cat-topbar">
      <a class="awards-back-home btn btn-ghost" href="#">Accueil</a>
      <div class="cat-switch">
        <button type="button" class="btn btn-ghost cat-nav-prev">← Précédent</button>
        <div class="cat-select-wrap">
          <select id="cat-select" aria-label="Choisir une catégorie"></select>
        </div>
        <button type="button" class="btn btn-ghost cat-nav-next">Suivant →</button>
      </div>
    </nav>

    <section class="category-detail" data-id="${cat.id}">
      <div class="category-hero">
        <div class="hero-left">
          ${cat.subtitle ? `<div class="cat-sub">${cat.subtitle}</div>` : ""}
          <h2 class="cat-title">${cat.title}</h2>

          <div class="hero-selected">
            <div>
              <span class="hero-selected-title">${selectedNominee?.title || ""}</span>
              ${cat.result?.winner_id === selectedNomineeId
                ? `<span class="badge-winner hero-badge">GAGNANT ${new Date().getFullYear()}</span>`
                : ""}
            </div>
            <div class="hero-selected-sub">${selectedNominee?.subtitle || ""}</div>
            <p class="hero-summary">${selectedNominee?.summary || ""}</p>
          </div>
        </div>
            <div class="hero-media">
                <img class="hero-image"
                    src="${getHeroSrc(selectedNominee, cat.cover)}"
                    alt="${selectedNominee?.title || ''}">
                <iframe class="hero-video" title="Lecture vidéo"></iframe>
            </div>
      </div>

    <div class="nominees-rows">
    ${(cat.nominees || []).map(n => `
        <article class="nominee-row ${n.id === selectedNomineeId ? 'active' : ''}" data-id="${n.id}">
        <img class="thumb" src="${getThumbSrc(n)}" alt="${n.title}">
        <div class="info">
            <div class="title">${n.title}</div>
            <div class="sub">${n.subtitle || ""}</div>
        </div>
        <div class="right">
            ${cat.result?.winner_id === n.id ? `<span class="badge-winner small">Gagnant</span>` : ""}
            <button type="button" class="row-open" data-id="${n.id}" title="Détails">›</button>
        </div>
        </article>
    `).join("")}
    </div>
    </section>
  `;

  renderHeroMedia(selectedNominee, cat.cover);

  // -- rendre la topbar cliquable au-dessus du hero (au cas où un overlay passe devant)
  const topbar = q(".cat-topbar");
  if (topbar) { topbar.style.position = "relative"; topbar.style.zIndex = "5"; }

  // -- remplir le select
  const sel = q("#cat-select");
  data.categories.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.id; opt.textContent = c.title;
    if (c.id === cat.id) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.onchange = () => { location.hash = "#cat/" + sel.value; };

  // Flèches
  q(".cat-nav-prev")?.addEventListener("click", (e) => {
    e.preventDefault(); location.hash = "#cat/" + prevId;
  });
  q(".cat-nav-next")?.addEventListener("click", (e) => {
    e.preventDefault(); location.hash = "#cat/" + nextId;
  });

// Clic sur une ligne -> met à jour hero (vidéo YouTube si dispo, sinon image)
const list = q(".nominees-rows");
list?.addEventListener("click", (e) => {
  const row = e.target.closest(".nominee-row");
  if (!row || e.target.closest(".row-open")) return;

  const id = row.dataset.id;
  const n  = getNomineeById(cat, id);
  if (!n) return;

  // MEDIA : remplace l'image par l'embed YouTube si n.video existe
  renderHeroMedia(n, cat.cover);

  // TITRES / RÉSUMÉ
  q(".hero-selected-title").textContent = n.title || "";
  q(".hero-selected-sub").textContent   = n.subtitle || "";
  q(".hero-summary").textContent        = n.summary || "";

  // BADGE GAGNANT (seulement si ce nominé est le gagnant)
  const existing = q(".hero-badge");
  if (existing) existing.remove();
  if (cat.result?.winner_id === id) {
    const badge = document.createElement("span");
    badge.className = "badge-winner hero-badge";
    badge.textContent = `GAGNANT ${new Date().getFullYear()}`;
    q(".hero-selected > div")?.appendChild(badge);
  }

  // ÉTAT VISUEL "active"
  list.querySelectorAll(".nominee-row.active").forEach(el => el.classList.remove("active"));
  row.classList.add("active");
});

  // Nav clavier (si tu utilises KeyNav)
  enableKeyNav?.(ids, idx);
}

// ------------------------------------------