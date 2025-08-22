// js/pages/series-detail/animeView.js
import { qs, qsa } from "../../utils/domUtils.js";
import { timeAgo } from "../../utils/dateUtils.js";
import { generateNavTabs, generateAnimeHeader } from "./components.js";
import { initMainScrollObserver } from "../../components/observer.js";
import {
  fetchSeriesStats,
  getLocalInteractionState,
  setLocalInteractionState,
  queueAction,
} from "../../utils/interactions.js";

let currentSeriesStats = {};

function saveReadingProgress(seriesSlug, episodeNumber) {
  if (!seriesSlug || !episodeNumber) return;
  try {
    localStorage.setItem(
      `reading_progress_anime_${seriesSlug}`,
      episodeNumber.toString()
    );
  } catch (e) {
    console.error(
      "Erreur lors de la sauvegarde de la progression de l'anime:",
      e
    );
  }
}

function getReadingProgress(seriesSlug) {
  try {
    return localStorage.getItem(`reading_progress_anime_${seriesSlug}`);
  } catch (e) {
    console.error("Erreur lors de la lecture de la progression de l'anime:", e);
    return null;
  }
}

function renderReadingActions(seriesData, seriesSlug) {
  const container = qs("#reading-actions-container");
  if (!container) return;

  const episodes = (seriesData.episodes || []).sort(
    (a, b) => a.indice_ep - b.indice_ep
  );

  if (episodes.length === 0) {
    container.innerHTML = "";
    return;
  }

  const lastWatchedEpisode = getReadingProgress(seriesSlug);
  const lastEpisode = episodes[episodes.length - 1];
  let nextEpisode = null;

  if (lastWatchedEpisode) {
    const lastWatchedIndex = episodes.findIndex(
      (ep) => ep.indice_ep == lastWatchedEpisode
    );
    if (lastWatchedIndex !== -1 && lastWatchedIndex < episodes.length - 1) {
      nextEpisode = episodes[lastWatchedIndex + 1];
    }
  }

  const lastEpisodeUrl = `/${seriesSlug}/episodes/${lastEpisode.indice_ep}`;
  const nextEpisodeUrl = nextEpisode
    ? `/${seriesSlug}/episodes/${nextEpisode.indice_ep}`
    : null;

  let buttonsHtml = "";

  if (nextEpisodeUrl) {
    buttonsHtml += `<a href="${nextEpisodeUrl}" class="reading-action-button continue"><i class="fas fa-play"></i> Continuer (Ép. ${nextEpisode.indice_ep})</a>`;
  } else if (
    lastWatchedEpisode &&
    lastWatchedEpisode == lastEpisode.indice_ep
  ) {
    buttonsHtml += `<span class="reading-action-button disabled"><i class="fas fa-check"></i> À jour</span>`;
  }

  if (!lastWatchedEpisode || lastWatchedEpisode != lastEpisode.indice_ep) {
    buttonsHtml += `<a href="${lastEpisodeUrl}" class="reading-action-button start"><i class="fas fa-fast-forward"></i> Dernier Épisode (Ép. ${lastEpisode.indice_ep})</a>`;
  }

  container.innerHTML = buttonsHtml;
}

function handleEpisodeLikeClick(e, seriesSlug) {
  const likeContainer = e.target.closest(
    ".detail-episode-likes, .player-episode-likes"
  );
  if (!likeContainer) return;

  e.preventDefault();
  e.stopPropagation();

  const episodeItem = e.target.closest("[data-episode-number]");
  const episodeNumber = episodeItem.dataset.episodeNumber;
  const episodeId = `ep-${episodeNumber}`;
  const interactionKey = `interactions_${seriesSlug}_${episodeId}`;

  let localState = getLocalInteractionState(interactionKey);
  const wasLiked = localState.hasLiked || false;

  const currentLikesText = likeContainer.textContent.trim();
  const currentLikes = parseInt(currentLikesText.match(/\d+/)?.[0] || "0", 10);

  const newLikes = wasLiked ? currentLikes - 1 : currentLikes + 1;

  qsa(
    `[data-episode-number="${episodeNumber}"] .detail-episode-likes, [data-episode-number="${episodeNumber}"] .player-episode-likes`
  ).forEach((el) => {
    el.innerHTML = `<i class="fas fa-heart"></i> ${newLikes}`;
    el.classList.toggle("liked", !wasLiked);
  });

  queueAction(seriesSlug, {
    type: wasLiked ? "unlike" : "like",
    chapter: episodeId,
  });

  localState.hasLiked = !wasLiked;
  setLocalInteractionState(interactionKey, localState);
}

export async function renderEpisodesListView(seriesData, seriesSlug) {
  const container = qs("#series-detail-section");
  if (!container || !seriesData) return;

  currentSeriesStats = await fetchSeriesStats(seriesSlug);

  const navTabsHtml = generateNavTabs(seriesData, seriesSlug, "anime");
  const episodes = seriesData.episodes || [];

  let episodeListHtml = "<p>Aucun épisode disponible pour le moment.</p>";
  if (episodes.length > 0) {
    episodeListHtml = episodes
      .sort((a, b) => b.indice_ep - a.indice_ep)
      .map((ep) => {
        const episodeId = `ep-${ep.indice_ep}`;
        const interactionKey = `interactions_${seriesSlug}_${episodeId}`;
        const localState = getLocalInteractionState(interactionKey);
        const serverStats = currentSeriesStats[episodeId] || { likes: 0 };

        let displayLikes = serverStats.likes;
        if (localState.hasLiked) {
          displayLikes = Math.max(
            displayLikes,
            (currentSeriesStats[episodeId]?.likes || 0) + 1
          );
        }

        const likesHtml = `<span class="detail-episode-likes ${
          localState.hasLiked ? "liked" : ""
        }"><i class="fas fa-heart"></i> ${displayLikes}</span>`;

        return `
            <a href="/${seriesSlug}/episodes/${
          ep.indice_ep
        }" class="detail-episode-item" data-episode-number="${ep.indice_ep}">
              <div class="episode-main-info">
                <span class="detail-episode-number">Épisode ${
                  ep.indice_ep
                }</span>
                <span class="detail-episode-title">${
                  ep.title_ep || "Titre inconnu"
                }</span>
              </div>
              <div class="episode-side-info">
                ${likesHtml}
                <span class="detail-episode-date">${timeAgo(ep.date_ep)}</span>
              </div>
            </a>
          `;
      })
      .join("");
  }

  const episodesViewHtml = `
      ${generateAnimeHeader(seriesData, {
        primaryInfoWrapperClasses: "no-bottom-margin",
        additionalMetadataClasses: "no-top-margin",
      })}
      <div id="reading-actions-container"></div>
      ${navTabsHtml}
      <div id="chapters-list-section" class="episodes-main-header">
          <h3 class="section-title">Liste des épisodes</h3>
      </div>
      <div class="episode-list-container">
          ${episodeListHtml}
      </div>
    `;

  container.innerHTML = episodesViewHtml;
  document.title = `BigSolo – Épisodes de ${seriesData.title}`;
  renderReadingActions(seriesData, seriesSlug);

  const episodeListContainer = qs(".episode-list-container");
  if (episodeListContainer) {
    episodeListContainer.addEventListener("click", (e) =>
      handleEpisodeLikeClick(e, seriesSlug)
    );
  }

  initMainScrollObserver();
}

export async function renderEpisodePlayerView(
  seriesData,
  seriesSlug,
  episodeNumber
) {
  const container = qs("#series-detail-section");
  if (!container || !seriesData) return;

  currentSeriesStats = await fetchSeriesStats(seriesSlug);

  const episodes = seriesData.episodes || [];
  const currentEpisode = episodes.find((ep) => ep.indice_ep == episodeNumber);

  if (!currentEpisode) {
    container.innerHTML = `<div class="episode-player-page error"><p>Épisode non trouvé.</p><a href="/${seriesSlug}/episodes">Retour à la liste des épisodes</a></div>`;
    return;
  }

  const sortedEpisodes = [...episodes].sort(
    (a, b) => b.indice_ep - a.indice_ep
  );

  const episodeListHtml = sortedEpisodes
    .map((ep) => {
      const isActive = ep.indice_ep == episodeNumber ? "active" : "";

      const episodeId = `ep-${ep.indice_ep}`;
      const interactionKey = `interactions_${seriesSlug}_${episodeId}`;
      const localState = getLocalInteractionState(interactionKey);
      const serverStats = currentSeriesStats[episodeId] || { likes: 0 };
      let displayLikes = serverStats.likes;
      if (localState.hasLiked) {
        displayLikes = Math.max(
          displayLikes,
          (currentSeriesStats[episodeId]?.likes || 0) + 1
        );
      }
      const likesHtml = `<span class="player-episode-likes ${
        localState.hasLiked ? "liked" : ""
      }"><i class="fas fa-heart"></i> ${displayLikes}</span>`;

      return `
        <a href="/${seriesSlug}/episodes/${
        ep.indice_ep
      }" class="player-episode-item ${isActive}" data-episode-number="${
        ep.indice_ep
      }">
          <span class="player-episode-number">Ép. ${ep.indice_ep}</span>
          <span class="player-episode-title">${
            ep.title_ep || "Titre inconnu"
          }</span>
          ${likesHtml}
        </a>
      `;
    })
    .join("");

  const chronoSortedEpisodes = [...episodes].sort(
    (a, b) => a.indice_ep - b.indice_ep
  );
  const currentIndex = chronoSortedEpisodes.findIndex(
    (ep) => ep.indice_ep == episodeNumber
  );
  const prevEpisode =
    currentIndex > 0 ? chronoSortedEpisodes[currentIndex - 1] : null;
  const nextEpisode =
    currentIndex < chronoSortedEpisodes.length - 1
      ? chronoSortedEpisodes[currentIndex + 1]
      : null;

  const prevButton = prevEpisode
    ? `<a href="/${seriesSlug}/episodes/${prevEpisode.indice_ep}" class="episode-nav-button" data-episode-number="${prevEpisode.indice_ep}"><i class="fas fa-chevron-left"></i> Précédent</a>`
    : `<span class="episode-nav-button disabled"><i class="fas fa-chevron-left"></i> Précédent</span>`;
  const nextButton = nextEpisode
    ? `<a href="/${seriesSlug}/episodes/${nextEpisode.indice_ep}" class="episode-nav-button" data-episode-number="${nextEpisode.indice_ep}">Suivant <i class="fas fa-chevron-right"></i></a>`
    : `<span class="episode-nav-button disabled">Suivant <i class="fas fa-chevron-right"></i></span>`;

  let embedUrl = "";
  if (currentEpisode.type === "vidmoly" && currentEpisode.id) {
    // On garde la compatibilité avec Vidmoly si besoin
    embedUrl = `https://vidmoly.net/embed-${currentEpisode.id}.html`;
  } else if (currentEpisode.type === "gdrive" && currentEpisode.id) {
    // NOUVELLE LOGIQUE POUR GOOGLE DRIVE
    // On utilise le lien /preview pour l'intégration dans un iframe
    embedUrl = `https://drive.google.com/file/d/${currentEpisode.id}/preview`;
  }

  if (!embedUrl) {
    container.innerHTML = `<div class="episode-player-page error"><p>Le format de la vidéo n'est pas supporté.</p></div>`;
    return;
  }

  const playerViewHtml = `
      <div class="episode-player-page">
        <div class="player-header">
          <a href="/${seriesSlug}/episodes" class="player-series-title">${
    seriesData.title
  }</a>
          <h1 class="player-episode-main-title">Épisode ${
            currentEpisode.indice_ep
          } : ${currentEpisode.title_ep || ""}</h1>
        </div>
        <div class="player-layout-grid">
          <aside class="player-sidebar">
            <h3 class="sidebar-title">Épisodes</h3>
            <div class="player-episode-list-wrapper">
              ${episodeListHtml}
            </div>
          </aside>
          <div class="player-main-content">
            <div class="video-player-wrapper">
              <iframe src="${embedUrl}" scrolling="no" frameborder="0" allowfullscreen="true" webkitallowfullscreen="true" mozallowfullscreen="true" allow="autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer"></iframe>
            </div>
            <div class="episode-navigation">
                ${prevButton}
                ${currentEpisode.indice_ep === chronoSortedEpisodes[chronoSortedEpisodes.length - 1].indice_ep 
                  ? `<span class="episode-nav-button last-button disabled"><i class="fas fa-fast-forward"></i> Dernier</span>`
                  : `<a href="/${seriesSlug}/episodes/${chronoSortedEpisodes[chronoSortedEpisodes.length - 1].indice_ep}" class="episode-nav-button last-button"><i class="fas fa-fast-forward"></i> Dernier</a>`
                }
                ${nextButton}
            </div>
          </div>
        </div>
      </div>
    `;

  container.innerHTML = playerViewHtml;
  document.title = `BigSolo – ${seriesData.title} - Épisode ${currentEpisode.indice_ep}`;
  saveReadingProgress(seriesSlug, episodeNumber);

  // ↓↓↓ LA CORRECTION EST ICI ↓↓↓
  const sidebarList = qs(".player-episode-list-wrapper");
  if (sidebarList) {
    sidebarList.addEventListener("click", (e) => {
      // On ne gère le clic QUE si la cible est un bouton de like.
      // Cela fonctionne pour l'épisode actif ET les autres.
      if (e.target.closest(".player-episode-likes")) {
        handleEpisodeLikeClick(e, seriesSlug);
      }
    });
  }

  qs(".player-episode-item.active")?.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
}
