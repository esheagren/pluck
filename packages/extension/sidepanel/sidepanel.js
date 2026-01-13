// Pluckk - Side Panel Script
// Main UI logic for card generation and Mochi integration

import { escapeHtml } from '@pluckk/shared/utils';
import { FREE_TIER_LIMIT, BACKEND_URL } from '@pluckk/shared/constants';
import {
  signInWithGoogle,
  getSession,
  getUserProfile,
  getAccessToken
} from '../src/auth.js';
import { initSandAnimation } from './sand-animation.js';

// DOM Elements - Main UI
const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const noSelectionState = document.getElementById('no-selection-state');
const screenshotState = document.getElementById('screenshot-state');
const apiKeyState = document.getElementById('api-key-state');
const usageLimitState = document.getElementById('usage-limit-state');
const cardsState = document.getElementById('cards-state');
const cardsList = document.getElementById('cards-list');
const errorMessage = document.getElementById('error-message');
const mochiBtn = document.getElementById('mochi-btn');
const retryBtn = document.getElementById('retry-btn');
const logoText = document.getElementById('logo-text');
const readyHint = document.getElementById('ready-hint');
const generateBtn = document.getElementById('generate-btn');
const regenerateBtn = document.getElementById('regenerate-btn');
const openSettingsBtn = document.getElementById('open-settings-btn');
const upgradeBtn = document.getElementById('upgrade-btn');
const closeBtn = document.getElementById('close-btn');
const infoBtn = document.getElementById('info-btn');
const selectedCountEl = document.getElementById('selected-count');
const totalCountEl = document.getElementById('total-count');
const focusInputContainer = document.getElementById('focus-input-container');
const focusInput = document.getElementById('focus-input');
const generateWithFocusBtn = document.getElementById('generate-with-focus-btn');

// DOM Elements - Question Input Mode
const questionInputContainer = document.getElementById('question-input-container');
const questionInput = document.getElementById('question-input');
const questionSubmitBtn = document.getElementById('question-submit-btn');

// DOM Elements - Settings Section
const authLoggedOut = document.getElementById('auth-logged-out');
const authLoggedIn = document.getElementById('auth-logged-in');
const googleSignInBtn = document.getElementById('google-sign-in-btn');
const usageRow = document.getElementById('usage-row');
const settingsUsageBar = document.getElementById('settings-usage-bar');
const settingsUsageText = document.getElementById('settings-usage-text');
const settingsBillingRow = document.getElementById('settings-billing-row');
const settingsProRow = document.getElementById('settings-pro-row');
const settingsUpgradeBtn = document.getElementById('settings-upgrade-btn');
const keepOpenCheckbox = document.getElementById('keep-open-checkbox');

// State
let cards = [];
let selectedIndices = new Set(); // Multi-select support
let sourceUrl = '';
let editedCards = {};
let mochiConfigured = false;
let cachedSelectionData = null; // Cache selection for regeneration
let currentIsPro = false; // Track subscription status for usage updates

// Screenshot/Image mode state
let isImageMode = false;
let pastedImageData = null; // Base64 image data
let pastedImageMimeType = null; // e.g., 'image/png'

// Question input mode state
let isQuestionMode = false;

// Diagram generation state (tracks which diagram cards should generate images)
let diagramGenerateFlags = {}; // { cardIndex: boolean }
let userIsPro = false; // Track if user is Pro (for diagram feature)

// Keep open preference
let keepOpenAfterStoring = false;

/**
 * Show a specific state, hide all others
 * Also manages selection polling (only poll when in ready state)
 */
function showState(state) {
  const states = [loadingState, errorState, noSelectionState, screenshotState, apiKeyState, usageLimitState, cardsState];
  states.forEach(s => s?.classList.add('hidden'));
  state?.classList.remove('hidden');

  // Manage selection polling based on state
  if (state === noSelectionState) {
    startSelectionPolling();
  } else {
    stopSelectionPolling();
  }
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
    mochiBtn.querySelector('.btn-text').textContent = `Store ${count}`;
  } else {
    mochiBtn.querySelector('.btn-text').textContent = 'Store';
  }
}

/**
 * Render cards in the UI
 * Handles special rendering for qa_bidirectional and diagram card styles
 */
function renderCards() {
  cardsList.innerHTML = '';
  diagramGenerateFlags = {}; // Reset diagram flags

  cards.forEach((card, index) => {
    // Skip null or invalid cards
    if (!card || typeof card !== 'object') {
      console.warn('Skipping invalid card at index', index);
      return;
    }

    const isSelected = selectedIndices.has(index);
    const edited = editedCards[index] || {};

    const cardEl = document.createElement('div');
    cardEl.className = `card-item${isSelected ? ' selected' : ''} ${card.style || ''}`;
    cardEl.dataset.index = index;

    // Render based on card style
    if (card.style === 'qa_bidirectional') {
      renderBidirectionalCard(cardEl, card, index, edited);
    } else if (card.style === 'diagram') {
      renderDiagramCard(cardEl, card, index, edited);
    } else if (card.style === 'cloze_list') {
      renderListCard(cardEl, card, index, edited);
    } else {
      renderStandardCard(cardEl, card, index, edited);
    }

    // Handle card selection (toggle) - skip if clicking on editable content or checkbox
    cardEl.addEventListener('click', (e) => {
      if (e.target.hasAttribute('contenteditable') && e.target.isContentEditable) {
        return;
      }
      if (e.target.classList.contains('diagram-checkbox') || e.target.closest('.diagram-checkbox-label')) {
        return;
      }
      toggleCard(index);
    });

    cardsList.appendChild(cardEl);
  });

  updateSelectionCount();
}

/**
 * Render a standard card (qa, cloze, explanation, application, etc.)
 */
function renderStandardCard(cardEl, card, index, edited) {
  const question = edited.question !== undefined ? edited.question : card.question;
  const answer = edited.answer !== undefined ? edited.answer : card.answer;

  // Check if this is a question-mode card that was improved
  const wasImproved = card.wasImproved && card.originalQuestion;
  const improvedBadge = wasImproved
    ? `<span class="question-improved-badge" title="Original: ${escapeHtml(card.originalQuestion)}">Refined</span>`
    : '';

  cardEl.innerHTML = `
    <div class="card-checkbox"></div>
    <div class="card-content">
      <div class="card-question-wrapper">
        <div class="card-question" contenteditable="true" data-field="question">${escapeHtml(question)}</div>
        ${improvedBadge}
      </div>
      <div class="card-divider"></div>
      <div class="card-answer" contenteditable="true" data-field="answer">${escapeHtml(answer)}</div>
    </div>
  `;

  setupStandardEditHandlers(cardEl, index);
}

/**
 * Render a bidirectional card (shows both forward and reverse Q&A)
 */
function renderBidirectionalCard(cardEl, card, index, edited) {
  const forwardQ = edited.forwardQuestion !== undefined ? edited.forwardQuestion : card.forward?.question || '';
  const forwardA = edited.forwardAnswer !== undefined ? edited.forwardAnswer : card.forward?.answer || '';
  const reverseQ = edited.reverseQuestion !== undefined ? edited.reverseQuestion : card.reverse?.question || '';
  const reverseA = edited.reverseAnswer !== undefined ? edited.reverseAnswer : card.reverse?.answer || '';

  cardEl.innerHTML = `
    <div class="card-checkbox"></div>
    <div class="card-content">
      <div class="card-style-label">↔️ Bidirectional</div>
      <div class="card-direction">
        <div class="direction-label">Forward:</div>
        <div class="card-question" contenteditable="true" data-field="forwardQuestion">${escapeHtml(forwardQ)}</div>
        <div class="card-divider"></div>
        <div class="card-answer" contenteditable="true" data-field="forwardAnswer">${escapeHtml(forwardA)}</div>
      </div>
      <div class="card-direction" style="margin-top: 12px;">
        <div class="direction-label">Reverse:</div>
        <div class="card-question" contenteditable="true" data-field="reverseQuestion">${escapeHtml(reverseQ)}</div>
        <div class="card-divider"></div>
        <div class="card-answer" contenteditable="true" data-field="reverseAnswer">${escapeHtml(reverseA)}</div>
      </div>
    </div>
  `;

  setupBidirectionalEditHandlers(cardEl, index);
}

/**
 * Render a diagram card (shows Q&A plus diagram prompt with checkbox)
 */
function renderDiagramCard(cardEl, card, index, edited) {
  const question = edited.question !== undefined ? edited.question : card.question;
  const answer = edited.answer !== undefined ? edited.answer : card.answer;
  const diagramPrompt = card.diagram_prompt || '';

  cardEl.innerHTML = `
    <div class="card-checkbox"></div>
    <div class="card-content">
      <div class="card-question" contenteditable="true" data-field="question">${escapeHtml(question)}</div>
      <div class="card-divider"></div>
      <div class="card-answer" contenteditable="true" data-field="answer">${escapeHtml(answer)}</div>
      <div class="diagram-section">
        <div class="diagram-label">📊 Diagram prompt:</div>
        <div class="diagram-prompt">${escapeHtml(diagramPrompt)}</div>
        <label class="diagram-checkbox-label">
          <input type="checkbox" class="diagram-checkbox" data-index="${index}">
          Generate diagram
        </label>
      </div>
    </div>
  `;

  setupStandardEditHandlers(cardEl, index);

  // Handle diagram checkbox
  const checkbox = cardEl.querySelector('.diagram-checkbox');
  if (checkbox) {
    checkbox.addEventListener('change', (e) => {
      diagramGenerateFlags[index] = e.target.checked;
    });
  }
}

/**
 * Render a list card (shows all cloze prompts with one item blank + final all-blank)
 */
function renderListCard(cardEl, card, index, edited) {
  const listName = card.list_name || 'List';
  const prompts = card.prompts || [];
  const itemCount = (card.items || []).length;

  // Build HTML for each prompt preview
  const promptsHtml = prompts.map((prompt, i) => {
    const isAllBlank = i === prompts.length - 1; // Last one is "recall all"
    const label = isAllBlank ? 'Recall all:' : `Item ${i + 1}:`;
    return `
      <div class="list-prompt-preview">
        <span class="list-prompt-label">${label}</span>
        <span class="list-prompt-question">${escapeHtml(prompt.question)}</span>
        <span class="list-prompt-answer">${escapeHtml(prompt.answer)}</span>
      </div>
    `;
  }).join('');

  cardEl.innerHTML = `
    <div class="card-checkbox"></div>
    <div class="card-content">
      <div class="card-style-label">📋 List (${itemCount} items → ${prompts.length} cards)</div>
      <div class="list-name">${escapeHtml(listName)}</div>
      <div class="list-prompts">
        ${promptsHtml}
      </div>
    </div>
  `;
}

/**
 * Setup edit handlers for standard cards
 */
function setupStandardEditHandlers(cardEl, index) {
  const questionEl = cardEl.querySelector('.card-question');
  const answerEl = cardEl.querySelector('.card-answer');

  if (questionEl) {
    questionEl.addEventListener('input', () => {
      if (!editedCards[index]) editedCards[index] = {};
      editedCards[index].question = questionEl.textContent;
    });
  }

  if (answerEl) {
    answerEl.addEventListener('input', () => {
      if (!editedCards[index]) editedCards[index] = {};
      editedCards[index].answer = answerEl.textContent;
    });
  }
}

/**
 * Setup edit handlers for bidirectional cards
 */
function setupBidirectionalEditHandlers(cardEl, index) {
  const fields = ['forwardQuestion', 'forwardAnswer', 'reverseQuestion', 'reverseAnswer'];

  fields.forEach(field => {
    const el = cardEl.querySelector(`[data-field="${field}"]`);
    if (el) {
      el.addEventListener('input', () => {
        if (!editedCards[index]) editedCards[index] = {};
        editedCards[index][field] = el.textContent;
      });
    }
  });
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
 * Expands qa_bidirectional into two separate cards for storage
 */
function getSelectedCards() {
  const result = [];

  Array.from(selectedIndices).sort().forEach(index => {
    const card = cards[index];
    const edited = editedCards[index] || {};

    if (card.style === 'qa_bidirectional') {
      // Expand bidirectional card into two separate cards
      result.push({
        question: edited.forwardQuestion !== undefined ? edited.forwardQuestion : card.forward?.question || '',
        answer: edited.forwardAnswer !== undefined ? edited.forwardAnswer : card.forward?.answer || '',
        style: 'qa',
        tags: card.tags,
        direction: 'forward'
      });
      result.push({
        question: edited.reverseQuestion !== undefined ? edited.reverseQuestion : card.reverse?.question || '',
        answer: edited.reverseAnswer !== undefined ? edited.reverseAnswer : card.reverse?.answer || '',
        style: 'qa',
        tags: card.tags,
        direction: 'reverse'
      });
    } else if (card.style === 'cloze_list') {
      // Expand cloze_list into individual cloze cards
      const prompts = card.prompts || [];
      for (const prompt of prompts) {
        result.push({
          question: prompt.question,
          answer: prompt.answer,
          style: 'cloze',
          tags: card.tags,
          list_name: card.list_name
        });
      }
    } else if (card.style === 'diagram') {
      // Include diagram info for potential image generation
      result.push({
        question: edited.question !== undefined ? edited.question : card.question,
        answer: edited.answer !== undefined ? edited.answer : card.answer,
        style: card.style,
        tags: card.tags,
        diagram_prompt: card.diagram_prompt,
        generateDiagram: diagramGenerateFlags[index] || false
      });
    } else {
      // Standard card
      result.push({
        question: edited.question !== undefined ? edited.question : card.question,
        answer: edited.answer !== undefined ? edited.answer : card.answer,
        style: card.style,
        tags: card.tags
      });
    }
  });

  return result;
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

  mochiBtn.querySelector('.btn-text').textContent = `Storing 0/${totalCards}...`;

  for (const card of selectedCards) {
    try {
      const messageData = {
        action: 'sendToMochi',
        question: card.question,
        answer: card.answer,
        sourceUrl: sourceUrl,
        tags: card.tags
      };

      // Include screenshot data if we're in image mode
      if (isImageMode && pastedImageData && pastedImageMimeType) {
        messageData.screenshotData = pastedImageData;
        messageData.screenshotMimeType = pastedImageMimeType;
      }

      // Include diagram data if this is a diagram card with generation requested
      if (card.style === 'diagram' && card.generateDiagram && card.diagram_prompt) {
        messageData.generateDiagram = true;
        messageData.diagramPrompt = card.diagram_prompt;
      }

      const response = await chrome.runtime.sendMessage(messageData);

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

      mochiBtn.querySelector('.btn-text').textContent = `Storing ${savedCount}/${totalCards}...`;

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
  if (savedCount > 0) {
    successMsg = `Stored ${savedCount}!`;
  } else {
    successMsg = 'Stored!';
  }

  mochiBtn.querySelector('.btn-text').textContent = successMsg;

  // Clear screenshot data to free memory
  if (isImageMode) {
    pastedImageData = null;
    pastedImageMimeType = null;
    isImageMode = false;
  }

  // Close panel after brief feedback (unless user wants to keep it open)
  if (!keepOpenAfterStoring) {
    setTimeout(() => {
      window.close();
    }, 600);
  } else {
    // Reset button after feedback
    setTimeout(() => {
      mochiBtn.classList.remove('btn-success');
      mochiBtn.classList.add('btn-mochi');
      mochiBtn.querySelector('.btn-text').textContent = 'Store';
      mochiBtn.disabled = true;
      // Clear selections and show ready state
      cards = [];
      selectedIndices.clear();
      editedCards = {};
      cachedSelectionData = null;
      showState(noSelectionState);
    }, 1200);
  }
}

/**
 * Process raw cards from API - all special styles are kept as single cards in UI
 * Note: cloze_list, qa_bidirectional, and diagram cards are kept intact for
 * single-select UI but expand to multiple cards on save in getSelectedCards()
 */
function flattenCards(rawCards) {
  // All cards pass through unchanged - expansion happens at save time
  return rawCards;
}

/**
 * Resize an image to max dimensions and compress to target size
 * @param {string} base64Data - Base64 encoded image data
 * @param {string} mimeType - Original mime type
 * @param {number} maxDimension - Max width/height in pixels
 * @param {number} targetSizeKB - Target file size in KB
 * @returns {Promise<{data: string, mimeType: string}>}
 */
async function resizeImage(base64Data, mimeType, maxDimension = 1024, targetSizeKB = 200) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Calculate new dimensions maintaining aspect ratio
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height / width) * maxDimension);
          width = maxDimension;
        } else {
          width = Math.round((width / height) * maxDimension);
          height = maxDimension;
        }
      }

      // Create canvas and draw resized image
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Try to compress to target size (JPEG for better compression)
      let quality = 0.9;
      let result = canvas.toDataURL('image/jpeg', quality);

      // Reduce quality until we're under target size
      while (result.length > targetSizeKB * 1024 * 1.37 && quality > 0.1) { // 1.37 accounts for base64 overhead
        quality -= 0.1;
        result = canvas.toDataURL('image/jpeg', quality);
      }

      // Extract base64 data without prefix
      const data = result.split(',')[1];
      resolve({ data, mimeType: 'image/jpeg' });
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = `data:${mimeType};base64,${base64Data}`;
  });
}

/**
 * Handle paste event to capture screenshots
 */
async function handlePaste(e) {
  // Skip if user is editing a card
  if (e.target.isContentEditable || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    return;
  }

  const items = e.clipboardData?.items;
  if (!items) return;

  // Look for image in clipboard
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();

      const blob = item.getAsFile();
      if (!blob) continue;

      // Convert to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64WithPrefix = reader.result;
        const [prefix, rawData] = base64WithPrefix.split(',');
        const originalMimeType = prefix.match(/data:(.*);base64/)?.[1] || 'image/png';

        try {
          // Resize and compress the image
          const { data, mimeType } = await resizeImage(rawData, originalMimeType);

          // Store the screenshot data
          pastedImageData = data;
          pastedImageMimeType = mimeType;
          isImageMode = true;

          // Show screenshot preview
          showScreenshotPreview(data);
        } catch (error) {
          console.error('Failed to process screenshot:', error);
          showError('Failed to process screenshot. Please try again.');
        }
      };
      reader.readAsDataURL(blob);
      break; // Only handle first image
    }
  }
}

/**
 * Show the screenshot preview state
 */
function showScreenshotPreview(base64Data) {
  const previewImg = document.getElementById('screenshot-preview-img');
  if (previewImg) {
    previewImg.src = `data:image/jpeg;base64,${base64Data}`;
  }
  showState(screenshotState);
}

/**
 * Clear the pasted screenshot and return to ready state
 */
function clearScreenshot() {
  pastedImageData = null;
  pastedImageMimeType = null;
  isImageMode = false;
  showState(noSelectionState);
}

/**
 * Generate cards from the pasted screenshot
 * @param {string} focusText - Optional focus/guidance for card generation
 * @param {boolean} isRetry - Whether this is a retry after auth refresh
 */
async function generateCardsFromImage(focusText = '', isRetry = false) {
  if (!pastedImageData || !pastedImageMimeType) {
    showError('No screenshot to analyze');
    return;
  }

  showState(loadingState);
  await checkMochiStatus();

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'generateCardsFromImage',
      imageData: pastedImageData,
      mimeType: pastedImageMimeType,
      focusText: focusText
    });

    if (response.error) {
      // If auth failed but we haven't retried yet, try refreshing session
      if (response.error === 'not_authenticated' && !isRetry) {
        console.log('[Pluckk] Auth failed, checking if we can refresh session...');
        const { session } = await getSession();
        if (session) {
          // We have a session, try again
          console.log('[Pluckk] Session exists, retrying...');
          return generateCardsFromImage(focusText, true);
        }
      }
      handleError(response);
      return;
    }

    if (!response.cards || response.cards.length === 0) {
      showError('No cards generated from screenshot. Try a different image.');
      return;
    }

    // Flatten any cloze_list cards into individual cards
    cards = flattenCards(response.cards);
    sourceUrl = ''; // Screenshots don't have a source URL
    selectedIndices = new Set();
    editedCards = {};

    // Update usage display if included in response
    if (response.usage) {
      applyProfileToUI({
        usage: response.usage,
        subscription: { isPro: currentIsPro }
      });
    }

    renderCards();
    showState(cardsState);
  } catch (error) {
    console.error('Image card generation failed:', error);
    showError('Failed to generate cards from screenshot. Please try again.');
  }
}

/**
 * Generate cards by calling background script
 * @param {string} focusText - Optional focus/guidance for card generation
 * @param {boolean} useCache - Whether to use cached selection (for regeneration)
 */
async function generateCards(focusText = '', useCache = false) {
  // Always show loading state immediately
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

    // Update usage display if included in response
    if (response.usage) {
      applyProfileToUI({
        usage: response.usage,
        subscription: { isPro: currentIsPro }
      });
    }

    renderCards();
    showState(cardsState);
  } catch (error) {
    console.error('Generation failed:', error);
    showError('Failed to generate cards. Please try again.');
  }
}

/**
 * Generate card from a user-typed question
 */
async function generateFromQuestion() {
  const question = questionInput.value.trim();
  if (!question || question.length < 3) {
    return;
  }

  isQuestionMode = true;
  showState(loadingState);
  await checkMochiStatus();

  // Always include page context for better answers
  let pageContext = null;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      pageContext = { url: tab.url, title: tab.title };
    }
  } catch (e) {
    // Ignore - page context is optional
  }

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'answerQuestion',
      question: question,
      url: pageContext?.url,
      title: pageContext?.title
    });

    if (response.error) {
      handleError(response);
      return;
    }

    if (!response.cards || response.cards.length === 0) {
      showError('Failed to generate answer. Please try again.');
      return;
    }

    // Store the card(s) - response includes wasImproved and originalQuestion
    cards = response.cards;
    sourceUrl = pageContext?.url || '';
    selectedIndices = new Set();
    editedCards = {};

    // Clear the question input and reset height
    questionInput.value = '';
    questionInput.style.height = 'auto';
    questionInput.style.width = '22px';
    questionSubmitBtn.classList.add('hidden');

    // Update usage display if included in response
    if (response.usage) {
      applyProfileToUI({
        usage: response.usage,
        subscription: { isPro: currentIsPro }
      });
    }

    renderCards();
    showState(cardsState);
  } catch (error) {
    console.error('Question answer generation failed:', error);
    showError('Failed to generate answer. Please try again.');
  }
}

// Selection polling
let selectionPollInterval = null;

/**
 * Check current selection state and update UI
 */
async function checkSelectionState() {
  // Only check if we're showing the ready state
  if (noSelectionState.classList.contains('hidden')) {
    return;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    const selectionData = await chrome.tabs.sendMessage(tab.id, { action: 'getSelection' });

    if (selectionData?.selection) {
      // We have text selected - show generate button
      readyHint.textContent = 'Text selected';
      generateBtn.classList.remove('hidden');
    } else {
      // No selection - hide generate button
      readyHint.textContent = 'Select text or paste screenshot';
      generateBtn.classList.add('hidden');
    }
  } catch (error) {
    // Content script not available - keep current state
    generateBtn.classList.add('hidden');
  }
}

/**
 * Start polling for selection changes
 */
function startSelectionPolling() {
  // Clear any existing interval
  if (selectionPollInterval) {
    clearInterval(selectionPollInterval);
  }
  // Poll every 500ms
  selectionPollInterval = setInterval(checkSelectionState, 500);
}

/**
 * Stop polling for selection changes
 */
function stopSelectionPolling() {
  if (selectionPollInterval) {
    clearInterval(selectionPollInterval);
    selectionPollInterval = null;
  }
}

/**
 * Initialize panel and start selection monitoring
 */
async function initializePanel() {
  await checkMochiStatus();
  await updateAuthDisplay();

  // Reset button state
  generateBtn.classList.add('hidden');
  readyHint.textContent = 'Select text or paste screenshot';

  // Show ready state (this also starts polling)
  showState(noSelectionState);

  // Do initial selection check
  await checkSelectionState();
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
 * Navigate current tab to Pluckk web app and close sidepanel
 */
async function openWebapp() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.update(tab.id, { url: 'https://pluckk.app' });
  }
  window.close();
}

/**
 * Show status message (logs to console since no status UI)
 */
function showSettingsStatus(message, type) {
  console.log(`[Pluckk] ${type}: ${message}`);
}

/**
 * Cache key for profile data
 */
const PROFILE_CACHE_KEY = 'pluckk_profile_cache';

/**
 * Get cached profile data
 */
async function getCachedProfile() {
  try {
    const result = await chrome.storage.local.get([PROFILE_CACHE_KEY]);
    return result[PROFILE_CACHE_KEY] || null;
  } catch (error) {
    return null;
  }
}

/**
 * Cache profile data
 */
async function cacheProfile(profile) {
  try {
    await chrome.storage.local.set({ [PROFILE_CACHE_KEY]: profile });
  } catch (error) {
    console.error('Failed to cache profile:', error);
  }
}

/**
 * Clear cached profile (on sign out)
 */
async function clearCachedProfile() {
  try {
    await chrome.storage.local.remove([PROFILE_CACHE_KEY]);
  } catch (error) {
    console.error('Failed to clear profile cache:', error);
  }
}

/**
 * Apply profile data to the UI
 */
function applyProfileToUI(profile) {
  if (!profile) return;

  const used = profile.usage?.cardsThisMonth || 0;
  const limit = profile.usage?.limit || FREE_TIER_LIMIT;
  const isPro = profile.subscription?.isPro || profile.subscription?.status === 'active';

  // Store for later use in card generation response
  currentIsPro = isPro;

  if (isPro) {
    // Pro users: hide bar, show count + Pro badge
    usageRow.classList.add('pro');
    settingsUsageText.textContent = `${used} (unlimited)`;
    settingsUsageBar.style.width = '0%';
    settingsBillingRow.classList.add('hidden');
    settingsProRow.classList.remove('hidden');
    settingsUpgradeBtn.classList.remove('at-limit');
  } else {
    // Free users: show bar + "X of Y cards used"
    usageRow.classList.remove('pro');
    const percentage = Math.min((used / limit) * 100, 100);
    settingsUsageText.textContent = `${used} of ${limit} cards used`;
    settingsUsageBar.style.width = `${percentage}%`;
    settingsBillingRow.classList.remove('hidden');
    settingsProRow.classList.add('hidden');

    settingsUsageBar.classList.remove('warning', 'full');
    settingsUpgradeBtn.classList.remove('at-limit');

    if (percentage >= 100) {
      settingsUsageBar.classList.add('full');
      settingsUpgradeBtn.classList.add('at-limit');
    } else if (percentage >= 75) {
      settingsUsageBar.classList.add('warning');
    }
  }
}

/**
 * Update auth display in settings
 */
async function updateAuthDisplay() {
  const { user } = await getSession();

  if (user) {
    authLoggedOut.classList.add('hidden');
    authLoggedIn.classList.remove('hidden');

    // First, apply cached profile immediately (no flash)
    const cachedProfile = await getCachedProfile();
    if (cachedProfile) {
      applyProfileToUI(cachedProfile);
    }

    // Then fetch fresh data in background
    const freshProfile = await getUserProfile();
    if (freshProfile) {
      applyProfileToUI(freshProfile);
      cacheProfile(freshProfile);
    }
  } else {
    authLoggedOut.classList.remove('hidden');
    authLoggedIn.classList.add('hidden');
    clearCachedProfile();
  }
}


/**
 * Handle Google sign in
 */
async function handleGoogleSignIn() {
  googleSignInBtn.disabled = true;
  googleSignInBtn.textContent = 'Signing in...';

  try {
    await signInWithGoogle();
    await updateAuthDisplay();
    // Also refresh the main panel in case auth was needed
    initializePanel();
  } catch (error) {
    console.error('Sign in error:', error);
    showSettingsStatus('Sign in failed', 'error');
  } finally {
    googleSignInBtn.disabled = false;
    googleSignInBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      Sign in with Google
    `;
  }
}

/**
 * Handle upgrade button - open Stripe Checkout
 */
async function handleUpgrade() {
  settingsUpgradeBtn.disabled = true;
  settingsUpgradeBtn.textContent = '...';

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      showSettingsStatus('Please sign in first', 'error');
      return;
    }

    const response = await fetch(`${BACKEND_URL}/api/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        successUrl: 'https://pluckk.app/success',
        cancelUrl: 'https://pluckk.app/cancel'
      })
    });

    if (!response.ok) {
      throw new Error('Checkout failed');
    }

    const { url } = await response.json();
    chrome.tabs.create({ url });
  } catch (error) {
    console.error('Upgrade error:', error);
    showSettingsStatus('Failed to start checkout', 'error');
  } finally {
    settingsUpgradeBtn.disabled = false;
    settingsUpgradeBtn.textContent = 'Upgrade to Pro';
  }
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

  // Use appropriate generation method based on mode
  if (isImageMode && pastedImageData) {
    generateCardsFromImage(focusText);
  } else {
    // Use cached selection for regeneration
    generateCards(focusText, true);
  }
}

// Event Listeners - Main UI
mochiBtn.addEventListener('click', sendToMochi);
retryBtn.addEventListener('click', () => generateCards());
logoText.addEventListener('click', openWebapp);
generateBtn.addEventListener('click', () => {
  showState(loadingState);
  generateCards();
});
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
openSettingsBtn.addEventListener('click', handleGoogleSignIn);
upgradeBtn.addEventListener('click', handleUpgrade);
closeBtn.addEventListener('click', closePanel);
infoBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://pluckk.app' });
  window.close();
});

// Event Listeners - Settings Section
googleSignInBtn.addEventListener('click', handleGoogleSignIn);
settingsUpgradeBtn.addEventListener('click', handleUpgrade);

// Event Listeners - Screenshot handling
document.addEventListener('paste', handlePaste);

// Wire up screenshot buttons and input
const screenshotGenerateBtn = document.getElementById('screenshot-generate-btn');
const screenshotClearBtn = document.getElementById('screenshot-clear-btn');
const screenshotFocusInput = document.getElementById('screenshot-focus-input');

function generateFromScreenshot() {
  const focusText = screenshotFocusInput?.value.trim() || '';
  generateCardsFromImage(focusText);
}

if (screenshotGenerateBtn) {
  screenshotGenerateBtn.addEventListener('click', generateFromScreenshot);
}
if (screenshotClearBtn) {
  screenshotClearBtn.addEventListener('click', clearScreenshot);
}
if (screenshotFocusInput) {
  screenshotFocusInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      generateFromScreenshot();
    }
  });
}

// Event Listeners - Question Input Mode
if (questionSubmitBtn) {
  questionSubmitBtn.addEventListener('click', generateFromQuestion);
}
if (questionInput) {
  questionInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      generateFromQuestion();
    }
  });
  // Auto-expand textarea in both directions as user types
  questionInput.addEventListener('input', () => {
    const text = questionInput.value || questionInput.placeholder;
    const hasContent = questionInput.value.trim().length > 0;

    // Show/hide submit button based on content
    if (hasContent) {
      questionSubmitBtn.classList.remove('hidden');
    } else {
      questionSubmitBtn.classList.add('hidden');
    }

    // Calculate width based on content using a hidden measurement element
    const measureSpan = document.createElement('span');
    measureSpan.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:inherit;padding:0 12px;';
    measureSpan.textContent = text;
    document.body.appendChild(measureSpan);
    const textWidth = measureSpan.offsetWidth + 24; // Add padding
    document.body.removeChild(measureSpan);

    // Set width (clamped between min and max)
    const newWidth = Math.max(22, Math.min(textWidth, 260));
    questionInput.style.width = newWidth + 'px';

    // Set height
    questionInput.style.height = 'auto';
    questionInput.style.height = Math.min(questionInput.scrollHeight, 120) + 'px';
  });
}

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

// Listen for auth state changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.pluckk_session) {
    console.log('Auth state changed');
    // Always update the auth display so it stays in sync
    updateAuthDisplay();

    // If user signed out, show the auth required state
    if (!changes.pluckk_session.newValue) {
      showState(apiKeyState);
    }
    // If user signed in while on auth screen, retry
    else if (apiKeyState && !apiKeyState.classList.contains('hidden')) {
      initializePanel();
    }
  }
});

// Initialize background animation
const sandCanvas = document.getElementById('sand-animation');
if (sandCanvas) {
  initSandAnimation(sandCanvas, {
    filterPosition: 0.98,
    speed: 0.3,
    opacity: 0.2,
    particleCount: 200
  });
}

// Update tooltip based on toggle state
function updateKeepOpenTooltip() {
  const toggleLabel = keepOpenCheckbox?.closest('.toggle-switch');
  if (toggleLabel) {
    toggleLabel.title = keepOpenAfterStoring
      ? 'Keep Pluck open'
      : 'Close Pluck after use';
  }
}

// Load keep-open preference
async function loadKeepOpenPreference() {
  try {
    const result = await chrome.storage.sync.get(['keepOpenAfterStoring']);
    keepOpenAfterStoring = result.keepOpenAfterStoring || false;
    if (keepOpenCheckbox) {
      keepOpenCheckbox.checked = keepOpenAfterStoring;
    }
    updateKeepOpenTooltip();
  } catch (error) {
    console.error('Failed to load keep-open preference:', error);
  }
}

// Save keep-open preference
async function saveKeepOpenPreference(value) {
  try {
    await chrome.storage.sync.set({ keepOpenAfterStoring: value });
    keepOpenAfterStoring = value;
    updateKeepOpenTooltip();
  } catch (error) {
    console.error('Failed to save keep-open preference:', error);
  }
}

// Wire up keep-open checkbox
if (keepOpenCheckbox) {
  keepOpenCheckbox.addEventListener('change', (e) => {
    saveKeepOpenPreference(e.target.checked);
  });
}

// Load preferences and initialize panel
loadKeepOpenPreference();
initializePanel();
