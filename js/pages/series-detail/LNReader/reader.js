// js/pages/series-detail/LNReader/reader.js
import { qs, slugify } from "../../../utils/domUtils.js";
import { state } from "./state.js";
import { setupUI, renderArticle, renderInteractionsSection } from "./ui.js";
import { fetchChapterHtml } from "./data.js";
import { loadSettings } from "./settings.js";
import { initializeEvents, attachInteractionListeners } from "./events.js";
import { fetchSeriesStats, getLocalInteractionState } from "../../../utils/interactions.js";

export async function initNovelReader() {
  // 1) CSS du LN (une seule fois)
  if (!document.getElementById("ln-css-link")) {
    const link = document.createElement("link");
    link.id = "ln-css-link";
    link.rel = "stylesheet";
    link.href = "/css/ln.css";
    document.head.appendChild(link);
  }

  // 2) Données injectées (placeholder commun au lecteur)
  const ph = qs("#reader-data-placeholder");
  if (!ph?.textContent || ph.textContent.includes("READER_DATA_PLACEHOLDER")) {
    throw new Error("Données lecteur LN absentes.");
  }
  const readerData = JSON.parse(ph.textContent);

  // 3) State courant (série + chapitre)
  state.seriesData = readerData.series;
  state.currentChapter = {
    ...readerData.series.chapters[readerData.chapterNumber],
    number: readerData.chapterNumber,
  };

  // 4) Liste des chapitres lisibles (LN = ceux qui ont 'file')
  state.allChapterKeys = Object.keys(readerData.series.chapters)
    .filter((k) => !!readerData.series.chapters[k].file)
    .sort((a, b) => parseFloat(a) - parseFloat(b));

  // 5) Titre de l’onglet
  document.title = `${state.seriesData.title} - Ch. ${state.currentChapter.number} | Les Poroïniens`;

  // 6) Charger préférences + UI statique
  loadSettings();
  await setupUI();

  // 7) Récupérer les stats + état local d’interaction (comme le MangaReader)
  const seriesSlug = slugify(state.seriesData.title);
  const chapterNumber = state.currentChapter.number;
  const interactionKey = `interactions_${seriesSlug}_${chapterNumber}`;

  const [stats, localState] = await Promise.all([
    fetchSeriesStats(seriesSlug),
    getLocalInteractionState(interactionKey),
  ]);

  // 8) Stats du chapitre courant → state (servira aux compteurs initiaux)
  const serverStats = stats[chapterNumber] || { likes: 0, comments: [] };
  state.chapterStats = { ...serverStats };

  // 9) Charger le texte du chapitre + rendu
  const html = await fetchChapterHtml();
  renderArticle(html);

  // 10) Rendu du panneau d’interactions LN + listeners
  //     (UI LN : injecte dans #ln-interactions ; évite toute condition "webtoon")
  renderInteractionsSection(localState);

  // 11) Événements : pagination LN + interactions (likes/comments)
  initializeEvents();
  attachInteractionListeners();
}