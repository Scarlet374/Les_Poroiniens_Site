// js/utils/dateUtils.js

export function parseDateToTimestamp(dateInput) {
  if (dateInput == null || dateInput === "") return NaN;

  // Nombres : secondes ou millisecondes
  if (typeof dateInput === "number") {
    return dateInput < 1e12 ? dateInput * 1000 : dateInput;
  }

  const s = String(dateInput).trim();

  // Timestamps en string
  if (/^\d{13}$/.test(s)) return Number(s);        // ms
  if (/^\d{10}$/.test(s)) return Number(s) * 1000; // s

  // ------- Formats FR : DD/MM/YYYY [HH:mm] ou [HHhmm] -------
  let m = s.match(
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[\/\s]+(\d{1,2})(?:(?::|h)(\d{1,2}))?)?$/
  );
  if (m) {
    const [, d, mo, y, H = "0", Mi = "0"] = m;
    return safeLocal(y, mo, d, H, Mi, 0);
  }

  // ------- ISO "naïf" (sans fuseau) : YYYY-MM-DD [HH[:mm[:ss]]] -------
  m = s.match(
    /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[ T]+(\d{1,2})(?::(\d{2})(?::(\d{2}))?)?)?$/
  );
  if (m) {
    const [, y, mo, d, H = "0", Mi = "0", S = "0"] = m;
    return safeLocal(y, mo, d, H, Mi, S);
  }

  // ------- ISO avec fuseau ('Z' ou '+02:00') : on laisse le moteur gérer en UTC -------
  if (/[zZ]|[+\-]\d{2}:\d{2}$/.test(s)) {
    const t = Date.parse(s);
    if (!Number.isNaN(t)) return t;
  }

  // Fallback général (noms de mois, etc.)
  const t = Date.parse(s);
  return Number.isNaN(t) ? NaN : t;

  // ---- helpers ----
  function safeLocal(y, mo, d, H, Mi, S) {
    const DEFAULT_HOUR_FOR_DATE_ONLY = 0; // mets 12 si tu veux "midi local" quand l'heure est absente
    const yr = parseInt(y, 10);
    const mon = parseInt(mo, 10) - 1;
    const day = parseInt(d, 10);
    const hh = H == null ? DEFAULT_HOUR_FOR_DATE_ONLY : (parseInt(H, 10) || 0);
    const mm = parseInt(Mi, 10) || 0;
    const ss = parseInt(S, 10) || 0;

    const dt = new Date(yr, mon, day, hh, mm, ss); // ← LOCAL time
    // Validation pour éviter les débordements (31/02 -> 03/03, etc.)
    if (
      dt.getFullYear() !== yr ||
      dt.getMonth() !== mon ||
      dt.getDate() !== day
    ) {
      return NaN;
    }
    return dt.getTime();
  }
}

// ... timeAgo et formatDateForGallery restent inchangés pour l'instant ...
// Mais ils dépendent de la correction de parseDateToTimestamp.
// Vérifie que formatDateForGallery utilise bien le bon timestamp pour les dates de colos.json
// colos.json a des dates comme "2025-04-24 00:00:00", ce qui devrait être bien géré par la partie YYYY-MM-DD.
export function timeAgo(dateInput) {
  const timestamp = parseDateToTimestamp(dateInput);
  if (isNaN(timestamp)) {
    // console.warn("timeAgo: Invalid date input, resulted in NaN timestamp:", dateInput);
    return "Date inconnue";
  }

  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.round(diff / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);
  // const weeks = Math.round(days / 7);

  if (seconds < 5) return "à l’instant";
  if (seconds < 60) return `${seconds} sec`;
  if (minutes < 60) return `${minutes} min`;
  if (hours < 24) return `${hours} h`;
  if (days < 7) return `${days} j`;
  
  return new Date(timestamp).toLocaleDateString("fr-FR", {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateForGallery(dateInput) { // Renommé dateInput pour clarté
  if (dateInput === null || typeof dateInput === 'undefined' || dateInput === "") return "Date inconnue";
  const timestamp = parseDateToTimestamp(dateInput);
  if (isNaN(timestamp)) {
    // console.warn("formatDateForGallery: Invalid date input, resulted in NaN timestamp:", dateInput);
    return "Date invalide";
  }
  return new Date(timestamp).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}