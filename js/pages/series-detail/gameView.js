// js/pages/series-detail/gameView.js
import { qs } from "../../utils/domUtils.js";

/* ---------- utils ---------- */
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

const isAdult = (s) => String(s?.manga_type || "").toLowerCase() === "pornographique";

function entries(o) {
  return o && typeof o === "object" ? Object.entries(o) : [];
}

// Transforme preview_image en [{lq, hq}, ...] trié par "preview"
function normalizePreviews(preview_image) {
  if (!preview_image) return [];

  // Array ?
  if (Array.isArray(preview_image)) {
    // cas array d'objets {preview, hq_res, lq_res} (nouveau schéma)
    if (preview_image.length && typeof preview_image[0] === "object") {
      return preview_image
        .slice()
        .sort((a, b) => (a.preview || 0) - (b.preview || 0))
        .map(p => ({
          lq: p.lq_res || p.hq_res || p.url_lq || p.url || null,
          hq: p.hq_res || p.url_hq || p.lq_res || p.url || null,
        }))
        .filter(p => p.lq || p.hq);
    }
    // cas array de strings
    return preview_image.map(u => ({ lq: u, hq: u }));
  }

  // Objet indexé { "1": "url", "2": "url", ... }
  if (typeof preview_image === "object") {
    return Object.entries(preview_image)
      .sort(([a], [b]) => parseInt(a, 10) - parseInt(b, 10))
      .map(([, u]) => ({ lq: u, hq: u }));
  }

  return [];
}

function pickCover(series) {
  // 1) cover si dispo, sinon première preview (de préférence HQ si tu veux net)
  const previews = normalizePreviews(series?.preview_image);
  return series?.cover || previews[0]?.hq || previews[0]?.lq || "/img/placeholder_preview.png";
}

function icon(name) {
  // tu peux changer ces icônes au besoin (font-awesome déjà présent chez toi)
  const map = {
    patch: '<i class="fas fa-language"></i>',
    ext: '<i class="fas fa-link"></i>',
  };
  return map[name] || "";
}

/* ---------- LIGHTBOX ---------- */
function makeLightbox(urls, startIndex = 0) {
  let index = startIndex;
  const overlay = document.createElement("div");
  overlay.className = "gv-lightbox";
  overlay.innerHTML = `
    <button class="gv-lb-btn gv-lb-close" aria-label="Fermer">✕</button>
    <button class="gv-lb-btn gv-lb-prev" aria-label="Précédent">❮</button>
    <img class="gv-lb-img" alt="">
    <button class="gv-lb-btn gv-lb-next" aria-label="Suivant">❯</button>
  `;

  const img = overlay.querySelector(".gv-lb-img");
  const btnPrev = overlay.querySelector(".gv-lb-prev");
  const btnNext = overlay.querySelector(".gv-lb-next");
  const btnClose = overlay.querySelector(".gv-lb-close");

  const clamp = () => {
    if (index < 0) index = urls.length - 1;
    if (index >= urls.length) index = 0;
  };
  const preload = (i) => {
    const a = new Image(); a.src = urls[(i + 1) % urls.length];
    const b = new Image(); b.src = urls[(i - 1 + urls.length) % urls.length];
  };
  const show = () => {
    clamp();
    img.src = urls[index];
    preload(index);
  };

  const next = () => { index++; show(); };
  const prev = () => { index--; show(); };
  const close = () => {
    document.removeEventListener("keydown", onKey);
    overlay.remove();
    document.body.classList.remove("no-scroll");
  };

  const onKey = (e) => {
    if (e.key === "Escape") close();
    if (e.key === "ArrowRight") next();
    if (e.key === "ArrowLeft") prev();
  };

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  btnClose.addEventListener("click", close);
  btnPrev.addEventListener("click", prev);
  btnNext.addEventListener("click", next);
  document.addEventListener("keydown", onKey);

  document.body.appendChild(overlay);
  document.body.classList.add("no-scroll");
  show();
}

/* ---------- PATCH CTA + helpers ---------- */
function truthy(v){ if(v===true||v===1) return true; const s=String(v??"").toLowerCase(); return ["1","true","yes","y","o","oui"].includes(s); }
function hasPatches(series){ return Array.isArray(series?.patches) && series.patches.length>0; }

function renderPatchCTA(series){
  // Si tu as le nouveau schéma "patches": un seul bouton qui ouvrira la modale
  if (hasPatches(series)) {
    return `<button class="gv-action primary" id="open-patch-modal">
              ${icon("patch")} Télécharger le patch
            </button>`;
  }
  // Rétro-compat: anciens liens patch_link
  return entries(series.patch_link).map(([name,url]) =>
    `<a class="gv-action primary" href="${esc(url)}" target="_blank" rel="noopener">
       ${icon("patch")} Patch FR (${esc(name)})
     </a>`).join("");
}

// Détection de plateforme par défaut (optionnelle)
function detectPlatform(){
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("android")) return "android";
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios")) return "ios";
  if (ua.includes("win")) return "windows";
  if (ua.includes("mac")) return "macos";
  return "linux";
}

// Semver-ish tri (tolérant)
function cmpVerDesc(a,b){
  const pa = String(a).split(".").map(n=>parseInt(n,10)||0);
  const pb = String(b).split(".").map(n=>parseInt(n,10)||0);
  for(let i=0;i<Math.max(pa.length,pb.length);i++){
    const da = pa[i]||0, db = pb[i]||0;
    if (da!==db) return db-da;
  }
  return 0;
}

/* ---------- Modale de téléchargement façon Modrinth ---------- */
function openPatchModal(patches, installNotes={}){
  if (!Array.isArray(patches) || patches.length===0) return;

  // copie triée (version desc, puis date desc si besoin)
  const list = [...patches].sort((a,b)=> cmpVerDesc(a.version,b.version) || String(b.released||"").localeCompare(String(a.released||"")));

  const backdrop = document.createElement("div");
  backdrop.className = "progress-backdrop active";      // réutilise ton overlay
  const modal = document.createElement("div");
  modal.className = "progress-modal";                   // réutilise ta carte modal
  modal.innerHTML = `
    <div class="progress-header">
      <div class="progress-title">Télécharger le patch</div>
      <button class="progress-close" aria-label="Fermer">✕</button>
    </div>
    <div class="progress-body">
      <div class="mb-2">
        <label for="sel-version"><strong>Version</strong></label>
        <select id="sel-version" class="w-full" style="width:100%; margin-top:6px; padding:8px 10px; border-radius:10px; border:1px solid rgba(0,0,0,.12)"></select>
      </div>

      <div class="mb-2">
        <label for="sel-platform"><strong>Plateforme</strong></label>
        <select id="sel-platform" class="w-full" style="width:100%; margin-top:6px; padding:8px 10px; border-radius:10px; border:1px solid rgba(0,0,0,.12)"></select>
      </div>

      <div id="patch-notes" style="margin:8px 0 12px; font-size:.95rem;"></div>
      <div id="install-notes" style="margin:0 0 14px; font-size:.95rem; opacity:.9;"></div>

      <div style="display:flex; gap:10px; justify-content:flex-end">
        <a id="btn-download" class="gv-action primary" target="_blank" rel="noopener">Télécharger</a>
      </div>
    </div>
  `;
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  const $ = (sel) => modal.querySelector(sel);
  const selVersion = $("#sel-version");
  const selPlatform = $("#sel-platform");
  const patchNotes = $("#patch-notes");
  const install = $("#install-notes");
  const btnDl = $("#btn-download");

  // remplit la liste des versions
  list.forEach(p => {
    const date = p.released ? ` — ${p.released}` : "";
    const ch   = p.channel && p.channel!=="stable" ? ` [${p.channel}]` : "";
    const opt  = document.createElement("option");
    opt.value  = p.version;
    opt.textContent = `${p.version}${ch}${date}`;
    selVersion.appendChild(opt);
  });

  function buildPlatforms(patch){
    selPlatform.innerHTML = "";
    const byPlat = (patch.files||[]).reduce((acc,f)=>{ if(f.platform) acc.push(f.platform); return acc; }, []);
    const uniq = [...new Set(byPlat)];
    uniq.forEach(plat => {
      const opt = document.createElement("option");
      opt.value = plat;
      opt.textContent = plat.charAt(0).toUpperCase()+plat.slice(1);
      selPlatform.appendChild(opt);
    });
    // sélection auto sur plateforme détectée si dispo
    const guess = detectPlatform();
    if (uniq.includes(guess)) selPlatform.value = guess;
  }

  function currentPatch(){
    return list.find(p => p.version === selVersion.value) || list[0];
  }
  function currentFile(){
    const p = currentPatch();
    const plat = selPlatform.value;
    return (p.files||[]).find(f => f.platform === plat) || null;
  }

  function refreshUI(){
    const p = currentPatch();
    buildPlatforms(p);
    patchNotes.innerHTML = p.notes ? `<div class="progress-up2date">${esc(p.notes)}</div>` : "";
    const plat = selPlatform.value;
    install.innerHTML = installNotes && installNotes[plat] ? `<em>${esc(installNotes[plat])}</em>` : "";
    const f = currentFile();
    btnDl.href = f?.url || "#";
    btnDl.setAttribute("download", "");
    btnDl.textContent = f?.size_mb ? `Télécharger (${f.size_mb} MB)` : "Télécharger";
    btnDl.classList.toggle("disabled", !f);
  }

  selVersion.addEventListener("change", refreshUI);
  selPlatform.addEventListener("change", () => {
    const f = currentFile();
    btnDl.href = f?.url || "#";
    install.innerHTML = installNotes && installNotes[selPlatform.value] ? `<em>${esc(installNotes[selPlatform.value])}</em>` : "";
  });

  // init
  selVersion.value = list[0].version;
  refreshUI();

  // close handlers
  const close = () => backdrop.remove();
  modal.querySelector(".progress-close").addEventListener("click", close);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
}

/* ---------- RENDU ---------- */
export function renderGameView(series) {
  const host = qs("#series-detail-section");
  if (!host || !series) return;

  const adult = isAdult(series);
  const tags = Array.isArray(series.tags) ? series.tags : [];
  const previews = normalizePreviews(series.preview_image);
  const cover = pickCover(series);

  const authorBtns = entries(series.author_link).map(
    ([name, url]) => `<a class="gv-action" href="${esc(url)}" target="_blank" rel="noopener">${icon("ext")} ${esc(name)}</a>`
  ).join("");

  const actionsHTML = `${renderPatchCTA(series)}${authorBtns}`;

  // layout type "fiche manga" : cover à gauche, infos à droite
  host.innerHTML = `
    <section class="gv">
      <div class="gv-card">
        <div class="gv-cover">
          <img src="${esc(cover)}" alt="${esc(series.title)}" loading="eager" onerror="this.src='/img/placeholder_preview.png'">
        </div>

        <div class="gv-main">
          <h1 class="gv-title">
            ${esc(series.title)}
          </h1>

          ${tags.length ? `<div class="tags gv-tags">${tags.slice(0, 10).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : ""}

          <div class="gv-actions">
            ${actionsHTML}
          </div>

          <div class="gv-synopsis">
            ${series.description ? esc(series.description) : "Aucune description."}
          </div>

          <div class="gv-meta">
            <div><strong>Auteur :</strong> ${esc(series.author || "—")}</div>
            <div><strong>Artiste :</strong> ${esc(series.artist || "—")}</div>
            <div><strong>Année :</strong> ${esc(series.release_year || "—")}</div>
            <div><strong>Plateforme :</strong> PC / Linux </div>
          </div>
        </div>
      </div>

      ${
        previews.length
          ? `
        <h2 class="gv-subtitle">Galerie (${previews.length})</h2>
        <div class="gv-gallery">
        ${previews.map((p, i) => `
          <button class="gv-shot" data-idx="${i}" aria-label="Agrandir l'image ${i + 1}">
            <img
              src="${esc(p.lq || p.hq)}"
              data-hq="${esc(p.hq || p.lq)}"
              loading="lazy" decoding="async" fetchpriority="low"
              alt="">
          </button>`).join("")}
        </div>`
          : ""
      }
    </section>
  `;

    // après host.innerHTML …
    const openBtn = host.querySelector("#open-patch-modal");
    if (openBtn) {
    openBtn.addEventListener("click", () => openPatchModal(series.patches, series.install));
    }

  // click -> lightbox + ← →
  if (previews.length) {
    const hqUrls = previews.map(p => p.hq || p.lq);  // fallback si pas de HQ
    host.querySelectorAll(".gv-shot").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-idx"), 10) || 0;
        makeLightbox(hqUrls, idx); // ← on envoie les HQ à la lightbox
      });
    });
  }

  // titre page
  document.title = `Les Poroïniens – ${series.title}`;
}