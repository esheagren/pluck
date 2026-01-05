// Pluckk - Popup Script
// Main UI logic for card generation and clipboard output

import { escapeHtml } from '@pluckk/shared/utils';
import { formatForMochi } from '@pluckk/shared/utils';

// DOM Elements
const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const noSelectionState = document.getElementById('no-selection-state');
const apiKeyState = document.getElementById('api-key-state');
const cardsState = document.getElementById('cards-state');
const cardsList = document.getElementById('cards-list');
const errorMessage = document.getElementById('error-message');
const sourceInfo = document.getElementById('source-info');
const copyBtn = document.getElementById('copy-btn');
const mochiBtn = document.getElementById('mochi-btn');
const retryBtn = document.getElementById('retry-btn');
const settingsBtn = document.getElementById('settings-btn');
const openSettingsBtn = document.getElementById('open-settings-btn');

// State
let cards = [];
let selectedIndex = -1;
let sourceUrl = '';
let editedCards = {}; // Track user edits: { index: { question, answer } }
let mochiConfigured = false;

/**
 * Show a specific state, hide all others
 */
function showState(state) {
  const states = [loadingState, errorState, noSelectionState, apiKeyState, cardsState];
  states.forEach(s => s.classList.add('hidden'));
  state.classList.remove('hidden');
}

/**
 * Show error with message
 */
function showError(message) {
  errorMessage.textContent = message;
  showState(errorState);
}

/**
 * Check if Mochi is configured
 */
async function checkMochiStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getMochiStatus' });
    mochiConfigured = response.configured;

    if (mochiConfigured) {
      mochiBtn.classList.remove('hidden');
    } else {
      mochiBtn.classList.add('hidden');
    }
  } catch (error) {
    console.error('Failed to check Mochi status:', error);
    mochiConfigured = false;
  }
}

/**
 * Render cards in the UI
 */
function renderCards() {
  cardsList.innerHTML = '';

  cards.forEach((card, index) => {
    const isSelected = index === selectedIndex;
    const edited = editedCards[index] || {};
    const question = edited.question !== undefined ? edited.question : card.question;
    const answer = edited.answer !== undefined ? edited.answer : card.answer;

    const cardEl = document.createElement('div');
    cardEl.className = `card-item${isSelected ? ' selected' : ''}`;
    cardEl.dataset.index = index;

    cardEl.innerHTML = `
      <div class="card-header">
        <div class="card-radio"></div>
        <span class="card-style ${card.style}">${formatStyleLabel(card.style)}</span>
      </div>
      <div class="card-content">
        <div class="card-question" contenteditable="true" data-field="question">${escapeHtml(question)}</div>
        <div class="card-divider"></div>
        <div class="card-answer" contenteditable="true" data-field="answer">${escapeHtml(answer)}</div>
      </div>
    `;

    // Handle card selection
    cardEl.addEventListener('click', (e) => {
      // Don't select if clicking on editable content
      if (e.target.hasAttribute('contenteditable') && e.target.isContentEditable) {
        return;
      }
      selectCard(index);
    });

    // Handle edits
    const questionEl = cardEl.querySelector('.card-question');
    const answerEl = cardEl.querySelector('.card-answer');

    questionEl.addEventListener('input', () => {
      if (!editedCards[index]) editedCards[index] = {};
      editedCards[index].question = questionEl.textContent;
    });

    answerEl.addEventListener('input', () => {
      if (!editedCards[index]) editedCards[index] = {};
      editedCards[index].answer = answerEl.textContent;
    });

    // Select card on focus of editable fields
    questionEl.addEventListener('focus', () => selectCard(index));
    answerEl.addEventListener('focus', () => selectCard(index));

    cardsList.appendChild(cardEl);
  });

  // Update source info
  if (sourceUrl) {
    const displayUrl = sourceUrl.length > 50
      ? sourceUrl.substring(0, 50) + '...'
      : sourceUrl;
    sourceInfo.innerHTML = `Source: <a href="${escapeHtml(sourceUrl)}" target="_blank">${escapeHtml(displayUrl)}</a>`;
  }
}

/**
 * Select a card
 */
function selectCard(index) {
  selectedIndex = index;
  copyBtn.disabled = false;
  if (mochiConfigured) {
    mochiBtn.disabled = false;
  }

  // Update UI
  document.querySelectorAll('.card-item').forEach((el, i) => {
    el.classList.toggle('selected', i === index);
  });
}

/**
 * Format card style label
 */
function formatStyleLabel(style) {
  const labels = {
    qa: 'Q&A',
    cloze: 'Cloze',
    conceptual: 'Conceptual'
  };
  return labels[style] || style;
}

/**
 * Get the current card data (with edits applied)
 */
function getCurrentCard() {
  if (selectedIndex < 0 || selectedIndex >= cards.length) {
    return null;
  }

  const card = cards[selectedIndex];
  const edited = editedCards[selectedIndex] || {};

  return {
    question: edited.question !== undefined ? edited.question : card.question,
    answer: edited.answer !== undefined ? edited.answer : card.answer,
    style: card.style
  };
}

/**
 * Copy selected card to clipboard
 */
async function copyToClipboard() {
  const card = getCurrentCard();
  if (!card) return;

  const markdown = formatForMochi(
    card.question,
    card.answer,
    sourceUrl
  );

  try {
    await navigator.clipboard.writeText(markdown);

    // Show success state
    copyBtn.classList.add('btn-success');
    copyBtn.classList.remove('btn-secondary');
    copyBtn.querySelector('.btn-text').textContent = 'Copied!';

    // Reset after delay
    setTimeout(() => {
      copyBtn.classList.remove('btn-success');
      copyBtn.classList.add('btn-secondary');
      copyBtn.querySelector('.btn-text').textContent = 'Copy';
    }, 2000);
  } catch (error) {
    console.error('Failed to copy:', error);
    showError('Failed to copy to clipboard');
  }
}

/**
 * Send selected card to Mochi
 */
async function sendToMochi() {
  const card = getCurrentCard();
  if (!card) return;

  mochiBtn.disabled = true;
  mochiBtn.querySelector('.btn-text').textContent = 'Sending...';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'sendToMochi',
      question: card.question,
      answer: card.answer,
      sourceUrl: sourceUrl
    });

    if (response.error) {
      let errorMsg = 'Failed to send to Mochi';
      if (response.error === 'mochi_api_key_missing') {
        errorMsg = 'Mochi API key not configured';
      } else if (response.error === 'mochi_deck_not_selected') {
        errorMsg = 'No Mochi deck selected';
      } else if (response.message) {
        errorMsg = response.message;
      }
      showError(errorMsg);
      return;
    }

    // Show success state
    mochiBtn.classList.add('btn-success');
    mochiBtn.classList.remove('btn-mochi');
    mochiBtn.querySelector('.btn-text').textContent = 'Sent!';

    // Reset after delay
    setTimeout(() => {
      mochiBtn.classList.remove('btn-success');
      mochiBtn.classList.add('btn-mochi');
      mochiBtn.querySelector('.btn-text').textContent = 'Send to Mochi';
      mochiBtn.disabled = false;
    }, 2000);
  } catch (error) {
    console.error('Failed to send to Mochi:', error);
    showError('Failed to send to Mochi');
    mochiBtn.disabled = false;
    mochiBtn.querySelector('.btn-text').textContent = 'Send to Mochi';
  }
}

/**
 * Generate cards by calling background script
 */
async function generateCards() {
  showState(loadingState);

  // Check Mochi status
  await checkMochiStatus();

  try {
    const response = await chrome.runtime.sendMessage({ action: 'generateCards' });

    if (response.error) {
      handleError(response);
      return;
    }

    if (!response.cards || response.cards.length === 0) {
      showError('No cards generated. Try selecting different text.');
      return;
    }

    // Success - show cards
    cards = response.cards;
    sourceUrl = response.source?.url || '';
    selectedIndex = -1;
    editedCards = {};

    renderCards();
    showState(cardsState);

    // Auto-select first card
    if (cards.length > 0) {
      selectCard(0);
    }
  } catch (error) {
    console.error('Generation failed:', error);
    showError('Failed to generate cards. Please try again.');
  }
}

/**
 * Handle error responses
 */
function handleError(response) {
  switch (response.error) {
    case 'api_key_missing':
      showState(apiKeyState);
      break;
    case 'api_key_invalid':
      showError('Invalid API key. Please check your settings.');
      break;
    case 'no_selection':
      showState(noSelectionState);
      break;
    case 'rate_limit':
      showError('Rate limited. Please wait a moment and try again.');
      break;
    case 'content_script_error':
      showError('Could not access page content. Try refreshing the page.');
      break;
    default:
      showError(response.message || 'An error occurred. Please try again.');
  }
}

/**
 * Open extension options page
 */
function openSettings() {
  chrome.runtime.openOptionsPage();
}

// Event Listeners
copyBtn.addEventListener('click', copyToClipboard);
mochiBtn.addEventListener('click', sendToMochi);
retryBtn.addEventListener('click', generateCards);
settingsBtn.addEventListener('click', openSettings);
openSettingsBtn.addEventListener('click', openSettings);

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Number keys 1-3 to select cards
  if (e.key >= '1' && e.key <= '3' && !e.target.isContentEditable) {
    const index = parseInt(e.key) - 1;
    if (index < cards.length) {
      selectCard(index);
    }
  }

  // Enter to send to Mochi (if configured) or copy
  if (e.key === 'Enter' && !e.target.isContentEditable && selectedIndex >= 0) {
    if (mochiConfigured) {
      sendToMochi();
    } else {
      copyToClipboard();
    }
  }

  // Escape to close popup
  if (e.key === 'Escape') {
    window.close();
  }
});

// Start generation on popup open
generateCards();
