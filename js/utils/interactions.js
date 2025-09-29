// js/utils/interactions.js

const ACTION_QUEUE_KEY = "LesPoroiniens_action_queue";

// --- DÉBUT DE LA LOGIQUE DE DÉTECTION DE NAVIGATION ---

// Ce drapeau nous aidera à savoir si l'utilisateur clique sur un lien
// interne au site ou s'il quitte vraiment le site.
let isInternalNavigation = false;

// On ajoute un écouteur d'événements sur l'ensemble du document pour intercepter
// tous les clics. Le 'true' final (phase de capture) assure qu'il s'exécute
// avant que le navigateur ne commence à suivre le lien.
document.addEventListener(
  "click",
  (event) => {
    // On vérifie si la cible du clic est un lien <a> ou est à l'intérieur d'un lien.
    const link = event.target.closest("a");

    // Si ce n'est pas un lien ou qu'il n'a pas de destination (href), on ne fait rien.
    if (!link || !link.href) {
      return;
    }

    // C'est la vérification clé : on compare le nom de domaine du lien cliqué
    // avec le nom de domaine de la page actuelle. Si c'est le même, c'est une navigation interne.
    if (link.hostname === window.location.hostname) {
      // On lève le drapeau pour indiquer une navigation interne.
      isInternalNavigation = true;

      // Par sécurité, on remet le drapeau à false après un court instant.
      // Cela gère le cas où la navigation serait annulée (ex: Ctrl+clic pour ouvrir dans un nouvel onglet).
      setTimeout(() => {
        isInternalNavigation = false;
      }, 500);
    }
  },
  true
);

// --- FIN DE LA LOGIQUE DE DÉTECTION ---

// --- Gestion de la file d'attente (inchangée) ---

function getActionQueue() {
  try {
    const queue = localStorage.getItem(ACTION_QUEUE_KEY);
    return queue ? JSON.parse(queue) : {};
  } catch (e) {
    return {};
  }
}

function saveActionQueue(queue) {
  try {
    localStorage.setItem(ACTION_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error(
      "Impossible de sauvegarder la file d'attente des actions.",
      e
    );
  }
}

export function queueAction(seriesSlug, action) {
  const queue = getActionQueue();
  if (!queue[seriesSlug]) {
    queue[seriesSlug] = [];
  }
  queue[seriesSlug].push(action);
  saveActionQueue(queue);
}

// --- Logique d'envoi de la file d'attente (MODIFIÉE) ---

function sendActionQueue() {
  // On vérifie le drapeau AVANT de faire quoi que ce soit.
  // Si c'est une navigation interne, on arrête tout.
  if (isInternalNavigation) {
    console.log(
      "Navigation interne détectée. L'envoi de la file d'attente est reporté."
    );
    return;
  }

  const queue = getActionQueue();
  const seriesSlugs = Object.keys(queue);

  if (seriesSlugs.length === 0) return;

  for (const seriesSlug of seriesSlugs) {
    const actions = queue[seriesSlug];
    if (actions.length > 0) {
      console.log(
        `Envoi de ${actions.length} action(s) pour la série ${seriesSlug} lors de la fermeture de la page.`
      );
      try {
        // On utilise navigator.sendBeacon. C'est la méthode la plus fiable
        // pour envoyer des données juste avant qu'une page ne se ferme.
        const blob = new Blob([JSON.stringify({ seriesSlug, actions })], {
          type: "application/json",
        });
        navigator.sendBeacon("/api/log-action", blob);

        // On vide la file d'attente de manière optimiste.
        const currentQueue = getActionQueue();
        delete currentQueue[seriesSlug];
        saveActionQueue(currentQueue);
      } catch (error) {
        console.warn(
          "L'envoi de la file d'attente a échoué. Les actions seront renvoyées à la prochaine session.",
          error
        );
      }
    }
  }
}

window.addEventListener("pagehide", sendActionQueue);

// Envoi automatique de la file d'attente toutes les 10 secondes
setInterval(sendActionQueue, 10000);

// --- Gestion de l'état local de l'utilisateur (inchangée) ---

export function getLocalInteractionState(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch (e) {
    return {};
  }
}

export function setLocalInteractionState(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Impossible de sauvegarder l'état local.", e);
  }
}

export function addPendingComment(interactionKey, comment) {
  const localState = getLocalInteractionState(interactionKey);
  if (!localState.pendingComments) {
    localState.pendingComments = [];
  }
  localState.pendingComments.push(comment);
  localState.hasCommented = true;
  setLocalInteractionState(interactionKey, localState);
}

// --- Récupération des données (inchangée) ---

let seriesStatsCache = new Map();

export async function fetchSeriesStats(seriesSlug) {
  if (seriesStatsCache.has(seriesSlug)) {
    return seriesStatsCache.get(seriesSlug);
  }
  try {
    const response = await fetch(
      `/api/series-stats?slug=${seriesSlug}&t=${Date.now()}`
    );
    if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);
    const data = await response.json();
    seriesStatsCache.set(seriesSlug, data);
    return data;
  } catch (error) {
    console.error(
      `Impossible de récupérer les stats pour ${seriesSlug}:`,
      error
    );
    return {};
  }
}
