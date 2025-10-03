// /js/utils/chapters.js
export function parseChapterKey(key) {
  const [majStr, minStr] = String(key).split(".");
  const maj = Number(majStr);
  const min = minStr !== undefined ? Number(minStr) : 0;
  return { maj: Number.isFinite(maj) ? maj : Infinity, min: Number.isFinite(min) ? min : 0 };
}

// Tri strictement basé sur l'ID (maj.min), pas sur les libellés.
export function compareChapterKeys(aKey, bKey) {
  const a = parseChapterKey(aKey);
  const b = parseChapterKey(bKey);
  if (a.maj !== b.maj) return a.maj - b.maj;
  return a.min - b.min;
}

/**
 * Construit les libellés à afficher.
 * - si opts.label existe => on l'utilise tel quel pour l'en-tête (le "titre bleu")
 * - sinon on garde l'auto: Prologue/Epilogue/Extra/Chapitre + numéro
 */
export function formatChapterHeadingAndTitle(chKey, rawTitle, opts = {}) {
  const overrideLabel = String(opts.label || opts.heading || "").trim();
  const title = String(rawTitle || "").trim();

  // Si un label manuel est fourni, on l'utilise tel quel
  if (overrideLabel) {
    return { heading: overrideLabel, subtitle: title, suppressTitle: false };
  }

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

// -> retourne un libellé compact pour les boutons
export function makeCompactButtonHeading(chKey, chData) {
  const { heading } = formatChapterHeadingAndTitle(
    chKey,
    chData?.title,
    { label: chData?.label }
  );

  // "Chapitre 5.1" -> "Ch. 5.1"
  const m = /^Chapitre\s+(.+)$/i.exec(heading);
  if (m) return `Ch. ${m[1]}`;

  // Sinon on garde tel quel (Prologue, Extra 1, Interlude..., label custom, etc.)
  return heading;
}