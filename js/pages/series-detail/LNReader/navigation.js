// js/pages/series-detail/LNReader/navigation.js
import { slugify } from "../../../utils/domUtils.js";
import { state } from "./state.js";

export function navigateToChapter(delta) {
  const keys = state.allChapterKeys.map(String);
  const idx  = keys.indexOf(String(state.currentChapter.number));
  const nxt  = idx + delta;
  if (nxt < 0 || nxt >= keys.length) return;
  navigateTo(keys[nxt]);
}

export function navigateTo(number) {
  const keys = state.allChapterKeys.map(String);
  const target = String(number);
  if (!keys.includes(target)) return;
  const slug = slugify(state.seriesData.title);
  window.location.href = `/${slug}/${target}`;
}
