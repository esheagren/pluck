// Pluckk - Side Panel Script
// Main UI logic for card generation and Mochi integration

import { escapeHtml } from '@pluckk/shared/utils';

// DOM Elements
const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const noSelectionState = document.getElementById('no-selection-state');
const apiKeyState = document.getElementById('api-key-state');
const usageLimitState = document.getElementById('usage-limit-state');
const cardsState = document.getElementById('cards-state');
const cardsList = document.getElementById('cards-list');
const errorMessage = document.getElementById('error-message');
const mochiBtn = document.getElementById('mochi-btn');
const retryBtn = document.getElementById('retry-btn');
const refreshBtn = document.getElementById('refresh-btn');
const regenerateBtn = document.getElementById('regenerate-btn');
const settingsBtn = document.getElementById('settings-btn');
const openSettingsBtn = document.getElementById('open-settings-btn');
const upgradeBtn = document.getElementById('upgrade-btn');
const closeBtn = document.getElementById('close-btn');
const selectedCountEl = document.getElementById('selected-count');
const totalCountEl = document.getElementById('total-count');
const focusInputContainer = document.getElementById('focus-input-container');
const focusInput = document.getElementById('focus-input');
const generateWithFocusBtn = document.getElementById('generate-with-focus-btn');

// State
let cards = [];
let selectedIndices = new Set(); // Multi-select support
let sourceUrl = '';
let editedCards = {};
let mochiConfigured = false;
let cachedSelectionData = null; // Cache selection for regeneration

/**
 * Show a specific state, hide all others
 */
function showState(state) {
  const states = [loadingState, errorState, noSelectionState, apiKeyState, usageLimitState, cardsState];
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
  } catch (error) {
    console.error('Failed to check Mochi status:', error);
    mochiConfigured = false;
  }
}

/**
 * Update selection count display
 */
function updateSelectionCount() {
  const count = selectedIndices.size;
  selectedCountEl.textContent = count;
  totalCountEl.textContent = cards.length;

  // Update button states
  const hasSelection = count > 0;
  mochiBtn.disabled = !hasSelection;

  // Update button text with count
  if (hasSelection && count > 1) {
    mochiBtn.querySelector('.btn-text').textContent = `Pluckk ${count}`;
  } else {
    mochiBtn.querySelector('.btn-text').textContent = 'Pluckk';
  }
}

/**
 * Render cards in the UI
 */
function renderCards() {
  cardsList.innerHTML = '';

  cards.forEach((card, index) => {
    const isSelected = selectedIndices.has(index);
    const edited = editedCards[index] || {};
    const question = edited.question !== undefined ? edited.question : card.question;
    const answer = edited.answer !== undefined ? edited.answer : card.answer;

    const cardEl = document.createElement('div');
    cardEl.className = `card-item${isSelected ? ' selected' : ''}`;
    cardEl.dataset.index = index;

    cardEl.innerHTML = `
      <div class="card-checkbox"></div>
      <div class="card-content">
        <div class="card-question" contenteditable="true" data-field="question">${escapeHtml(question)}</div>
        <div class="card-divider"></div>
        <div class="card-answer" contenteditable="true" data-field="answer">${escapeHtml(answer)}</div>
      </div>
    `;

    // Handle card selection (toggle)
    cardEl.addEventListener('click', (e) => {
      if (e.target.hasAttribute('contenteditable') && e.target.isContentEditable) {
        return;
      }
      toggleCard(index);
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

    cardsList.appendChild(cardEl);
  });

  updateSelectionCount();
}

/**
 * Toggle card selection
 */
function toggleCard(index) {
  if (selectedIndices.has(index)) {
    selectedIndices.delete(index);
  } else {
    selectedIndices.add(index);
  }

  // Update UI
  const cardEl = cardsList.children[index];
  if (cardEl) {
    cardEl.classList.toggle('selected', selectedIndices.has(index));
  }

  updateSelectionCount();
}

/**
 * Get all selected cards with edits applied
 */
function getSelectedCards() {
  return Array.from(selectedIndices).sort().map(index => {
    const card = cards[index];
    const edited = editedCards[index] || {};
    return {
      question: edited.question !== undefined ? edited.question : card.question,
      answer: edited.answer !== undefined ? edited.answer : card.answer,
      style: card.style
    };
  });
}

/**
 * Send selected cards to Supabase (and optionally Mochi if configured)
 */
async function sendToMochi() {
  const selectedCards = getSelectedCards();
  if (selectedCards.length === 0) return;

  mochiBtn.disabled = true;
  const totalCards = selectedCards.length;
  let savedCount = 0;
  let mochiCount = 0;
  let supabaseErrors = [];
  let mochiConfigured = true; // Assume configured until we learn otherwise

  mochiBtn.querySelector('.btn-text').textContent = `Pluckking 0/${totalCards}...`;

  for (const card of selectedCards) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'sendToMochi',
        question: card.question,
        answer: card.answer,
        sourceUrl: sourceUrl
      });

      // Track Supabase success (primary storage)
      if (response.supabase?.success || response.supabase?.cardId) {
        savedCount++;
      } else if (response.supabase?.error) {
        supabaseErrors.push(response.supabase.message || response.supabase.error);
      }

      // Track Mochi success (optional integration)
      if (response.mochi?.success || response.mochi?.cardId) {
        mochiCount++;
      } else if (response.mochi?.error === 'mochi_api_key_missing' || response.mochi?.error === 'mochi_deck_not_selected') {
        mochiConfigured = false; // Mochi not set up, that's fine
      }

      mochiBtn.querySelector('.btn-text').textContent = `Pluckking ${savedCount}/${totalCards}...`;

      // Small delay between requests to respect rate limiting
      if (selectedCards.indexOf(card) < selectedCards.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    } catch (error) {
      supabaseErrors.push(error.message);
    }
  }

  // Check if anything was saved
  if (savedCount === 0 && supabaseErrors.length > 0) {
    // Nothing saved at all - show error
    showError('Failed to save cards. Please try again.');
    mochiBtn.disabled = false;
    updateSelectionCount();
    return;
  }

  // Show success
  mochiBtn.classList.add('btn-success');
  mochiBtn.classList.remove('btn-mochi');

  // Determine success message
  let successMsg;
  if (mochiConfigured && mochiCount > 0) {
    successMsg = `Pluckked ${savedCount}!`;
  } else if (savedCount > 0) {
    successMsg = `Saved ${savedCount}!`;
  } else {
    successMsg = 'Pluckked!';
  }

  mochiBtn.querySelector('.btn-text').textContent = successMsg;

  // Close panel after brief feedback
  setTimeout(() => {
    window.close();
  }, 600);
}

/**
 * Flatten cloze_list cards into individual cards
 * Handles the new prompt format where cloze_list contains multiple prompts
 */
function flattenCards(rawCards) {
  const flattened = [];

  for (const card of rawCards) {
    if (card.style === 'cloze_list' && card.prompts && Array.isArray(card.prompts)) {
      // Expand cloze_list into individual cloze cards
      for (const prompt of card.prompts) {
        flattened.push({
          style: 'cloze',
          question: prompt.question,
          answer: prompt.answer,
          rationale: card.rationale
        });
      }
    } else {
      // Regular card (qa, cloze, explanation, application, example_generation)
      flattened.push(card);
    }
  }

  return flattened;
}

/**
 * Generate cards by calling background script
 * @param {string} focusText - Optional focus/guidance for card generation
 * @param {boolean} useCache - Whether to use cached selection (for regeneration)
 */
async function generateCards(focusText = '', useCache = false) {
  showState(loadingState);
  await checkMochiStatus();

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'generateCards',
      focusText: focusText,
      // Pass cached selection if regenerating and we have it
      cachedSelection: useCache && cachedSelectionData ? cachedSelectionData : null
    });

    if (response.error) {
      handleError(response);
      return;
    }

    if (!response.cards || response.cards.length === 0) {
      showError('No cards generated. Try selecting different text.');
      return;
    }

    // Cache the selection data for future regeneration
    if (response.selectionData) {
      cachedSelectionData = response.selectionData;
    }

    // Flatten any cloze_list cards into individual cards
    cards = flattenCards(response.cards);
    sourceUrl = response.source?.url || '';
    selectedIndices = new Set();
    editedCards = {};

    renderCards();
    showState(cardsState);
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
    case 'not_authenticated':
    case 'api_key_missing':
      showState(apiKeyState);
      break;
    case 'usage_limit_reached':
      showState(usageLimitState);
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

/**
 * Close the side panel
 */
function closePanel() {
  window.close();
}

/**
 * Toggle focus input visibility
 */
function toggleFocusInput() {
  const isExpanded = !focusInputContainer.classList.contains('hidden');
  if (isExpanded) {
    // Collapse
    focusInputContainer.classList.add('hidden');
  } else {
    // Expand
    focusInputContainer.classList.remove('hidden');
    focusInput.focus();
  }
}

/**
 * Generate with focus text and collapse input
 * Uses cached selection so user doesn't need to re-select text
 */
function generateWithFocus() {
  const focusText = focusInput.value.trim();
  focusInputContainer.classList.add('hidden');
  focusInput.value = '';
  // Use cached selection for regeneration
  generateCards(focusText, true);
}

// Event Listeners
mochiBtn.addEventListener('click', sendToMochi);
retryBtn.addEventListener('click', () => generateCards());
refreshBtn.addEventListener('click', () => generateCards());
regenerateBtn.addEventListener('click', toggleFocusInput);
generateWithFocusBtn.addEventListener('click', generateWithFocus);
focusInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    generateWithFocus();
  }
  if (e.key === 'Escape') {
    focusInputContainer.classList.add('hidden');
    focusInput.value = '';
  }
});
settingsBtn.addEventListener('click', openSettings);
openSettingsBtn.addEventListener('click', openSettings);
upgradeBtn.addEventListener('click', openSettings); // Opens settings which has upgrade button
closeBtn.addEventListener('click', closePanel);

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Skip shortcuts when typing in input fields
  const isTyping = e.target.isContentEditable ||
                   e.target.tagName === 'INPUT' ||
                   e.target.tagName === 'TEXTAREA';

  // Number keys 1-3 to toggle cards
  if (e.key >= '1' && e.key <= '3' && !isTyping) {
    const index = parseInt(e.key) - 1;
    if (index < cards.length) {
      toggleCard(index);
    }
  }

  // Enter to send cards
  if (e.key === 'Enter' && !isTyping && selectedIndices.size > 0) {
    sendToMochi();
  }

  // R to toggle regenerate focus input
  if (e.key === 'r' && !isTyping) {
    toggleFocusInput();
  }

  // Escape to close (but first collapse focus input if open)
  if (e.key === 'Escape') {
    if (!focusInputContainer.classList.contains('hidden')) {
      focusInputContainer.classList.add('hidden');
      focusInput.value = '';
    } else {
      closePanel();
    }
  }
});

// Listen for auth state changes (when user signs in via options page)
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.pluckk_session) {
    // Session changed, retry generation
    console.log('Auth state changed, retrying...');
    generateCards();
  }
});

// Start generation on panel open
generateCards();
