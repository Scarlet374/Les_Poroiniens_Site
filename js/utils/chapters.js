// /js/utils/chapters.js
export function parseChapterKey(key) {
  const [majStr, minStr] = String(key).split(".");
  const maj = Number(majStr);
  const min = minStr !== undefined ? Number(minStr) : 0;
  return { maj: Number.isFinite(maj) ? maj : Infinity, min: Number.isFinite(min) ? min : 0 };
}

export function formatChapterHeadingAndTitle(chKey, rawTitle) {
  const title = String(rawTitle || "").trim();
  const norm = title.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const isPrologue = /^prologue\b/.test(norm);
  const isEpilogue = /^epilogue\b/.test(norm);

  if (isPrologue || isEpilogue) {
    return { heading: title, subtitle: "", suppressTitle: true };
  }

  const { maj, min } = parseChapterKey(chKey);
  if (min > 0) {
    const clean = title.replace(/^Extra\s*\d+\s*:\s*/i, "").trim();
    return { heading: `Extra ${min}`, subtitle: clean, suppressTitle: false };
  }

  return { heading: `Chapitre ${maj}`, subtitle: title, suppressTitle: false };
}
