// js/components/carousel.js
import { qs } from '../utils/domUtils.js';

/**
 * Initialise un carrousel.
 * @param {string} trackSelector - Sélecteur CSS pour le conteneur des éléments du carrousel.
 * @param {string} prevBtnSelector - Sélecteur CSS pour le bouton "précédent".
 * @param {string} nextBtnSelector - Sélecteur CSS pour le bouton "suivant".
 */
export function initCarousel(trackSelector, prevBtnSelector, nextBtnSelector) {
  const track = qs(trackSelector);
  const prevBtn = qs(prevBtnSelector);
  const nextBtn = qs(nextBtnSelector);

  if (!track) {
    // console.warn(`Carousel track not found with selector: ${trackSelector}`);
    return;
  }

  const items = track.children;

  if (items.length <= 1) { // Ou un seuil pour justifier les boutons
    if (prevBtn) prevBtn.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'none';
    return;
  }

  if (prevBtn) prevBtn.style.display = 'flex';
  if (nextBtn) nextBtn.style.display = 'flex';

  const scrollAmount = () => track.clientWidth * 0.8; // Scrolle 80% de la largeur visible

  if (nextBtn) {
    nextBtn.addEventListener("click", () => track.scrollBy({ left: scrollAmount(), behavior: "smooth" }));
  }
  if (prevBtn) {
    prevBtn.addEventListener("click", () => track.scrollBy({ left: -scrollAmount(), behavior: "smooth" }));
  }

  // Drag-to-scroll
  let isDragging = false, startX, scrollLeftVal;
  
  const startDragging = (e) => {
    isDragging = true;
    startX = (e.pageX || e.touches[0].pageX) - track.offsetLeft;
    scrollLeftVal = track.scrollLeft;
    track.classList.add("active"); // Pour le style du curseur
    track.style.scrollSnapType = 'none'; // Désactiver le snap pendant le drag
    track.style.scrollBehavior = 'auto'; // Désactiver le smooth scroll pendant le drag manuel

  };

  const stopDragging = () => {
    if (!isDragging) return;
    isDragging = false;
    track.classList.remove("active");
    track.style.scrollSnapType = 'x mandatory'; // Réactiver le snap
    track.style.scrollBehavior = 'smooth'; // Réactiver le smooth scroll
    // Optionnel: implémenter un "snap to item" après le drag
  };

  const drag = (e) => {
    if (!isDragging) return;
    e.preventDefault(); // Empêche le scroll de la page sur mobile
    const x = (e.pageX || e.touches[0].pageX) - track.offsetLeft;
    const walk = (x - startX) * 1.5; // Le multiplicateur ajuste la "vitesse" du drag
    track.scrollLeft = scrollLeftVal - walk;
  };

  track.addEventListener('mousedown', startDragging);
  track.addEventListener('touchstart', startDragging, { passive: true }); // passive:true si e.preventDefault() n'est pas utilisé dans le drag pour touchstart

  document.addEventListener('mousemove', drag); // Écouter sur document pour un drag plus fluide
  document.addEventListener('touchmove', drag, { passive: false }); // passive:false car on utilise e.preventDefault()

  document.addEventListener('mouseup', stopDragging);
  document.addEventListener('touchend', stopDragging);
}