// js/pages/series-detail/LNReader/state.js

// État global du lecteur LN (très proche du MangaReader)
export let state = {
  seriesData: null,
  currentChapter: null,    // { number, title, file, ... }
  allChapterKeys: [],      // triées (nombres en string) des chapitres LN (avec "file")
  chapterStats: { likes: 0, comments: [] },

  // Préférences d’affichage LN
  settings: {
    fontFamily: "'Inter', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    fontSize: 1.0,          // em
    leading: 1.8,          // line-height
    tracking: 0,           // letter-spacing (px)
    align: "justify",      // left | center | justify
    themeDark: false,
    sidebarCollapsed: false,
  },
};

export const dom = {
  root: null,              // #manga-reader-root
  sidebar: null,
  viewerContainer: null,   // .ln-viewer-container
  mobileHeader: null,
  mobileSettingsBtn: null,
  sidebarOverlay: null,
  mobileSeriesTitle: null,
  mobileChapterInfo: null,
  mobileHeaderStats: null,
};

export function setThemeClass() {
  document.documentElement.classList.toggle("ln-theme-dark", !!state.settings.themeDark);
}