// js/pages/series-detail/LNReader/events.js
import { state, dom } from "./state.js";
import { saveSettings } from "./settings.js";
import { navigateToChapter } from "./navigation.js";
import { queueAction, getLocalInteractionState, setLocalInteractionState, addPendingComment } from "../../../utils/interactions.js";
import { assignUserIdentityForChapter } from "../../../utils/usernameGenerator.js";
import { qs, qsa, slugify } from "../../../utils/domUtils.js";
import { renderInteractionsSection, updateUIOnPageChange } from "./ui.js";

export function initializeEvents() {
  // Toggle sidebar (comme le manga)
  const toggleBtn = document.getElementById("reader-sidebar-toggle");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const root = document.getElementById("ln-reader");
      const collapsed = root.classList.toggle("sidebar-collapsed");
      state.settings.sidebarCollapsed = collapsed;
      saveSettings();
      toggleBtn.setAttribute("title", collapsed ? "Afficher les contrôles" : "Masquer les contrôles");
    });
  }

  // Pagination : prev / next / select
  ["top", "bottom"].forEach(pos => {
    const prev = document.getElementById(`ln-prev-${pos}`);
    const next = document.getElementById(`ln-next-${pos}`);
    prev?.addEventListener("click", () => navigateToChapter(-1));
    next?.addEventListener("click", () => navigateToChapter(1));
  });

  // Select (haut & bas) → navigation via data-href
  function goToSelected(sel) {
    if (!sel) return;
    const opt = sel.selectedOptions?.[0];
    if (!opt) return;

    const href = opt.dataset?.href; // prioritaire
    if (href) {
      window.location.assign(href);
      return;
    }
    const chapter = String(opt.value || "").trim();
    if (!chapter) return;
    const slug = slugify(state.seriesData.title);
    window.location.assign(`/${slug}/${encodeURIComponent(chapter)}`);
  }

  ["top", "bottom"].forEach(pos => {
    const el = document.getElementById(`ln-jump-${pos}`);
    el?.addEventListener("change", (e) => goToSelected(e.target));
    el?.addEventListener("input",  (e) => goToSelected(e.target));
  });


  // Overlay mobile
  dom.mobileSettingsBtn?.addEventListener("click", () => {
    const isOpen = dom.sidebar.classList.contains("open");
    dom.sidebar.classList.toggle("open", !isOpen);
    dom.sidebarOverlay.classList.toggle("open", !isOpen);
    document.getElementById("ln-reader").classList.toggle("sidebar-is-open", !isOpen);
  });
  dom.sidebarOverlay?.addEventListener("click", () => {
    dom.sidebar.classList.remove("open");
    dom.sidebarOverlay.classList.remove("open");
    document.getElementById("ln-reader").classList.remove("sidebar-is-open");
  });

  // Navigation chapitres au clavier (facultatif)
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") navigateToChapter(1);
    if (e.key === "ArrowLeft")  navigateToChapter(-1);
  });

  // Bouton "Revenir en haut"
  const backTopBtn = document.getElementById("ln-back-to-top");

  function onScrollShowBackTop() {
    const y = window.scrollY || document.documentElement.scrollTop || 0;
    if (backTopBtn) backTopBtn.classList.toggle("visible", y > 400);
  }

  window.addEventListener("scroll", onScrollShowBackTop, { passive: true });
  onScrollShowBackTop(); // état initial

  backTopBtn?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  backTopBtn?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });
}

// COMMENTAIRE

export function attachInteractionListeners() {
  const seriesSlug = slugify(state.seriesData.title);
  const chapterNumber = state.currentChapter.number;
  const interactionKey = `interactions_${seriesSlug}_${chapterNumber}`;
  const container = qs(".chapter-interactions-container");
  if (!container) return;

  // NOUVEAU : Gestion du clic sur l'overlay de spoil
  const commentsSection = container.querySelector(".comments-section");
  commentsSection?.addEventListener("click", () => {
    if (commentsSection.classList.contains("spoiler-hidden")) {
      commentsSection.classList.remove("spoiler-hidden");
    }
  });

  const commentForm = qs(".comment-form", container);
  if (commentForm) {
    const textarea = qs("textarea", commentForm);
    textarea.addEventListener("input", () => {
      const lines = textarea.value.split("\n");
      if (lines.length > 5) {
        // Un peu plus de lignes permises
        textarea.value = lines.slice(0, 5).join("\n");
      }
    });
    commentForm.addEventListener("submit", async (e) => {
      // La fonction devient async
      e.preventDefault();
      const commentText = textarea.value.trim();
      if (commentText.length === 0) return;

      // MODIFIÉ : Utilisation du nouveau système d'identité
      const userIdentity = await assignUserIdentityForChapter(interactionKey);
      const newComment = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        username: userIdentity.username,
        avatarUrl: userIdentity.avatarUrl,
        comment: commentText,
        timestamp: Date.now(),
        likes: 0,
      };

      addPendingComment(interactionKey, newComment);

      let localState = getLocalInteractionState(interactionKey);
      state.chapterStats.comments.unshift(newComment);

      renderInteractionsSection(localState);
      qs(".comments-section")?.classList.remove("spoiler-hidden");

      attachInteractionListeners();
      updateUIOnPageChange();

      queueAction(seriesSlug, {
        type: "add_comment",
        chapter: chapterNumber,
        payload: newComment,
      });
    });
    const chapterLikeBtn = qs(".chapter-like-button", commentForm);
    if (chapterLikeBtn) {
      chapterLikeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        let localState = getLocalInteractionState(interactionKey);
        const wasLiked = localState.hasLiked || false;
        state.chapterStats.likes += wasLiked ? -1 : 1;
        chapterLikeBtn.classList.toggle("liked", !wasLiked);
        updateUIOnPageChange();
        queueAction(seriesSlug, {
          type: wasLiked ? "unlike" : "like",
          chapter: chapterNumber,
        });
        localState.hasLiked = !wasLiked;
        setLocalInteractionState(interactionKey, localState);
      });
    }
  }
  const commentList = qs(".comment-list", container);
  if (commentList) {
    commentList.addEventListener("click", (e) => {
      const likeButton = e.target.closest(".comment-like-button");
      if (!likeButton) return;
      const commentItem = e.target.closest(".comment-item");
      const commentId = commentItem.dataset.commentId;
      const likeCountSpan = qs(".comment-like-count", likeButton);
      let localState = getLocalInteractionState(interactionKey);
      if (!localState.likedComments) localState.likedComments = {};
      const wasLiked = localState.likedComments[commentId] || false;
      const actionType = wasLiked ? "unlike_comment" : "like_comment";
      const currentLikes = parseInt(likeCountSpan.textContent, 10);
      likeCountSpan.textContent = wasLiked
        ? currentLikes - 1
        : currentLikes + 1;
      likeButton.classList.toggle("liked", !wasLiked);
      queueAction(seriesSlug, {
        type: actionType,
        chapter: chapterNumber,
        payload: { commentId },
      });
      localState.likedComments[commentId] = !wasLiked;
      setLocalInteractionState(interactionKey, localState);
    });
  }
}