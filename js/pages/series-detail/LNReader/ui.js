// js/pages/series-detail/LNReader/ui.js
import { qs, slugify } from "../../../utils/domUtils.js";
import { state, dom } from "./state.js";
import { bindControls } from "./settings.js";
import { timeAgo } from "../../../utils/dateUtils.js";

function truncate(text, n){ return !text || text.length<=n ? text : text.slice(0, n-3)+"..."; }

export async function setupUI() {
  // activer le mode LN (rétablit le scroll même si le manga l’avait supprimé)
  document.documentElement.classList.add("ln-mode");
  document.body.classList.add("ln-mode");

  // conteneur partagé avec le manga
  dom.root = qs("#manga-reader-root");
dom.root.innerHTML = `
  <!-- HEADER MOBILE (attendu par ui.js / events.js) -->
  <div id="reader-mobile-header">
    <button id="mobile-settings-toggle" class="reader-button" title="Ouvrir les options">
      <i class="fas fa-cog"></i>
    </button>
    <div class="mobile-header-info">
      <a class="mobile-header-series-link"><span class="mobile-header-series"></span></a>
      <div class="mobile-header-details">
        <span class="mobile-header-chapter"></span>
        <div class="mobile-header-stats"></div>
      </div>
    </div>
  </div>

  <!-- OVERLAY (attendu par events.js) -->
  <div id="reader-sidebar-overlay"></div>

  <!-- CONTENEUR LECTEUR LN -->
  <section id="ln-reader" class="ln-reader ${state.settings.sidebarCollapsed ? "sidebar-collapsed" : ""}">
    <!-- SIDEBAR OPTIONS -->
    <aside class="ln-sidebar">
      <div class="ln-controls">
        <h3>Options</h3>

        <label>Police
          <select id="ln-font-family">
            <option value="'Inter', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif">Sans-serif</option>
            <option value="'Georgia', 'Times New Roman', serif">Serif</option>
            <option value="'JetBrains Mono', ui-monospace, monospace">Monospace</option>
          </select>
        </label>

        <label>Taille
          <div class="ln-row">
            <button class="btn" data-font="-">A–</button>
            <span id="ln-font-size-val">20px</span>
            <button class="btn" data-font="+">A+</button>
          </div>
        </label>

        <label>Interligne
          <div class="ln-row">
            <button class="btn" data-leading="-">–</button>
            <span id="ln-leading-val">1.8</span>
            <button class="btn" data-leading="+">+</button>
          </div>
        </label>

        <label>Lettrage
          <div class="ln-row">
            <button class="btn" data-tracking="-">–</button>
            <span id="ln-tracking-val">0px</span>
            <button class="btn" data-tracking="+">+</button>
          </div>
        </label>

        <label>Alignement
          <select id="ln-align">
            <option value="justify">Justifier</option>
            <option value="left">Gauche</option>
            <option value="center">Centré</option>
            <option value="right">Droite</option>
          </select>
        </label>

        <div class="ln-row">
          <button id="ln-reset" class="btn btn-ghost">Reset</button>
        </div>
      </div>
    </aside>

    <!-- ZONE DE LECTURE -->
    <main class="ln-stage">
      <!-- TOP pager -->
      <nav class="ln-pager ln-pager--top">
        <button id="ln-prev-top" class="btn ln-nav">Précédent</button>
        <select id="ln-jump-top" class="ln-pager-select" aria-label="Aller à un chapitre"></select>
        <button id="ln-next-top" class="btn ln-nav">Suivant</button>
      </nav>

      <article id="ln-article" class="ln-article"></article>

      <!-- BOTTOM pager -->
      <nav class="ln-pager ln-pager--bottom">
        <button id="ln-prev-bottom" class="btn ln-nav">Précédent</button>
        <select id="ln-jump-bottom" class="ln-pager-select" aria-label="Aller à un chapitre"></select>
        <button id="ln-next-bottom" class="btn ln-nav">Suivant</button>
      </nav>

      <div id="sidebar-interactions-placeholder"></div>
    </main>

    <!-- BOUTON TOGGLE SIDEBAR (attendu par events.js via #reader-sidebar-toggle) -->
    <button id="reader-sidebar-toggle" class="ln-toggle" aria-label="Masquer/Afficher les options">
      <i class="fas fa-chevron-left"></i>
    </button>
  </section>

  <button id="ln-back-to-top" class="ln-back-to-top" aria-label="Revenir en haut" title="Revenir en haut">
    <span class="ln-back-to-top-icon">↑</span>
  </button>

  <!-- PLACEHOLDER INTERACTIONS WEBTOON (même API que MangaReader) -->
  <div id="webtoon-interactions-placeholder"></div>
`;

// Remplit la liste des chapitres (Ch. N (Vol. X) — Titre)
const slug = slugify(state.seriesData.title);
const keys = state.allChapterKeys.map(String);
const cur  = String(state.currentChapter.number);

function buildOptionsHTML() {
  return keys.map((k) => {
    const ch    = state.seriesData.chapters[k] || {};
    const title = ch.title || "Sans titre";
    const vol   = ch.volume ? `Vol. ${ch.volume} · ` : "";
    const href  = `/${slug}/${encodeURIComponent(k)}`;
    const sel   = k === cur ? "selected" : "";
    // value = n° brut ; data-href = URL finale (ne contient pas le volume)
    return `<option value="${k}" data-href="${href}" ${sel}>${vol}Ch. ${k} — ${title}</option>`;
  }).join("");
}

function fillSelectById(id) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = buildOptionsHTML();
}

function updatePagerButtons() {
  const i = keys.indexOf(cur);
  const disablePrev = i <= 0;
  const disableNext = i >= keys.length - 1;
  ["top", "bottom"].forEach(pos => {
    const prev = document.getElementById(`ln-prev-${pos}`);
    const next = document.getElementById(`ln-next-${pos}`);
    if (prev) prev.disabled = disablePrev;
    if (next) next.disabled = disableNext;
  });
}

// --- appel
fillSelectById("ln-jump-top");
fillSelectById("ln-jump-bottom");
updatePagerButtons();

  Object.assign(dom, {
    sidebar: qs(".ln-sidebar"),
    viewerContainer: qs(".ln-stage"),
    mobileHeader: qs("#reader-mobile-header"),
    mobileSettingsBtn: qs("#mobile-settings-toggle"),
    sidebarOverlay: qs("#reader-sidebar-overlay"),
    mobileSeriesTitle: qs(".mobile-header-series"),
    mobileChapterInfo: qs(".mobile-header-chapter"),
    mobileHeaderStats: qs(".mobile-header-stats"),
  });

  // header mobile (comme le manga)
  qs(".mobile-header-series-link").href = `/${slugify(state.seriesData.title)}`;
  dom.mobileSeriesTitle.textContent = truncate(state.seriesData.title, 35);
  dom.mobileChapterInfo.textContent = truncate(
    `Ch. ${state.currentChapter.number} : ${state.currentChapter.title || ""}`, 30
  );
  const likes = state.chapterStats?.likes ?? 0;
  const commentsCount = state.chapterStats?.comments?.length ?? 0;
  dom.mobileHeaderStats.innerHTML =
    `<span class="stat-item"><i class="fas fa-heart"></i> ${likes}</span>
    <span class="stat-item"><i class="fas fa-comment"></i> ${commentsCount}</span>`;

  // interactions en bas du texte (on réutilisera ton composant plus tard si tu veux)
  // Pour l’instant on ne duplique pas tout — on laisse le placeholder.

  bindControls();
}

export function renderArticle(html) {
  const art = qs("#ln-article");
 const num = state.currentChapter.number;
 const title = state.currentChapter.title || "";
 art.innerHTML = `
   <header class="ln-header">
     <h1 class="ln-chapter-heading">Chapitre ${num}${title ? " — " + title : ""}</h1>
     <hr class="ln-divider">
   </header>
   <div class="ln-content">${html}</div>
 `;
}


// COMMENTAIRE 

export function renderInteractionsSection(localState) {
  const { hasLiked, hasCommented } = localState;
  const stats = state.chapterStats;
  const commentListContainer = document.createElement("div");
  commentListContainer.className = "comment-list";

  const comments = (stats.comments || []).sort(
    (a, b) => b.timestamp - a.timestamp
  );

  if (comments.length > 0) {
    // Construction sécurisée des éléments de commentaire
    const commentElements = comments.map((comment) => {
      const itemDiv = document.createElement("div");
      itemDiv.className = "comment-item";
      itemDiv.dataset.commentId = comment.id;

      const avatarHtml = comment.avatarUrl
        ? `<img src="${comment.avatarUrl}" alt="Avatar" class="comment-avatar">`
        : `<div class="comment-avatar">${comment.username.charAt(0)}</div>`;
      itemDiv.innerHTML = avatarHtml;

      const contentDiv = document.createElement("div");
      contentDiv.className = "comment-content";
      const headerDiv = document.createElement("div");
      headerDiv.className = "comment-header";

      const usernameSpan = document.createElement("span");
      usernameSpan.className = "comment-username";
      usernameSpan.innerText = comment.username;

      const timestampSpan = document.createElement("span");
      timestampSpan.className = "comment-timestamp";
      timestampSpan.innerText = timeAgo(comment.timestamp);

      headerDiv.append(usernameSpan, timestampSpan);

      const textP = document.createElement("p");
      textP.className = "comment-text";
      textP.innerText = comment.comment;

      const userLikedComment =
        localState.likedComments && localState.likedComments[comment.id];
      const actionsDiv = document.createElement("div");
      actionsDiv.className = "comment-actions";
      actionsDiv.innerHTML = `
                <button class="comment-like-button ${
                  userLikedComment ? "liked" : ""
                }">
                    <i class="fas fa-heart"></i> <span class="comment-like-count">${
                      comment.likes || 0
                    }</span>
                </button>
            `;

      contentDiv.append(headerDiv, textP, actionsDiv);
      itemDiv.appendChild(contentDiv);
      return itemDiv;
    });
    commentListContainer.append(...commentElements);
  } else {
    commentListContainer.innerHTML = "<p>Aucun commentaire pour le moment.</p>";
  }

  const formDisabled = hasCommented ? "disabled" : "";
  const formMessage = hasCommented
    ? '<p class="form-message">Vous avez déjà commenté ce chapitre.</p>'
    : "";

  const interactionsHtml = `
      <div class="chapter-interactions-container">
        <div class="comments-section spoiler-hidden">
          <h3 class="comments-section-header">Commentaires (${
            stats.comments?.length || 0
          })</h3>
          <form class="comment-form" ${formDisabled}>
            <textarea placeholder="Ajouter un commentaire..." maxlength="150" rows="3" ${formDisabled}></textarea>
            <div class="comment-form-actions">
              <button type="button" class="chapter-like-button ${hasLiked ? "liked" : ""}">
                <i class="fas fa-heart"></i> J'aime</button>
              <button type="submit" ${formDisabled}>Envoyer</button>
            </div>
            ${formMessage}
          </form>
          ${commentListContainer.outerHTML}
        </div>
      </div>`;

  // LN : on affiche toujours le panneau de commentaires au même endroit
  const host =
    document.getElementById("ln-interactions") ||           // <-- à créer dans le HTML du LN
    document.getElementById("sidebar-interactions-placeholder") || // fallback si tu l'utilises déjà
    document.getElementById("webtoon-interactions-placeholder");   // dernier recours

  if (host) {
    host.innerHTML = interactionsHtml;
  }
}

export function updateUIOnPageChange() {
  const likes = state.chapterStats?.likes ?? 0;
  const commentsCount = state.chapterStats?.comments?.length ?? 0;

  // ton conteneur d'infos (tu l’utilises déjà dans setupUI)
  const statsHost = qs(".mobile-header-stats") || qs("#mobile-header-stats");
  if (statsHost) {
    statsHost.innerHTML = `
      <span class="stat-item"><i class="fas fa-heart"></i> ${likes}</span>
      <span class="stat-item"><i class="fas fa-comment"></i> ${commentsCount}</span>
    `;
  }
}