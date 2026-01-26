// Pluckk - Side Panel Script
// Main UI logic for card generation and Mochi integration

import { escapeHtml } from '@pluckk/shared/utils';
import { FREE_TIER_LIMIT, BACKEND_URL, SUPABASE_URL, SUPABASE_KEY } from '@pluckk/shared/constants';
import {
  signInWithGoogle,
  getSession,
  getUserProfile,
  getAccessToken
} from '../src/auth';
import { initSandAnimation, type CleanupFunction } from './sand-animation';
import { initializeTheme, toggleTheme, type Theme } from '../src/theme';
import type {
  GeneratedCard,
  GenerateCardsResponse,
  MochiStatusResponse,
  SendToMochiResponse,
  SelectionData,
  EditedCard,
  CardToSave,
  ProfileCache,
  SelectionResponse,
} from '../src/types';

// DOM Elements - Main UI
const loadingState = document.getElementById('loading-state') as HTMLElement | null;
const errorState = document.getElementById('error-state') as HTMLElement | null;
const noSelectionState = document.getElementById('no-selection-state') as HTMLElement | null;
const screenshotState = document.getElementById('screenshot-state') as HTMLElement | null;
const apiKeyState = document.getElementById('api-key-state') as HTMLElement | null;
const usageLimitState = document.getElementById('usage-limit-state') as HTMLElement | null;
const cardsState = document.getElementById('cards-state') as HTMLElement | null;
const readyStateWrapper = document.getElementById('ready-state-wrapper') as HTMLElement | null;
const cardsList = document.getElementById('cards-list') as HTMLElement | null;
const errorMessage = document.getElementById('error-message') as HTMLElement | null;
const mochiBtn = document.getElementById('mochi-btn') as HTMLButtonElement | null;
const retryBtn = document.getElementById('retry-btn') as HTMLButtonElement | null;
const logoText = document.getElementById('logo-text') as HTMLElement | null;
const readyHint = document.getElementById('ready-hint') as HTMLElement | null;
const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement | null;
const regenerateBtn = document.getElementById('regenerate-btn') as HTMLButtonElement | null;
const openSettingsBtn = document.getElementById('open-settings-btn') as HTMLButtonElement | null;
const upgradeBtn = document.getElementById('upgrade-btn') as HTMLButtonElement | null;
const closeBtn = document.getElementById('close-btn') as HTMLButtonElement | null;
const selectedCountEl = document.getElementById('selected-count') as HTMLElement | null;
const totalCountEl = document.getElementById('total-count') as HTMLElement | null;
const focusInputContainer = document.getElementById('focus-input-container') as HTMLElement | null;
const focusInput = document.getElementById('focus-input') as HTMLInputElement | null;
const generateWithFocusBtn = document.getElementById('generate-with-focus-btn') as HTMLButtonElement | null;

// DOM Elements - Question Input Mode
const _questionInputContainer = document.getElementById('question-input-container') as HTMLElement | null;
const questionInput = document.getElementById('question-input') as HTMLTextAreaElement | null;
const questionSubmitBtn = document.getElementById('question-submit-btn') as HTMLButtonElement | null;

// DOM Elements - Settings Drawer
const settingsDrawer = document.getElementById('settings-drawer') as HTMLElement | null;
const drawerAuthLoggedOut = document.getElementById('drawer-auth-logged-out') as HTMLElement | null;
const drawerAuthLoggedIn = document.getElementById('drawer-auth-logged-in') as HTMLElement | null;
const drawerSignInBtn = document.getElementById('drawer-sign-in-btn') as HTMLButtonElement | null;
const drawerUsageRow = document.getElementById('drawer-usage-row') as HTMLElement | null;
const drawerUsageBar = document.getElementById('drawer-usage-bar') as HTMLElement | null;
const drawerUsageText = document.getElementById('drawer-usage-text') as HTMLElement | null;
const drawerBillingRow = document.getElementById('drawer-billing-row') as HTMLElement | null;
const drawerProRow = document.getElementById('drawer-pro-row') as HTMLElement | null;
const drawerUpgradeBtn = document.getElementById('drawer-upgrade-btn') as HTMLButtonElement | null;
const drawerProBtn = document.getElementById('drawer-pro-btn') as HTMLButtonElement | null;
const drawerVersion = document.getElementById('drawer-version') as HTMLElement | null;
const drawerThemeToggle = document.getElementById('drawer-theme-toggle') as HTMLInputElement | null;
const drawerKeepOpenToggle = document.getElementById('drawer-keep-open-toggle') as HTMLInputElement | null;
const pageContextToggle = document.getElementById('page-context-toggle') as HTMLInputElement | null;
// DOM Elements - Review Card
const reviewCardContainer = document.getElementById('review-card-container') as HTMLElement | null;
const reviewCard = document.getElementById('review-card') as HTMLElement | null;
const activityGridMini = document.getElementById('activity-grid-mini') as HTMLElement | null;
const reviewSettingsBtn = document.getElementById('review-settings-btn') as HTMLButtonElement | null;

// Activity data types
interface ActivityDataPoint {
  reviews: number;
  cardsCreated: number;
}

interface ActivityDataMap {
  [date: string]: ActivityDataPoint;
}

// Activity cache
const ACTIVITY_CACHE_KEY = 'pluckk_activity_cache';
const ACTIVITY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface ActivityCache {
  data: ActivityDataMap;
  timestamp: number;
}

// State
let cards: GeneratedCard[] = [];
let selectedIndices = new Set<number>(); // Multi-select support
let sourceUrl = '';
let editedCards: Record<number, EditedCard> = {};
let _mochiConfigured = false;
let cachedSelectionData: SelectionData | null = null; // Cache selection for regeneration
let currentIsPro = false; // Track subscription status for usage updates

// Screenshot/Image mode state
let isImageMode = false;
let pastedImageData: string | null = null; // Base64 image data
let pastedImageMimeType: string | null = null; // e.g., 'image/png'

// Page context state (captured when image is pasted with toggle enabled)
interface CapturedPageContext {
  domContext: {
    headings: string[];
    visibleText: string;
    url: string;
    title: string;
  };
  viewportScreenshot?: {
    imageData: string;
    mimeType: string;
  };
}
let capturedPageContext: CapturedPageContext | null = null;

// Question input mode state
let _isQuestionMode = false;

// Diagram generation state (tracks which diagram cards should generate images)
let diagramGenerateFlags: Record<number, boolean> = {}; // { cardIndex: boolean }
let _userIsPro = false; // Track if user is Pro (for diagram feature)

// Keep open preference
let keepOpenAfterStoring = false;

// Page context capture preference (for screenshot mode)
let includePageContext = false;

// Theme state
let currentTheme: Theme = 'light';
let sandAnimationCleanup: CleanupFunction | null = null;

/**
 * Show a specific state, hide all others
 * Also manages selection polling (only poll when in ready state)
 */
function showState(state: HTMLElement | null): void {
  const states = [loadingState, errorState, noSelectionState, screenshotState, apiKeyState, usageLimitState, cardsState];
  states.forEach(s => s?.classList.add('hidden'));
  state?.classList.remove('hidden');

  // Manage ready-state-wrapper visibility
  if (state === noSelectionState) {
    readyStateWrapper?.classList.remove('hidden');
    startSelectionPolling();
  } else {
    readyStateWrapper?.classList.add('hidden');
    stopSelectionPolling();
  }

  // Show review card container during ready and screenshot states
  if (state === noSelectionState || state === screenshotState) {
    reviewCardContainer?.classList.remove('hidden');
  } else {
    reviewCardContainer?.classList.add('hidden');
  }
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
    _mochiConfigured = response.configured;
  } catch (error) {
    console.error('Failed to check Mochi status:', error);
    _mochiConfigured = false;
  }
}

/**
 * Update selection count display
 */
function updateSelectionCount(): void {
  const count = selectedIndices.size;
  if (selectedCountEl) selectedCountEl.textContent = String(count);
  if (totalCountEl) totalCountEl.textContent = String(cards.length);

  // Update button states
  const hasSelection = count > 0;
  if (mochiBtn) {
    mochiBtn.disabled = !hasSelection;

    // Update button text with count
    const btnText = mochiBtn.querySelector('.btn-text');
    if (btnText) {
      if (hasSelection && count > 1) {
        btnText.textContent = `Store ${count}`;
      } else {
        btnText.textContent = 'Store';
      }
    }
  }
}

/**
 * Render cards in the UI
 * Handles special rendering for qa_bidirectional and diagram card styles
 */
function renderCards(): void {
  if (!cardsList) return;
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
    cardEl.dataset.index = String(index);

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
    cardEl.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.hasAttribute('contenteditable') && target.isContentEditable) {
        return;
      }
      if (target.classList.contains('diagram-checkbox') || target.closest('.diagram-checkbox-label')) {
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
function renderStandardCard(cardEl: HTMLElement, card: GeneratedCard, index: number, edited: EditedCard): void {
  const question = edited.question !== undefined ? edited.question : card.question || '';
  const answer = edited.answer !== undefined ? edited.answer : card.answer || '';

  // Check if this is a question-mode card that was improved
  const wasImproved = card.wasImproved && card.originalQuestion;
  const improvedBadge = wasImproved
    ? `<span class="question-improved-badge" title="Original: ${escapeHtml(card.originalQuestion || '')}">Refined</span>`
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
function renderBidirectionalCard(cardEl: HTMLElement, card: GeneratedCard, index: number, edited: EditedCard): void {
  const forwardQ = edited.forwardQuestion !== undefined ? edited.forwardQuestion : card.forward?.question || '';
  const forwardA = edited.forwardAnswer !== undefined ? edited.forwardAnswer : card.forward?.answer || '';
  const reverseQ = edited.reverseQuestion !== undefined ? edited.reverseQuestion : card.reverse?.question || '';
  const reverseA = edited.reverseAnswer !== undefined ? edited.reverseAnswer : card.reverse?.answer || '';

  cardEl.innerHTML = `
    <div class="card-checkbox"></div>
    <div class="card-content">
      <div class="card-style-label">Bidirectional</div>
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
function renderDiagramCard(cardEl: HTMLElement, card: GeneratedCard, index: number, edited: EditedCard): void {
  const question = edited.question !== undefined ? edited.question : card.question || '';
  const answer = edited.answer !== undefined ? edited.answer : card.answer || '';
  const diagramPrompt = card.diagram_prompt || '';

  cardEl.innerHTML = `
    <div class="card-checkbox"></div>
    <div class="card-content">
      <div class="card-question" contenteditable="true" data-field="question">${escapeHtml(question)}</div>
      <div class="card-divider"></div>
      <div class="card-answer" contenteditable="true" data-field="answer">${escapeHtml(answer)}</div>
      <div class="diagram-section">
        <div class="diagram-label">Diagram prompt:</div>
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
  const checkbox = cardEl.querySelector('.diagram-checkbox') as HTMLInputElement | null;
  if (checkbox) {
    checkbox.addEventListener('change', (e: Event) => {
      diagramGenerateFlags[index] = (e.target as HTMLInputElement).checked;
    });
  }
}

/**
 * Render a list card (shows all cloze prompts with one item blank + final all-blank)
 */
function renderListCard(cardEl: HTMLElement, card: GeneratedCard, _index: number, _edited: EditedCard): void {
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
      <div class="card-style-label">List (${itemCount} items - ${prompts.length} cards)</div>
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
function setupStandardEditHandlers(cardEl: HTMLElement, index: number): void {
  const questionEl = cardEl.querySelector('.card-question') as HTMLElement | null;
  const answerEl = cardEl.querySelector('.card-answer') as HTMLElement | null;

  if (questionEl) {
    questionEl.addEventListener('input', () => {
      if (!editedCards[index]) editedCards[index] = {};
      editedCards[index].question = questionEl.textContent || '';
    });
  }

  if (answerEl) {
    answerEl.addEventListener('input', () => {
      if (!editedCards[index]) editedCards[index] = {};
      editedCards[index].answer = answerEl.textContent || '';
    });
  }
}

/**
 * Setup edit handlers for bidirectional cards
 */
function setupBidirectionalEditHandlers(cardEl: HTMLElement, index: number): void {
  const fields: (keyof EditedCard)[] = ['forwardQuestion', 'forwardAnswer', 'reverseQuestion', 'reverseAnswer'];

  fields.forEach(field => {
    const el = cardEl.querySelector(`[data-field="${field}"]`) as HTMLElement | null;
    if (el) {
      el.addEventListener('input', () => {
        if (!editedCards[index]) editedCards[index] = {};
        (editedCards[index] as Record<string, string>)[field] = el.textContent || '';
      });
    }
  });
}

/**
 * Toggle card selection
 */
function toggleCard(index: number): void {
  if (selectedIndices.has(index)) {
    selectedIndices.delete(index);
  } else {
    selectedIndices.add(index);
  }

  // Update UI
  const cardEl = cardsList?.children[index] as HTMLElement | undefined;
  if (cardEl) {
    cardEl.classList.toggle('selected', selectedIndices.has(index));
  }

  updateSelectionCount();
}

/**
 * Get all selected cards with edits applied
 * Expands qa_bidirectional into two separate cards for storage
 */
function getSelectedCards(): CardToSave[] {
  const result: CardToSave[] = [];

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
        question: edited.question !== undefined ? edited.question : card.question || '',
        answer: edited.answer !== undefined ? edited.answer : card.answer || '',
        style: card.style,
        tags: card.tags,
        diagram_prompt: card.diagram_prompt,
        generateDiagram: diagramGenerateFlags[index] || false
      });
    } else {
      // Standard card
      result.push({
        question: edited.question !== undefined ? edited.question : card.question || '',
        answer: edited.answer !== undefined ? edited.answer : card.answer || '',
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
async function sendToMochi(): Promise<void> {
  const selectedCards = getSelectedCards();
  if (selectedCards.length === 0) return;

  if (mochiBtn) mochiBtn.disabled = true;
  const totalCards = selectedCards.length;
  let savedCount = 0;
  const supabaseErrors: string[] = [];

  const btnText = mochiBtn?.querySelector('.btn-text');
  if (btnText) btnText.textContent = `Storing 0/${totalCards}...`;

  for (const card of selectedCards) {
    try {
      interface MessageData {
        action: string;
        question: string;
        answer: string;
        sourceUrl: string;
        tags?: string[];
        screenshotData?: string;
        screenshotMimeType?: string;
        generateDiagram?: boolean;
        diagramPrompt?: string;
        sourceSelection?: string;
        sourceContext?: string;
        sourceTitle?: string;
        sourceSelector?: string;
        sourceTextOffset?: number;
      }

      const messageData: MessageData = {
        action: 'sendToMochi',
        question: card.question,
        answer: card.answer,
        sourceUrl: sourceUrl,
        tags: card.tags,
        // Include source context for storage
        sourceSelection: cachedSelectionData?.selection,
        sourceContext: cachedSelectionData?.context,
        sourceTitle: cachedSelectionData?.title,
        // Include source anchoring for deep-linking
        sourceSelector: cachedSelectionData?.selector,
        sourceTextOffset: cachedSelectionData?.textOffset
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

      const response: SendToMochiResponse = await chrome.runtime.sendMessage(messageData);

      // Track Supabase success (primary storage)
      if (response.supabase?.success || response.supabase?.cardId) {
        savedCount++;
      } else if (response.supabase?.error) {
        supabaseErrors.push(response.supabase.message || response.supabase.error);
      }

      // Track Mochi success (optional integration) - we don't need to track count
      // Just note if Mochi isn't configured (that's fine, Supabase is primary)
      if (response.mochi?.error === 'mochi_api_key_missing' || response.mochi?.error === 'mochi_deck_not_selected') {
        // Mochi not set up, that's fine - Supabase is primary storage
      }

      if (btnText) btnText.textContent = `Storing ${savedCount}/${totalCards}...`;

      // Small delay between requests to respect rate limiting
      if (selectedCards.indexOf(card) < selectedCards.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    } catch (error) {
      supabaseErrors.push((error as Error).message);
    }
  }

  // Check if anything was saved
  if (savedCount === 0 && supabaseErrors.length > 0) {
    // Nothing saved at all - show error
    showError('Failed to save cards. Please try again.');
    if (mochiBtn) mochiBtn.disabled = false;
    updateSelectionCount();
    return;
  }

  // Show success
  if (mochiBtn) {
    mochiBtn.classList.add('btn-success');
    mochiBtn.classList.remove('btn-mochi');
  }

  // Determine success message
  let successMsg: string;
  if (savedCount > 0) {
    successMsg = `Stored ${savedCount}!`;
  } else {
    successMsg = 'Stored!';
  }

  if (btnText) btnText.textContent = successMsg;

  // Clear screenshot data to free memory
  if (isImageMode) {
    pastedImageData = null;
    pastedImageMimeType = null;
    capturedPageContext = null;
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
      if (mochiBtn) {
        mochiBtn.classList.remove('btn-success');
        mochiBtn.classList.add('btn-mochi');
        const text = mochiBtn.querySelector('.btn-text');
        if (text) text.textContent = 'Store';
        mochiBtn.disabled = true;
      }
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
function flattenCards(rawCards: GeneratedCard[]): GeneratedCard[] {
  // All cards pass through unchanged - expansion happens at save time
  return rawCards;
}

/**
 * Resize an image to max dimensions and compress to target size
 */
interface ResizedImage {
  data: string;
  mimeType: string;
}

async function resizeImage(
  base64Data: string,
  mimeType: string,
  maxDimension = 1024,
  targetSizeKB = 200
): Promise<ResizedImage> {
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
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
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
 * Capture page context (DOM text + viewport screenshot) from the active tab
 */
async function capturePageContext(): Promise<CapturedPageContext | null> {
  try {
    console.log('[Pluckk] Capturing page context...');

    // Request DOM context and viewport screenshot through background worker
    // (background ensures content script is injected first)
    const [domContextResponse, viewportResponse] = await Promise.all([
      chrome.runtime.sendMessage({ action: 'getDOMContext' }).catch((e) => {
        console.error('[Pluckk] getDOMContext failed:', e);
        return null;
      }),
      chrome.runtime.sendMessage({ action: 'captureViewport' }).catch((e) => {
        console.error('[Pluckk] captureViewport failed:', e);
        return null;
      })
    ]);

    console.log('[Pluckk] DOM context response:', domContextResponse);
    console.log('[Pluckk] Viewport response:', viewportResponse ? 'captured' : 'null');

    if (!domContextResponse) {
      console.log('[Pluckk] No DOM context received');
      return null;
    }

    const result: CapturedPageContext = {
      domContext: domContextResponse as CapturedPageContext['domContext']
    };

    if (viewportResponse) {
      result.viewportScreenshot = viewportResponse as CapturedPageContext['viewportScreenshot'];
    }

    console.log('[Pluckk] Page context captured:', {
      headings: result.domContext.headings,
      visibleTextLength: result.domContext.visibleText?.length,
      visibleTextPreview: result.domContext.visibleText?.substring(0, 200),
      hasViewport: !!result.viewportScreenshot
    });

    return result;
  } catch (error) {
    console.error('[Pluckk] Failed to capture page context:', error);
    return null;
  }
}

/**
 * Handle paste event to capture screenshots
 */
async function handlePaste(e: ClipboardEvent): Promise<void> {
  const items = e.clipboardData?.items;
  if (!items) return;

  // Check for image in clipboard FIRST (before checking target element)
  let imageItem: DataTransferItem | null = null;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      imageItem = item;
      break;
    }
  }

  // If no image, allow normal text paste behavior (in inputs, textareas, etc.)
  if (!imageItem) {
    return;
  }

  // Image found - always handle it, regardless of focus
  // (Images can't be pasted into text inputs anyway)
  e.preventDefault();

  const blob = imageItem.getAsFile();
  if (!blob) return;

  // Capture page context BEFORE processing image (if toggle enabled)
  // Must do this while we're still on the page
  let pageContext: CapturedPageContext | null = null;
  console.log('[Pluckk] Image pasted. includePageContext toggle:', includePageContext);
  if (includePageContext) {
    pageContext = await capturePageContext();
    console.log('[Pluckk] Page context after capture:', pageContext ? 'captured' : 'null');
  } else {
    console.log('[Pluckk] Skipping page context capture (toggle OFF)');
  }

  // Convert to base64
  const reader = new FileReader();
  reader.onload = async () => {
    const base64WithPrefix = reader.result as string;
    const [prefix, rawData] = base64WithPrefix.split(',');
    const originalMimeType = prefix.match(/data:(.*);base64/)?.[1] || 'image/png';

    try {
      // Resize and compress the image
      const { data, mimeType } = await resizeImage(rawData, originalMimeType);

      // Store the screenshot data
      pastedImageData = data;
      pastedImageMimeType = mimeType;
      isImageMode = true;

      // Store captured page context
      capturedPageContext = pageContext;

      // Show screenshot preview
      showScreenshotPreview(data);
    } catch (error) {
      console.error('Failed to process screenshot:', error);
      showError('Failed to process screenshot. Please try again.');
    }
  };
  reader.readAsDataURL(blob);
}

/**
 * Show the screenshot preview state
 */
function showScreenshotPreview(base64Data: string): void {
  const previewImg = document.getElementById('screenshot-preview-img') as HTMLImageElement | null;
  if (previewImg) {
    previewImg.src = `data:image/jpeg;base64,${base64Data}`;
  }
  showState(screenshotState);
}

/**
 * Clear the pasted screenshot and return to ready state
 */
function clearScreenshot(): void {
  pastedImageData = null;
  pastedImageMimeType = null;
  capturedPageContext = null;
  isImageMode = false;
  showState(noSelectionState);
}

/**
 * Generate cards from the pasted screenshot
 */
async function generateCardsFromImage(focusText = '', isRetry = false): Promise<void> {
  if (!pastedImageData || !pastedImageMimeType) {
    showError('No screenshot to analyze');
    return;
  }

  showState(loadingState);
  await checkMochiStatus();

  try {
    interface GenerateFromImageMessage {
      action: string;
      imageData: string;
      mimeType: string;
      focusText?: string;
      pageContext?: CapturedPageContext;
    }

    const message: GenerateFromImageMessage = {
      action: 'generateCardsFromImage',
      imageData: pastedImageData,
      mimeType: pastedImageMimeType,
      focusText: focusText
    };

    // Include page context if captured
    if (capturedPageContext) {
      message.pageContext = capturedPageContext;
      console.log('[Pluckk] Sending page context with image generation:', {
        headings: capturedPageContext.domContext.headings,
        visibleTextLength: capturedPageContext.domContext.visibleText?.length,
        hasViewport: !!capturedPageContext.viewportScreenshot
      });
    } else {
      console.log('[Pluckk] No page context to send with image generation');
    }

    const response: GenerateCardsResponse = await chrome.runtime.sendMessage(message);

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
        usage: { cardsThisMonth: response.usage.cardsThisMonth || 0, limit: response.usage.limit || FREE_TIER_LIMIT },
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
 */
async function generateCards(focusText = '', useCache = false): Promise<void> {
  // Always show loading state immediately
  showState(loadingState);

  await checkMochiStatus();

  try {
    const response: GenerateCardsResponse = await chrome.runtime.sendMessage({
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
        usage: { cardsThisMonth: response.usage.cardsThisMonth || 0, limit: response.usage.limit || FREE_TIER_LIMIT },
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
async function generateFromQuestion(): Promise<void> {
  const question = questionInput?.value.trim() || '';
  if (!question || question.length < 3) {
    return;
  }

  _isQuestionMode = true;
  showState(loadingState);
  await checkMochiStatus();

  // Always include page context for better answers
  interface PageContext {
    url?: string;
    title?: string;
  }
  let pageContext: PageContext | null = null;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      pageContext = { url: tab.url, title: tab.title };
    }
  } catch (e) {
    // Ignore - page context is optional
  }

  try {
    const response: GenerateCardsResponse = await chrome.runtime.sendMessage({
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
    if (questionInput) {
      questionInput.value = '';
      questionInput.style.height = 'auto';
      questionInput.style.width = '22px';
    }
    questionSubmitBtn?.classList.add('hidden');

    // Update usage display if included in response
    if (response.usage) {
      applyProfileToUI({
        usage: { cardsThisMonth: response.usage.cardsThisMonth || 0, limit: response.usage.limit || FREE_TIER_LIMIT },
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
let selectionPollInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Check current selection state and update UI
 */
async function checkSelectionState(): Promise<void> {
  // Only check if we're showing the ready state
  if (noSelectionState?.classList.contains('hidden')) {
    return;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;

    const selectionData: SelectionResponse = await chrome.tabs.sendMessage(tab.id, { action: 'getSelection' });

    if (selectionData?.selection) {
      // We have text selected - show generate button, hide hint
      readyHint?.classList.add('hidden');
      generateBtn?.classList.remove('hidden');
    } else {
      // No selection - hide generate button, show hint
      readyHint?.classList.remove('hidden');
      if (readyHint) readyHint.textContent = 'Select text or paste screenshot';
      generateBtn?.classList.add('hidden');
    }
  } catch (error) {
    // Content script not available - keep current state
    console.log('Selection check error:', error);
    generateBtn?.classList.add('hidden');
  }
}

/**
 * Start polling for selection changes
 */
function startSelectionPolling(): void {
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
function stopSelectionPolling(): void {
  if (selectionPollInterval) {
    clearInterval(selectionPollInterval);
    selectionPollInterval = null;
  }
}

/**
 * Format date as YYYY-MM-DD (local timezone)
 */
function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get cached activity data
 */
async function getCachedActivity(): Promise<ActivityCache | null> {
  try {
    const result = await chrome.storage.local.get([ACTIVITY_CACHE_KEY]);
    return result[ACTIVITY_CACHE_KEY] || null;
  } catch {
    return null;
  }
}

/**
 * Cache activity data
 */
async function cacheActivity(cache: ActivityCache): Promise<void> {
  try {
    await chrome.storage.local.set({ [ACTIVITY_CACHE_KEY]: cache });
  } catch (error) {
    console.error('Failed to cache activity:', error);
  }
}

/**
 * Fetch activity data from Supabase (last 12 weeks)
 */
async function fetchActivityData(): Promise<ActivityDataMap | null> {
  const { session } = await getSession();
  if (!session?.user?.id) return null;

  const userId = session.user.id;
  const accessToken = session.access_token;

  // Calculate date 84 days ago (12 weeks)
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 84);
  const startDateStr = formatDateLocal(startDate);

  try {
    // Fetch review data
    const reviewsResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/user_daily_review_summary?user_id=eq.${userId}&review_date=gte.${startDateStr}&select=review_date,total_reviews`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'apikey': SUPABASE_KEY
        }
      }
    );

    // Fetch card creation data
    const cardsResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/user_daily_card_summary?user_id=eq.${userId}&created_date=gte.${startDateStr}&select=created_date,cards_created`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'apikey': SUPABASE_KEY
        }
      }
    );

    if (!reviewsResponse.ok && !cardsResponse.ok) return null;

    const reviewsData = reviewsResponse.ok ? await reviewsResponse.json() : [];
    const cardsData = cardsResponse.ok ? await cardsResponse.json() : [];

    // Combine into activity map
    const activityData: ActivityDataMap = {};

    for (const row of reviewsData) {
      if (!row.review_date || typeof row.review_date !== 'string') continue;
      activityData[row.review_date] = {
        reviews: row.total_reviews || 0,
        cardsCreated: 0
      };
    }

    for (const row of cardsData) {
      if (!row.created_date || typeof row.created_date !== 'string') continue;
      if (activityData[row.created_date]) {
        activityData[row.created_date].cardsCreated = row.cards_created || 0;
      } else {
        activityData[row.created_date] = {
          reviews: 0,
          cardsCreated: row.cards_created || 0
        };
      }
    }

    return activityData;
  } catch (error) {
    console.error('Failed to fetch activity data:', error);
    return null;
  }
}

/**
 * Format date for tooltip display (e.g., "Jan 15, 2026")
 */
function formatDateForTooltip(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/**
 * Render mini activity grid (last 12 weeks)
 */
function renderMiniActivityGrid(activityData: ActivityDataMap): void {
  if (!activityGridMini) return;

  // Calculate max count for intensity scaling
  let maxCount = 0;
  for (const date in activityData) {
    const total = (activityData[date].reviews || 0) + (activityData[date].cardsCreated || 0);
    if (total > maxCount) maxCount = total;
  }

  // Build grid HTML (12 weeks, 7 days each)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Start from ~12 weeks ago, adjusted to start on Sunday
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 83); // Go back ~12 weeks
  const dayOfWeek = startDate.getDay();
  startDate.setDate(startDate.getDate() - dayOfWeek); // Adjust to previous Sunday

  let html = '';
  const currentDate = new Date(startDate);

  for (let week = 0; week < 12; week++) {
    html += '<div class="activity-week">';

    for (let day = 0; day < 7; day++) {
      const dateStr = formatDateLocal(currentDate);
      const isFuture = currentDate > today;

      let level = 0;
      let reviews = 0;
      let cardsCreated = 0;

      if (!isFuture && activityData[dateStr]) {
        reviews = activityData[dateStr].reviews || 0;
        cardsCreated = activityData[dateStr].cardsCreated || 0;
        const total = reviews + cardsCreated;
        if (total > 0 && maxCount > 0) {
          const ratio = total / maxCount;
          if (ratio <= 0.25) level = 1;
          else if (ratio <= 0.5) level = 2;
          else if (ratio <= 0.75) level = 3;
          else level = 4;
        }
      }

      // Build tooltip text
      const formattedDate = formatDateForTooltip(currentDate);
      let tooltip = formattedDate;
      if (!isFuture) {
        if (reviews > 0 || cardsCreated > 0) {
          const parts: string[] = [];
          if (reviews > 0) parts.push(`${reviews} review${reviews !== 1 ? 's' : ''}`);
          if (cardsCreated > 0) parts.push(`${cardsCreated} card${cardsCreated !== 1 ? 's' : ''} created`);
          tooltip = `${formattedDate}\n${parts.join(', ')}`;
        } else {
          tooltip = `${formattedDate}\nNo activity`;
        }
      }

      const visibility = isFuture ? 'style="visibility: hidden;"' : '';
      html += `<div class="activity-day level-${level}" ${visibility} title="${tooltip}"></div>`;

      currentDate.setDate(currentDate.getDate() + 1);
    }

    html += '</div>';
  }

  activityGridMini.innerHTML = html;
}

/**
 * Render a skeleton loading grid (pulsing placeholder)
 */
function renderSkeletonGrid(): void {
  if (!activityGridMini) return;

  let html = '';
  for (let week = 0; week < 12; week++) {
    html += '<div class="activity-week">';
    for (let day = 0; day < 7; day++) {
      html += '<div class="activity-day skeleton"></div>';
    }
    html += '</div>';
  }
  activityGridMini.innerHTML = html;
}

/**
 * Update review card with activity data
 */
async function updateReviewCard(): Promise<void> {
  const { session } = await getSession();

  if (!session?.user) {
    // Not logged in - show empty state
    if (activityGridMini) {
      activityGridMini.innerHTML = '<span class="activity-grid-empty">Sign in to see activity</span>';
    }
    return;
  }

  // Check cache first - show immediately even if stale
  const cached = await getCachedActivity();
  if (cached?.data) {
    renderMiniActivityGrid(cached.data);

    // If cache is still fresh, we're done
    if (Date.now() - cached.timestamp < ACTIVITY_CACHE_TTL) {
      return;
    }
    // Otherwise, refresh in background (don't await, don't show loading)
    fetchActivityData().then(activityData => {
      if (activityData) {
        renderMiniActivityGrid(activityData);
        cacheActivity({ data: activityData, timestamp: Date.now() });
      }
    });
    return;
  }

  // No cache - show skeleton loading state
  renderSkeletonGrid();

  // Fetch fresh data
  const activityData = await fetchActivityData();

  if (activityData) {
    renderMiniActivityGrid(activityData);

    // Cache the data
    await cacheActivity({
      data: activityData,
      timestamp: Date.now()
    });
  } else {
    // Show empty state on error
    if (activityGridMini) {
      activityGridMini.innerHTML = '<span class="activity-grid-empty">No activity yet</span>';
    }
  }
}

/**
 * Initialize panel and start selection monitoring
 */
async function initializePanel(): Promise<void> {
  await checkMochiStatus();
  await updateAuthDisplay();
  updateReviewCard().catch(err => console.error('Failed to load activity grid:', err));

  // Reset button state
  generateBtn?.classList.add('hidden');
  if (readyHint) readyHint.textContent = 'Select text or paste screenshot';

  // Show ready state (this also starts polling)
  showState(noSelectionState);

  // Do initial selection check
  await checkSelectionState();
}

/**
 * Handle error responses
 */
function handleError(response: GenerateCardsResponse): void {
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
async function openWebapp(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.update(tab.id, { url: 'https://pluckk.app' });
  }
  window.close();
}

/**
 * Show status message (logs to console since no status UI)
 */
function showSettingsStatus(message: string, type: string): void {
  console.log(`[Pluckk] ${type}: ${message}`);
}

/**
 * Cache key for profile data
 */
const PROFILE_CACHE_KEY = 'pluckk_profile_cache';

/**
 * Get cached profile data
 */
async function getCachedProfile(): Promise<ProfileCache | null> {
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
async function cacheProfile(profile: ProfileCache): Promise<void> {
  try {
    await chrome.storage.local.set({ [PROFILE_CACHE_KEY]: profile });
  } catch (error) {
    console.error('Failed to cache profile:', error);
  }
}

/**
 * Clear cached profile (on sign out)
 */
async function clearCachedProfile(): Promise<void> {
  try {
    await chrome.storage.local.remove([PROFILE_CACHE_KEY]);
  } catch (error) {
    console.error('Failed to clear profile cache:', error);
  }
}

/**
 * Apply profile data to the UI (drawer elements)
 */
function applyProfileToUI(profile: ProfileCache | null): void {
  if (!profile) return;

  const used = profile.usage?.cardsThisMonth || 0;
  const limit = profile.usage?.limit || FREE_TIER_LIMIT;
  const isPro = profile.subscription?.isPro || profile.subscription?.status === 'active';

  // Store for later use in card generation response
  currentIsPro = isPro;

  // Always show "X cards created"
  if (drawerUsageText) drawerUsageText.textContent = `${used} cards created`;

  if (isPro) {
    // Pro users: hide bar, show Pro badge
    drawerUsageRow?.classList.add('pro');
    if (drawerUsageBar) drawerUsageBar.style.width = '0%';
    drawerBillingRow?.classList.add('hidden');
    drawerProRow?.classList.remove('hidden');
    drawerUpgradeBtn?.classList.remove('at-limit');
  } else {
    // Free users: show bar
    drawerUsageRow?.classList.remove('pro');
    const percentage = Math.min((used / limit) * 100, 100);
    if (drawerUsageBar) drawerUsageBar.style.width = `${percentage}%`;
    drawerBillingRow?.classList.remove('hidden');
    drawerProRow?.classList.add('hidden');

    drawerUsageBar?.classList.remove('warning', 'full');
    drawerUpgradeBtn?.classList.remove('at-limit');

    if (percentage >= 100) {
      drawerUsageBar?.classList.add('full');
      drawerUpgradeBtn?.classList.add('at-limit');
    } else if (percentage >= 75) {
      drawerUsageBar?.classList.add('warning');
    }
  }
}

/**
 * Update auth display in drawer
 */
async function updateAuthDisplay(): Promise<void> {
  const { user } = await getSession();

  if (user) {
    drawerAuthLoggedOut?.classList.add('hidden');
    drawerAuthLoggedIn?.classList.remove('hidden');

    // First, apply cached profile immediately (no flash)
    const cachedProfile = await getCachedProfile();
    if (cachedProfile) {
      applyProfileToUI(cachedProfile);
    }

    // Then fetch fresh data in background
    const freshProfile = await getUserProfile();
    if (freshProfile) {
      const profileCache: ProfileCache = {
        usage: {
          cardsThisMonth: freshProfile.cards_generated_this_month || freshProfile.usage?.cardsThisMonth || 0,
          limit: freshProfile.usage?.limit || FREE_TIER_LIMIT
        },
        subscription: {
          isPro: freshProfile.subscription_status === 'active' || freshProfile.subscription?.isPro || false,
          status: freshProfile.subscription_status || freshProfile.subscription?.status
        }
      };
      applyProfileToUI(profileCache);
      cacheProfile(profileCache);
    }
  } else {
    drawerAuthLoggedOut?.classList.remove('hidden');
    drawerAuthLoggedIn?.classList.add('hidden');
    clearCachedProfile();
  }
}


/**
 * Handle Google sign in
 */
async function handleGoogleSignIn(): Promise<void> {
  if (drawerSignInBtn) {
    drawerSignInBtn.disabled = true;
    drawerSignInBtn.textContent = 'Signing in...';
  }

  try {
    await signInWithGoogle();
    await updateAuthDisplay();
    // Also refresh the main panel in case auth was needed
    initializePanel();
  } catch (error) {
    console.error('Sign in error:', error);
    showSettingsStatus('Sign in failed', 'error');
  } finally {
    if (drawerSignInBtn) {
      drawerSignInBtn.disabled = false;
      drawerSignInBtn.innerHTML = `
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
}

/**
 * Handle upgrade button - open Stripe Checkout
 */
async function handleUpgrade(): Promise<void> {
  if (drawerUpgradeBtn) {
    drawerUpgradeBtn.disabled = true;
    drawerUpgradeBtn.textContent = '...';
  }

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

    interface CheckoutResponse {
      url: string;
    }
    const { url }: CheckoutResponse = await response.json();
    chrome.tabs.create({ url });
  } catch (error) {
    console.error('Upgrade error:', error);
    showSettingsStatus('Failed to start checkout', 'error');
  } finally {
    if (drawerUpgradeBtn) {
      drawerUpgradeBtn.disabled = false;
      drawerUpgradeBtn.textContent = 'Upgrade to Pro';
    }
  }
}

/**
 * Handle manage subscription - open Stripe Customer Portal
 */
async function handleManageSubscription(): Promise<void> {
  if (drawerProBtn) {
    drawerProBtn.disabled = true;
    drawerProBtn.textContent = '...';
  }

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      showSettingsStatus('Please sign in first', 'error');
      return;
    }

    const response = await fetch(`${BACKEND_URL}/api/portal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        returnUrl: 'https://pluckk.app'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Portal failed');
    }

    interface PortalResponse {
      url: string;
    }
    const { url }: PortalResponse = await response.json();
    chrome.tabs.create({ url });
  } catch (error) {
    console.error('Portal error:', error);
    showSettingsStatus('Failed to open subscription portal', 'error');
  } finally {
    if (drawerProBtn) {
      drawerProBtn.disabled = false;
      drawerProBtn.textContent = 'Pro';
    }
  }
}

/**
 * Close the side panel
 */
function closePanel(): void {
  window.close();
}

/**
 * Toggle focus input visibility
 */
function toggleFocusInput(): void {
  const isExpanded = !focusInputContainer?.classList.contains('hidden');
  if (isExpanded) {
    // Collapse
    focusInputContainer?.classList.add('hidden');
  } else {
    // Expand
    focusInputContainer?.classList.remove('hidden');
    focusInput?.focus();
  }
}

/**
 * Generate with focus text and collapse input
 * Uses cached selection so user doesn't need to re-select text
 */
function generateWithFocus(): void {
  const focusText = focusInput?.value.trim() || '';
  focusInputContainer?.classList.add('hidden');
  if (focusInput) focusInput.value = '';

  // Use appropriate generation method based on mode
  if (isImageMode && pastedImageData) {
    generateCardsFromImage(focusText);
  } else {
    // Use cached selection for regeneration
    generateCards(focusText, true);
  }
}

// Event Listeners - Main UI
mochiBtn?.addEventListener('click', sendToMochi);
retryBtn?.addEventListener('click', () => generateCards());
logoText?.addEventListener('click', openWebapp);
generateBtn?.addEventListener('click', () => {
  showState(loadingState);
  generateCards();
});
regenerateBtn?.addEventListener('click', toggleFocusInput);
generateWithFocusBtn?.addEventListener('click', generateWithFocus);
focusInput?.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    generateWithFocus();
  }
  if (e.key === 'Escape') {
    focusInputContainer?.classList.add('hidden');
    if (focusInput) focusInput.value = '';
  }
});
openSettingsBtn?.addEventListener('click', handleGoogleSignIn);
upgradeBtn?.addEventListener('click', handleUpgrade);
closeBtn?.addEventListener('click', closePanel);

// Settings Drawer Toggle Functions
function toggleSettingsDrawer(): void {
  const isOpen = !settingsDrawer?.classList.contains('hidden');
  if (isOpen) {
    closeSettingsDrawer();
  } else {
    settingsDrawer?.classList.remove('hidden');
  }
}

function closeSettingsDrawer(): void {
  settingsDrawer?.classList.add('hidden');
}

// Event Listeners - Settings Drawer
drawerSignInBtn?.addEventListener('click', handleGoogleSignIn);
drawerUpgradeBtn?.addEventListener('click', handleUpgrade);
drawerProBtn?.addEventListener('click', handleManageSubscription);

// Event Listener - Review Card
reviewCard?.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://pluckk.app' });
  window.close();
});

// Event Listener - Review Card Settings Button
reviewSettingsBtn?.addEventListener('click', (e) => {
  e.stopPropagation(); // Prevent triggering review card click
  toggleSettingsDrawer();
});

// Close drawer when clicking outside
document.addEventListener('click', (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  const isDrawerOpen = !settingsDrawer?.classList.contains('hidden');
  const clickedInDrawer = settingsDrawer?.contains(target);
  const clickedSettingsBtn = reviewSettingsBtn?.contains(target);

  if (isDrawerOpen && !clickedInDrawer && !clickedSettingsBtn) {
    closeSettingsDrawer();
  }
});

// Event Listeners - Screenshot handling
document.addEventListener('paste', handlePaste);

// Wire up screenshot buttons and input
const screenshotGenerateBtn = document.getElementById('screenshot-generate-btn') as HTMLButtonElement | null;
const screenshotClearBtn = document.getElementById('screenshot-clear-btn') as HTMLButtonElement | null;
const screenshotFocusInput = document.getElementById('screenshot-focus-input') as HTMLInputElement | null;

function generateFromScreenshot(): void {
  const focusText = screenshotFocusInput?.value.trim() || '';
  generateCardsFromImage(focusText);
}

screenshotGenerateBtn?.addEventListener('click', generateFromScreenshot);
screenshotClearBtn?.addEventListener('click', clearScreenshot);
screenshotFocusInput?.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    generateFromScreenshot();
  }
});

// Event Listeners - Question Input Mode
questionSubmitBtn?.addEventListener('click', generateFromQuestion);
questionInput?.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    generateFromQuestion();
  }
});
// Auto-expand textarea in both directions as user types
questionInput?.addEventListener('input', () => {
  if (!questionInput) return;

  const text = questionInput.value || questionInput.placeholder;
  const hasContent = questionInput.value.trim().length > 0;

  // Show/hide submit button based on content
  if (hasContent) {
    questionSubmitBtn?.classList.remove('hidden');
  } else {
    questionSubmitBtn?.classList.add('hidden');
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

// Keyboard shortcuts
document.addEventListener('keydown', (e: KeyboardEvent) => {
  const target = e.target as HTMLElement;
  // Skip shortcuts when typing in input fields
  const isTyping = target.isContentEditable ||
                   target.tagName === 'INPUT' ||
                   target.tagName === 'TEXTAREA';

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

  // Escape to close (drawer first, then focus input, then panel)
  if (e.key === 'Escape') {
    if (!settingsDrawer?.classList.contains('hidden')) {
      closeSettingsDrawer();
    } else if (!focusInputContainer?.classList.contains('hidden')) {
      focusInputContainer?.classList.add('hidden');
      if (focusInput) focusInput.value = '';
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

/**
 * Initialize sand animation with current theme
 */
function initSandWithTheme(): void {
  // Clean up existing animation
  if (sandAnimationCleanup) {
    sandAnimationCleanup();
  }

  const sandCanvas = document.getElementById('sand-animation') as HTMLCanvasElement | null;
  if (sandCanvas) {
    sandAnimationCleanup = initSandAnimation(sandCanvas, {
      filterPosition: 0.98,
      speed: 0.3,
      opacity: 0.2,
      particleCount: 200,
      darkMode: currentTheme === 'dark'
    });
  }
}

/**
 * Update theme toggle checkbox state
 */
function updateThemeToggleState(): void {
  if (drawerThemeToggle) {
    drawerThemeToggle.checked = currentTheme === 'dark';
  }
}

/**
 * Handle theme change
 */
function handleThemeChange(theme: Theme): void {
  currentTheme = theme;
  updateThemeToggleState();
  initSandWithTheme();
}

/**
 * Initialize theme
 */
async function initTheme(): Promise<void> {
  currentTheme = await initializeTheme(handleThemeChange);
  updateThemeToggleState();
  initSandWithTheme();
}

// Theme toggle event listener (drawer checkbox)
drawerThemeToggle?.addEventListener('change', async () => {
  const newTheme = await toggleTheme();
  handleThemeChange(newTheme);
});

// Initialize theme
initTheme();

// Load keep-open preference
async function loadKeepOpenPreference(): Promise<void> {
  try {
    interface KeepOpenResult {
      keepOpenAfterStoring?: boolean;
    }
    const result: KeepOpenResult = await chrome.storage.sync.get(['keepOpenAfterStoring']);
    keepOpenAfterStoring = result.keepOpenAfterStoring || false;
    if (drawerKeepOpenToggle) {
      drawerKeepOpenToggle.checked = keepOpenAfterStoring;
    }
  } catch (error) {
    console.error('Failed to load keep-open preference:', error);
  }
}

// Save keep-open preference
async function saveKeepOpenPreference(value: boolean): Promise<void> {
  try {
    await chrome.storage.sync.set({ keepOpenAfterStoring: value });
    keepOpenAfterStoring = value;
  } catch (error) {
    console.error('Failed to save keep-open preference:', error);
  }
}

// Load page context preference
async function loadPageContextPreference(): Promise<void> {
  try {
    interface PageContextResult {
      includePageContext?: boolean;
    }
    const result: PageContextResult = await chrome.storage.sync.get(['includePageContext']);
    includePageContext = result.includePageContext || false;
    if (pageContextToggle) {
      pageContextToggle.checked = includePageContext;
    }
  } catch (error) {
    console.error('Failed to load page context preference:', error);
  }
}

// Save page context preference
async function savePageContextPreference(value: boolean): Promise<void> {
  try {
    await chrome.storage.sync.set({ includePageContext: value });
    includePageContext = value;
  } catch (error) {
    console.error('Failed to save page context preference:', error);
  }
}

// Wire up keep-open toggle (drawer)
drawerKeepOpenToggle?.addEventListener('change', (e: Event) => {
  saveKeepOpenPreference((e.target as HTMLInputElement).checked);
});

// Wire up page context toggle (screenshot state)
pageContextToggle?.addEventListener('change', (e: Event) => {
  savePageContextPreference((e.target as HTMLInputElement).checked);
});

// Set version from manifest
if (drawerVersion) {
  const manifest = chrome.runtime.getManifest();
  drawerVersion.textContent = `v${manifest.version}`;
}

// Load preferences and initialize panel
loadKeepOpenPreference();
loadPageContextPreference();
initializePanel();
