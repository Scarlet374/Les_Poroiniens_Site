// js/utils/usernameGenerator.js
import { fetchData } from "./fetchUtils.js";

let avatarsCache = null;

async function getAvatars() {
  if (avatarsCache) {
    return avatarsCache;
  }
  try {
    const avatarList = await fetchData("/data/avatars.json");
    if (!Array.isArray(avatarList) || avatarList.length === 0) {
      throw new Error("La liste d'avatars est vide ou invalide.");
    }
    avatarsCache = avatarList;
    return avatarsCache;
  } catch (error) {
    console.error("Impossible de charger la liste des avatars:", error);
    return []; // Retourne une liste vide en cas d'erreur
  }
}

function getLocalUserIdentity(key) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    return null;
  }
}

function setLocalUserIdentity(key, identity) {
  try {
    localStorage.setItem(key, JSON.stringify(identity));
  } catch (e) {
    console.error("Impossible de sauvegarder l'identité de l'utilisateur.", e);
  }
}

/**
 * Attribue une identité (pseudo + avatar) à un utilisateur pour un chapitre spécifique.
 * Si une identité existe déjà dans le localStorage pour cette clé, elle est retournée.
 * Sinon, une nouvelle identité est créée, sauvegardée et retournée.
 * @param {string} interactionKey - La clé unique pour le chapitre (ex: "interactions_serie_chapitre").
 * @returns {Promise<{username: string, avatarUrl: string}>} L'identité de l'utilisateur.
 */
export async function assignUserIdentityForChapter(interactionKey) {
  const identityKey = `identity_${interactionKey}`;

  // 1. Vérifier si une identité existe déjà
  const existingIdentity = getLocalUserIdentity(identityKey);
  if (existingIdentity) {
    return existingIdentity;
  }

  // 2. Si non, en créer une nouvelle
  const avatars = await getAvatars();
  if (avatars.length === 0) {
    // Solution de repli si les avatars ne peuvent pas être chargés
    return {
      username: "Visiteur Anonyme",
      avatarUrl: "/img/profil.png",
    };
  }

  // 3. Choisir un avatar au hasard
  const randomAvatarFilename =
    avatars[Math.floor(Math.random() * avatars.length)];

  // 4. Créer le pseudo et l'URL de l'image
  const username = randomAvatarFilename
    .replace(".jpg", "")
    .replace(".png", "")
    .replace(/_/g, " ");
  const avatarUrl = `/img/profilpicture/${randomAvatarFilename}`;

  const newIdentity = { username, avatarUrl };

  // 5. Sauvegarder la nouvelle identité dans le localStorage
  setLocalUserIdentity(identityKey, newIdentity);

  return newIdentity;
}
