// js/pages/series-detail/LNReader/settings.js
import { qs } from "../../../utils/domUtils.js";
import { state, dom, setThemeClass } from "./state.js";

export function saveSettings() {
  localStorage.setItem("les_poroiniens_ln_settings_v1", JSON.stringify(state.settings));
}

export function loadSettings() {
  const raw = localStorage.getItem("les_poroiniens_ln_settings_v1");
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    // migrate: if someone stored px-like values (e.g. >4), convert to em
    if (saved.fontSize && saved.fontSize > 4) saved.fontSize = +(saved.fontSize / 16).toFixed(2);
    Object.assign(state.settings, saved);
  } catch (e) { console.warn("LN prefs parse:", e); }
}

export function bindControls() {
  const art = qs("#ln-article");

  // MàJ visuelle centralisée
  const apply = () => {
    art.style.setProperty("--ln-font-family", state.settings.fontFamily);
    art.style.setProperty("--ln-font-size",  state.settings.fontSize + "em");
    art.style.setProperty("--ln-leading",    state.settings.leading);
    art.style.setProperty("--ln-tracking",   state.settings.tracking + "px");
    art.style.textAlign = state.settings.align;
    setThemeClass();

    // UI values
    // qs("#ln-font-size-val").textContent = state.settings.fontSize + "px";
    qs("#ln-font-size-val").textContent = Math.round(state.settings.fontSize * 16) + "px"; // si 1em = 16px
    qs("#ln-leading-val").textContent   = String(state.settings.leading);
    qs("#ln-tracking-val").textContent  = state.settings.tracking + "px";
    const f = qs("#ln-font-family"); if (f) f.value = state.settings.fontFamily;
    const a = qs("#ln-align");       if (a) a.value = state.settings.align;
  };

  // Police
  qs("#ln-font-family")?.addEventListener("change", (e) => {
    state.settings.fontFamily = e.target.value;
    apply(); saveSettings();
  });

  // Taille
  document.querySelectorAll("[data-font]").forEach(btn => {
    btn.addEventListener("click", () => {
      const dir = btn.getAttribute("data-font");
      const next = +(state.settings.fontSize + (dir === "+" ? 0.05 : -0.05)).toFixed(2);
      setFontSize(next);
      state.settings.fontSize = next;   // keep value in em
      apply(); saveSettings();
    });
  });

  // Interligne
  document.querySelectorAll("[data-leading]").forEach(btn => {
    btn.addEventListener("click", () => {
      const dir = btn.getAttribute("data-leading");
      const next = +(state.settings.leading + (dir === "+" ? 0.1 : -0.1)).toFixed(1);
      setLeading(next); // <-- utilise la fonction qui limite la plage
      state.settings.leading = parseFloat(art.style.lineHeight); // sauvegarde la valeur réelle
      apply(); saveSettings();
    });
  });

  // Lettrage
  document.querySelectorAll("[data-tracking]").forEach(btn => {
    btn.addEventListener("click", () => {
      const dir = btn.getAttribute("data-tracking");
      state.settings.tracking = Math.min(8, Math.max(0, state.settings.tracking + (dir === "+" ? 1 : -1)));
      apply(); saveSettings();
    });
  });

  // Alignement
  qs("#ln-align")?.addEventListener("change", (e) => {
    state.settings.align = e.target.value;
    apply(); saveSettings();
  });

  // Thème
  qs("#ln-theme")?.addEventListener("click", () => {
    state.settings.themeDark = !state.settings.themeDark;
    apply(); saveSettings();
  });

  // Reset
  qs("#ln-reset")?.addEventListener("click", () => {
    Object.assign(state.settings, {
      fontFamily: "'Inter', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      fontSize: 1.0,
      leading: 1.8,
      tracking: 0,
      align: "justify",
      themeDark: false,
    });
    apply(); saveSettings();
  });

  // Ajustements selon mobile/desktop
  function isMobile() {
    return window.innerWidth <= 600;
  }

  // Exemple pour la taille de police
  const minFontSize = isMobile() ? 0.9 : 1.0; // em
  const maxFontSize = isMobile() ? 1.3 : 2.0; // em

  // Exemple pour l'interligne
  const minLeading = isMobile() ? 1.4 : 1.5;
  const maxLeading = isMobile() ? 2.0 : 2.5;

  // Quand tu modifies la taille/interligne, vérifie la plage :
  function setFontSize(em) {
    const size = Math.max(minFontSize, Math.min(maxFontSize, em));
    art.style.setProperty("--ln-font-size", size + "em");
  }

  function setLeading(val) {
    const leading = Math.max(minLeading, Math.min(maxLeading, val));
    art.style.lineHeight = leading;
  }

  // Initial
  apply();
}