// js/pages/cache-management.js
import { fetchData, fetchAllSeriesData } from "../utils/fetchUtils.js";
import { slugify, qs } from "../utils/domUtils.js";

function renderChapterList(allSeries) {
  const container = qs("#cache-list-container");
  const statusEl = qs("#status");
  if (!container || !statusEl) return;

  statusEl.style.display = "none";
  container.innerHTML = ""; // Vide le conteneur

  // Trier les séries par ordre alphabétique
  allSeries.sort((a, b) => a.title.localeCompare(b.title));

  allSeries.forEach((series) => {
    const seriesSlug = slugify(series.title);
    const chapters = Object.entries(series.chapters)
      .filter(([, chapData]) => chapData.groups?.LesPoroïniens) // Ne montrer que les chapitres hébergés
      .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0])); // Trier chapitres du plus récent au plus ancien

    if (chapters.length === 0) return;

    const seriesGroupEl = document.createElement("div");
    seriesGroupEl.className = "series-group";

    let chaptersHtml = "";
    chapters.forEach(([chapterNumber, chapterData]) => {
      chaptersHtml += `
                <li class="chapter-item" data-series-slug="${seriesSlug}" data-chapter-number="${chapterNumber}">
                    <div class="chapter-info">
                        Chapitre ${chapterNumber}
                        <span class="chapter-title">${
                          chapterData.title || ""
                        }</span>
                    </div>
                    <button class="purge-btn">
                        <i class="fas fa-sync-alt"></i> Vider le cache
                    </button>
                </li>
            `;
    });

    seriesGroupEl.innerHTML = `
            <div class="series-header">${series.title}</div>
            <ul class="chapters-list">${chaptersHtml}</ul>
        `;
    container.appendChild(seriesGroupEl);
  });
}

async function handlePurgeClick(event) {
  const button = event.target.closest(".purge-btn");
  if (!button) return;

  const item = button.closest(".chapter-item");
  const { seriesSlug, chapterNumber } = item.dataset;
  const token = sessionStorage.getItem("admin_token");

  if (
    !confirm(`Vider le cache pour "${seriesSlug}", chapitre ${chapterNumber} ?`)
  )
    return;

  button.disabled = true;
  button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Purge...`;

  try {
    const response = await fetch("/api/admin/purge-cache", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ seriesSlug, chapterNumber }),
    });
    const result = await response.json();

    if (!response.ok)
      throw new Error(result.message || `Erreur ${response.status}`);

    button.style.backgroundColor = "#28a745"; // Vert succès
    button.innerHTML = `<i class="fas fa-check"></i> Cache vidé !`;
  } catch (error) {
    console.error("Erreur de purge:", error);
    button.style.backgroundColor = "#dc3545"; // Rouge erreur
    button.innerHTML = `<i class="fas fa-times"></i> Erreur`;
    alert(`Erreur: ${error.message}`);
  } finally {
    setTimeout(() => {
      button.disabled = false;
      button.style.backgroundColor = ""; // Rétablit la couleur par défaut
      button.innerHTML = `<i class="fas fa-sync-alt"></i> Vider le cache`;
    }, 3000);
  }
}

export async function initCacheManagementPage() {
  const token = sessionStorage.getItem("admin_token");
  if (!token) {
    window.location.href = "/admins.html";
    return;
  }

  qs("#logout-btn").addEventListener("click", () => {
    sessionStorage.removeItem("admin_token");
    window.location.href = "/admins.html";
  });

  try {
    const allSeries = await fetchAllSeriesData();
    renderChapterList(allSeries);
    qs("#cache-list-container").addEventListener("click", handlePurgeClick);
  } catch (error) {
    qs(
      "#status"
    ).textContent = `Erreur lors du chargement des données : ${error.message}`;
    console.error(error);
  }
}
