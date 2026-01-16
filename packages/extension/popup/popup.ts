// Pluckk - Popup Script
// Main UI logic for card generation and clipboard output

import { escapeHtml, formatForMochi } from '@pluckk/shared/utils';
import type {
  GeneratedCard,
  GenerateCardsResponse,
  MochiStatusResponse,
  SendToMochiResponse,
  EditedCard,
} from '../src/types';

// DOM Elements - use type assertion after null check
const loadingState = document.getElementById('loading-state') as HTMLElement | null;
const errorState = document.getElementById('error-state') as HTMLElement | null;
const noSelectionState = document.getElementById('no-selection-state') as HTMLElement | null;
const apiKeyState = document.getElementById('api-key-state') as HTMLElement | null;
const cardsState = document.getElementById('cards-state') as HTMLElement | null;
const cardsList = document.getElementById('cards-list') as HTMLElement | null;
const errorMessage = document.getElementById('error-message') as HTMLElement | null;
const sourceInfo = document.getElementById('source-info') as HTMLElement | null;
const copyBtn = document.getElementById('copy-btn') as HTMLButtonElement | null;
const mochiBtn = document.getElementById('mochi-btn') as HTMLButtonElement | null;
const retryBtn = document.getElementById('retry-btn') as HTMLButtonElement | null;
const settingsBtn = document.getElementById('settings-btn') as HTMLButtonElement | null;
const openSettingsBtn = document.getElementById('open-settings-btn') as HTMLButtonElement | null;

// State
let cards: GeneratedCard[] = [];
let selectedIndex = -1;
let sourceUrl = '';
let editedCards: Record<number, EditedCard> = {};
let mochiConfigured = false;

/**
 * Show a specific state, hide all others
 */
function showState(state: HTMLElement | null): void {
  const states = [loadingState, errorState, noSelectionState, apiKeyState, cardsState];
  states.forEach(s => s?.classList.add('hidden'));
  state?.classList.remove('hidden');
}

/**
 * Show error with message
 */
function showError(message: string): void {
  if (errorMessage) {
    errorMessage.textContent = message;
  }
  showState(errorState);
}

/**
 * Check if Mochi is configured
 */
async function checkMochiStatus(): Promise<void> {
  try {
    const response: MochiStatusResponse = await chrome.runtime.sendMessage({ action: 'getMochiStatus' });
    mochiConfigured = response.configured;

    if (mochiConfigured) {
      mochiBtn?.classList.remove('hidden');
    } else {
      mochiBtn?.classList.add('hidden');
    }
  } catch (error) {
    console.error('Failed to check Mochi status:', error);
    mochiConfigured = false;
  }
}

/**
 * Card style labels for display
 */
const STYLE_LABELS: Record<string, string> = {
  qa: 'Q&A',
  cloze: 'Cloze',
  conceptual: 'Conceptual'
};

/**
 * Format card style label
 */
function formatStyleLabel(style: string): string {
  return STYLE_LABELS[style] || style;
}

/**
 * Render cards in the UI
 */
function renderCards(): void {
  if (!cardsList) return;
  cardsList.innerHTML = '';

  cards.forEach((card, index) => {
    const isSelected = index === selectedIndex;
    const edited = editedCards[index] || {};
    const question = edited.question !== undefined ? edited.question : card.question || '';
    const answer = edited.answer !== undefined ? edited.answer : card.answer || '';

    const cardEl = document.createElement('div');
    cardEl.className = `card-item${isSelected ? ' selected' : ''}`;
    cardEl.dataset.index = String(index);

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
    cardEl.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't select if clicking on editable content
      if (target.hasAttribute('contenteditable') && target.isContentEditable) {
        return;
      }
      selectCard(index);
    });

    // Handle edits
    const questionEl = cardEl.querySelector('.card-question') as HTMLElement | null;
    const answerEl = cardEl.querySelector('.card-answer') as HTMLElement | null;

    questionEl?.addEventListener('input', () => {
      if (!editedCards[index]) editedCards[index] = {};
      editedCards[index].question = questionEl.textContent || '';
    });

    answerEl?.addEventListener('input', () => {
      if (!editedCards[index]) editedCards[index] = {};
      editedCards[index].answer = answerEl.textContent || '';
    });

    // Select card on focus of editable fields
    questionEl?.addEventListener('focus', () => selectCard(index));
    answerEl?.addEventListener('focus', () => selectCard(index));

    cardsList.appendChild(cardEl);
  });

  // Update source info
  if (sourceUrl && sourceInfo) {
    const displayUrl = sourceUrl.length > 50
      ? sourceUrl.substring(0, 50) + '...'
      : sourceUrl;
    sourceInfo.innerHTML = `Source: <a href="${escapeHtml(sourceUrl)}" target="_blank">${escapeHtml(displayUrl)}</a>`;
  }
}

/**
 * Select a card
 */
function selectCard(index: number): void {
  selectedIndex = index;
  if (copyBtn) {
    copyBtn.disabled = false;
  }
  if (mochiConfigured && mochiBtn) {
    mochiBtn.disabled = false;
  }

  // Update UI
  document.querySelectorAll('.card-item').forEach((el, i) => {
    el.classList.toggle('selected', i === index);
  });
}

/**
 * Get the current card data (with edits applied)
 */
interface CurrentCard {
  question: string;
  answer: string;
  style: string;
}

function getCurrentCard(): CurrentCard | null {
  if (selectedIndex < 0 || selectedIndex >= cards.length) {
    return null;
  }

  const card = cards[selectedIndex];
  const edited = editedCards[selectedIndex] || {};

  return {
    question: edited.question !== undefined ? edited.question : card.question || '',
    answer: edited.answer !== undefined ? edited.answer : card.answer || '',
    style: card.style
  };
}

/**
 * Copy selected card to clipboard
 */
async function copyToClipboard(): Promise<void> {
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
    if (copyBtn) {
      copyBtn.classList.add('btn-success');
      copyBtn.classList.remove('btn-secondary');
      const btnText = copyBtn.querySelector('.btn-text');
      if (btnText) btnText.textContent = 'Copied!';

      // Reset after delay
      setTimeout(() => {
        copyBtn.classList.remove('btn-success');
        copyBtn.classList.add('btn-secondary');
        const btnText = copyBtn.querySelector('.btn-text');
        if (btnText) btnText.textContent = 'Copy';
      }, 2000);
    }
  } catch (error) {
    console.error('Failed to copy:', error);
    showError('Failed to copy to clipboard');
  }
}

/**
 * Send selected card to Mochi
 */
async function sendToMochi(): Promise<void> {
  const card = getCurrentCard();
  if (!card || !mochiBtn) return;

  mochiBtn.disabled = true;
  const btnText = mochiBtn.querySelector('.btn-text');
  if (btnText) btnText.textContent = 'Sending...';

  try {
    const response: SendToMochiResponse = await chrome.runtime.sendMessage({
      action: 'sendToMochi',
      question: card.question,
      answer: card.answer,
      sourceUrl: sourceUrl
    });

    if (response.mochi?.error) {
      let errorMsg = 'Failed to send to Mochi';
      if (response.mochi.error === 'mochi_api_key_missing') {
        errorMsg = 'Mochi API key not configured';
      } else if (response.mochi.error === 'mochi_deck_not_selected') {
        errorMsg = 'No Mochi deck selected';
      } else if (response.mochi.message) {
        errorMsg = response.mochi.message;
      }
      showError(errorMsg);
      return;
    }

    // Show success state
    mochiBtn.classList.add('btn-success');
    mochiBtn.classList.remove('btn-mochi');
    if (btnText) btnText.textContent = 'Sent!';

    // Reset after delay
    setTimeout(() => {
      mochiBtn.classList.remove('btn-success');
      mochiBtn.classList.add('btn-mochi');
      if (btnText) btnText.textContent = 'Send to Mochi';
      mochiBtn.disabled = false;
    }, 2000);
  } catch (error) {
    console.error('Failed to send to Mochi:', error);
    showError('Failed to send to Mochi');
    mochiBtn.disabled = false;
    if (btnText) btnText.textContent = 'Send to Mochi';
  }
}

/**
 * Generate cards by calling background script
 */
async function generateCards(): Promise<void> {
  showState(loadingState);

  // Check Mochi status
  await checkMochiStatus();

  try {
    const response: GenerateCardsResponse = await chrome.runtime.sendMessage({ action: 'generateCards' });

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
function handleError(response: GenerateCardsResponse): void {
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
function openSettings(): void {
  chrome.runtime.openOptionsPage();
}

// Event Listeners
copyBtn?.addEventListener('click', copyToClipboard);
mochiBtn?.addEventListener('click', sendToMochi);
retryBtn?.addEventListener('click', generateCards);
settingsBtn?.addEventListener('click', openSettings);
openSettingsBtn?.addEventListener('click', openSettings);

// Keyboard shortcuts
document.addEventListener('keydown', (e: KeyboardEvent) => {
  const target = e.target as HTMLElement;

  // Number keys 1-3 to select cards
  if (e.key >= '1' && e.key <= '3' && !target.isContentEditable) {
    const index = parseInt(e.key) - 1;
    if (index < cards.length) {
      selectCard(index);
    }
  }

  // Enter to send to Mochi (if configured) or copy
  if (e.key === 'Enter' && !target.isContentEditable && selectedIndex >= 0) {
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
