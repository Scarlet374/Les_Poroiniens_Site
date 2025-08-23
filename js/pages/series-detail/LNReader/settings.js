// js/pages/series-detail/LNReader/settings.js
import { qs } from "../../../utils/domUtils.js";
import { state, dom, setThemeClass } from "./state.js";

export function saveSettings() {
  localStorage.setItem("les_poroiniens_ln_settings_v1", JSON.stringify(state.settings));
}

export function loadSettings() {
  const raw = localStorage.getItem("les_poroiniens_ln_settings_v1");
  if (!raw) return;
  try { Object.assign(state.settings, JSON.parse(raw)); }
  catch (e) { console.warn("LN prefs parse:", e); }
}

export function bindControls() {
  const art = qs("#ln-article");

  // MàJ visuelle centralisée
  const apply = () => {
    art.style.setProperty("--ln-font-family", state.settings.fontFamily);
    art.style.setProperty("--ln-font-size",  state.settings.fontSize + "px");
    art.style.setProperty("--ln-leading",    state.settings.leading);
    art.style.setProperty("--ln-tracking",   state.settings.tracking + "px");
    art.style.textAlign = state.settings.align;
    setThemeClass();

    // UI values
    qs("#ln-font-size-val").textContent = state.settings.fontSize + "px";
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
      state.settings.fontSize = Math.min(36, Math.max(7, state.settings.fontSize + (dir === "+" ? 1 : -1)));
      apply(); saveSettings();
    });
  });

  // Interligne
  document.querySelectorAll("[data-leading]").forEach(btn => {
    btn.addEventListener("click", () => {
      const dir = btn.getAttribute("data-leading");
      state.settings.leading = +(Math.min(2.4, Math.max(1.2, state.settings.leading + (dir === "+" ? 0.1 : -0.1)))).toFixed(1);
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
      fontSize: 20,
      leading: 1.8,
      tracking: 0,
      align: "justify",
      themeDark: false,
    });
    apply(); saveSettings();
  });

  apply();
}