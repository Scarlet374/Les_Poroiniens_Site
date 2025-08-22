import { fetchAllSeriesData } from '../utils/fetchUtils.js';
import { slugify, qs } from '../utils/domUtils.js';

let currentLightboxIndex = 0;
let currentCoversData = [];

function updateLightboxNavigation() {
    const prevBtn = qs('#lightbox-modal .lightbox-prev');
    const nextBtn = qs('#lightbox-modal .lightbox-next');
    if (!prevBtn || !nextBtn) return;

    if (currentCoversData.length > 1) {
        prevBtn.style.display = 'block';
        nextBtn.style.display = 'block';
    } else {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
    }
}

function openLightbox(index) {
    const overlay = qs('#lightbox-modal');
    const imageElement = qs('#lightbox-img');
    const captionElement = qs('#lightbox-caption-text');

    if (!overlay || !imageElement || !captionElement) return;
    
    if (!currentCoversData || !currentCoversData[index]) return;

    currentLightboxIndex = index;
    const coverDetail = currentCoversData[index];

    imageElement.src = coverDetail.url_hq;
    imageElement.alt = `Couverture Volume ${coverDetail.volume || index + 1} (agrandie)`;
    captionElement.textContent = `Volume ${coverDetail.volume || 'Couverture ' + (index + 1)}`;
    
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    updateLightboxNavigation();
}

function closeLightbox() {
    const overlay = qs('#lightbox-modal');
    if (overlay) {
        overlay.style.display = 'none';
        document.body.style.overflow = '';
    }
}

function showNextImage() {
    if (currentCoversData.length === 0) return;
    currentLightboxIndex = (currentLightboxIndex + 1) % currentCoversData.length;
    openLightbox(currentLightboxIndex);
}

function showPrevImage() {
    if (currentCoversData.length === 0) return;
    currentLightboxIndex = (currentLightboxIndex - 1 + currentCoversData.length) % currentCoversData.length;
    openLightbox(currentLightboxIndex);
}

function setupLightboxControls() {
    const closeBtn = qs('#lightbox-modal .lightbox-close');
    const actualNextBtn = qs('#lightbox-modal .lightbox-next');
    const actualPrevBtn = qs('#lightbox-modal .lightbox-prev');
    const overlay = qs('#lightbox-modal');

    if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
    if (actualNextBtn) actualNextBtn.addEventListener('click', showNextImage);
    if (actualPrevBtn) actualPrevBtn.addEventListener('click', showPrevImage);
    if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) closeLightbox(); });

    document.addEventListener('keydown', (e) => {
        if (overlay && overlay.style.display !== 'none') {
            if (e.key === 'Escape') closeLightbox();
            if (currentCoversData.length > 1) {
                if (e.key === 'ArrowRight') showNextImage();
                if (e.key === 'ArrowLeft') showPrevImage();
            }
        }
    });
}

function renderCoversGallery(seriesData) {
    const galleryContainer = qs('.covers-grid');
    const pageTitleElement = qs('.covers-gallery-title');

    if (!galleryContainer || !pageTitleElement) return;

    if (!seriesData || !Array.isArray(seriesData.covers_gallery) || seriesData.covers_gallery.length === 0) {
        pageTitleElement.textContent = `Couvertures pour ${seriesData ? seriesData.title : 'série inconnue'}`;
        galleryContainer.innerHTML = '<p class="no-covers">Aucune couverture disponible pour cette série.</p>';
        currentCoversData = [];
        return;
    }
    
    currentCoversData = seriesData.covers_gallery.filter(
        cover => cover && typeof cover.url_hq === 'string' && typeof cover.url_lq === 'string'
    );

    pageTitleElement.textContent = `Galerie des Couvertures : ${seriesData.title}`;
    document.title = `BigSolo – Couvertures : ${seriesData.title}`;

    galleryContainer.innerHTML = currentCoversData.map((coverDetail, index) => `
        <div class="cover-item" data-index="${index}">
            <img src="${coverDetail.url_lq}" alt="Couverture Volume ${coverDetail.volume || index + 1}" loading="lazy">
            <div class="volume-caption-overlay">Volume ${coverDetail.volume || '?'}</div>
        </div>
    `).join('');

    galleryContainer.querySelectorAll('.cover-item').forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.dataset.index, 10);
            if (!isNaN(index)) openLightbox(index);
        });
    });
}

export async function initSeriesCoversPage() {
    const seriesCoversSectionGrid = qs("#covers-gallery-section .covers-grid");
    if (!seriesCoversSectionGrid) return;
    seriesCoversSectionGrid.innerHTML = '<p class="loading-message">Chargement des couvertures...</p>';
    
    const pathname = window.location.pathname;
    const pathSegments = pathname.split('/').filter(Boolean);
    let seriesSlug;

    if (pathSegments.length === 2 && pathSegments[1] === 'cover') {
        seriesSlug = pathSegments[0];
    }

    if (!seriesSlug) {
        seriesCoversSectionGrid.innerHTML = "<p class='loading-message'>Identifiant de série non trouvé dans l'URL.</p>";
        return;
    }

    try {
        const allSeries = await fetchAllSeriesData();
        const seriesData = allSeries.find(s => slugify(s.title) === seriesSlug);

        if (seriesData) {
            renderCoversGallery(seriesData);
            setupLightboxControls();
        } else {
            seriesCoversSectionGrid.innerHTML = `<p class="loading-message">Série "${seriesSlug}" non trouvée.</p>`;
            document.title = `BigSolo – Série non trouvée`;
        }
    } catch (error) {
        console.error("🚨 Erreur lors de l'initialisation de la page des couvertures :", error);
        seriesCoversSectionGrid.innerHTML = "<p class='loading-message'>Erreur de chargement des données.</p>";
    }
}