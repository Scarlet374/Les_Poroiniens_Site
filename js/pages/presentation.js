// js/pages/presentation.js

// Fonction pour créer un élément avec des classes et du contenu textuel (optionnel)
function createElement(tag, classNames = [], textContent = null) {
  const element = document.createElement(tag);
  if (Array.isArray(classNames)) {
    element.classList.add(...classNames);
  } else if (typeof classNames === 'string' && classNames.length > 0) {
    element.classList.add(classNames);
  }
  if (textContent) {
    element.textContent = textContent;
  }
  return element;
}

// Fonction pour créer un élément icône Font Awesome
function createIconElement(iconClass) {
  const span = createElement('span', ['qa-icon-lined']);
  const icon = createElement('i');
  icon.className = iconClass; // Pour Font Awesome, on assigne directement className
  span.appendChild(icon);
  return span;
}

async function loadQAData() {
  try {
    // Ajuste le chemin vers ton fichier JSON si nécessaire
    const response = await fetch('../data/presentation-data.json'); // Si presentation-data.json est dans un dossier data/
    // const response = await fetch('./presentation-data.json'); // Si presentation-data.json est à la racine du projet ou dans public/
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const qaData = await response.json();
    return qaData;
  } catch (error) {
    console.error("Could not load Q&A data:", error);
    return []; // Retourne un tableau vide en cas d'erreur pour éviter de planter la page
  }
}

function displayQAItems(qaData) {
  const container = document.getElementById('qaContainer');
  if (!container) {
    console.error('QA container not found!');
    return;
  }
  container.innerHTML = ''; // Vide le conteneur au cas où

  qaData.forEach(item => {
    const qaItemLined = createElement('article', ['qa-item-lined']);

    // Question Wrapper
    const questionWrapper = createElement('div', ['qa-question-wrapper']);
    
    const iconElement = createIconElement(item.icon);
    questionWrapper.appendChild(iconElement);

    const questionContent = createElement('div', ['qa-question-content']);
    const questionH3 = createElement('h3', ['qa-question-lined'], item.question);
    const authorSpan = createElement('span', ['qa-question-author'], item.author);
    
    questionContent.appendChild(questionH3);
    questionContent.appendChild(authorSpan);
    questionWrapper.appendChild(questionContent);

    // Answer Wrapper
    const answerWrapper = createElement('div', ['qa-answer-wrapper']);
    answerWrapper.innerHTML = item.answer_html; // Injecte le HTML directement

    qaItemLined.appendChild(questionWrapper);
    qaItemLined.appendChild(answerWrapper);
    container.appendChild(qaItemLined);
  });
}

export async function initPresentationPage() {
  console.log("Initializing Presentation Page...");
  const qaData = await loadQAData();
  if (qaData && qaData.length > 0) {
    displayQAItems(qaData);
  } else {
    const container = document.getElementById('qaContainer');
    if (container) {
        container.innerHTML = '<p>Erreur lors du chargement des questions et réponses. Veuillez réessayer plus tard.</p>';
    }
  }
}

// Si ce fichier est chargé directement et n'est pas appelé par index.js
// document.addEventListener('DOMContentLoaded', initPresentationPage);
// Sinon, assure-toi que index.js appelle bien initPresentationPage