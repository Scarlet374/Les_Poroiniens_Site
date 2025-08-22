// js/pages/series-detail/MangaReader/reader.js
import { qs, slugify } from "../../../utils/domUtils.js";
import { state } from "./state.js";
import { setupUI, handleError, renderInteractionsSection } from "./ui.js";
import { fetchAndLoadPages } from "./data.js";
import { getInitialPageNumberFromUrl, preloadImages } from "./navigation.js";
import { loadSettings } from "./settings.js";
import { initializeEvents, attachInteractionListeners } from "./events.js";
import {
  fetchSeriesStats,
  getLocalInteractionState,
} from "../../../utils/interactions.js";

export async function initMangaReader() {
  const dataPlaceholder = qs("#reader-data-placeholder");
  if (
    !dataPlaceholder?.textContent ||
    dataPlaceholder.textContent.includes("READER_DATA_PLACEHOLDER")
  ) {
    return handleError(
      "Les données du lecteur n'ont pas été trouvées dans la page."
    );
  }

  try {
    const readerData = JSON.parse(dataPlaceholder.textContent);
    state.seriesData = readerData.series;
    state.currentChapter = {
      ...readerData.series.chapters[readerData.chapterNumber],
      number: readerData.chapterNumber,
    };
    state.allChapterKeys = Object.keys(readerData.series.chapters)
      .filter((key) => readerData.series.chapters[key].groups?.LesPoroïniens)
      .sort((a, b) => parseFloat(a) - parseFloat(b));

    document.title = `${state.seriesData.title} - Ch. ${state.currentChapter.number} | Les Poroïniens`;

    loadSettings();

    await setupUI();
    initializeEvents();

    const seriesSlug = slugify(state.seriesData.title);
    const chapterNumber = state.currentChapter.number;
    const interactionKey = `interactions_${seriesSlug}_${chapterNumber}`;

    const [stats, localState] = await Promise.all([
      fetchSeriesStats(seriesSlug),
      getLocalInteractionState(interactionKey),
    ]);

    const serverChapterStats = stats[chapterNumber] || {
      likes: 0,
      comments: [],
    };
    let optimisticStats = JSON.parse(JSON.stringify(serverChapterStats));

    // CORRECTION : Logique de comptage optimiste améliorée
    if (localState.hasLiked) {
      optimisticStats.likes = Math.max(optimisticStats.likes, 0) + 1;
    }

    // Pour les commentaires, s'assurer que ceux postés localement sont bien présents
    if (localState.pendingComments) {
      const serverCommentIds = new Set(
        optimisticStats.comments.map((c) => c.id)
      );
      const newComments = localState.pendingComments.filter(
        (pc) => !serverCommentIds.has(pc.id)
      );
      optimisticStats.comments = [...newComments, ...optimisticStats.comments];
    }

    // On s'assure aussi que le nombre total de commentaires est juste
    optimisticStats.comments.length = new Set(
      optimisticStats.comments.map((c) => c.id)
    ).size;

    state.chapterStats = optimisticStats;

    renderInteractionsSection(localState);
    attachInteractionListeners();

    const initialPageNumber = getInitialPageNumberFromUrl();
    fetchAndLoadPages(initialPageNumber);
    preloadImages();
  } catch (error) {
    handleError(`Impossible de charger le lecteur : ${error.message}`);
    console.error(error);
  }
}
