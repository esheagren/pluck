// Pluckk - Side Panel Script
// Main UI logic for card generation and Mochi integration

import { escapeHtml } from '@pluckk/shared/utils';
import { DEFAULT_SYSTEM_PROMPT, FREE_TIER_LIMIT, BACKEND_URL } from '@pluckk/shared/constants';
import {
  signInWithGoogle,
  signOut,
  getSession,
  getUserProfile,
  getAccessToken
} from '../src/auth.js';

// DOM Elements - Main UI
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

// DOM Elements - Settings Section
const settingsSection = document.getElementById('settings-section');
const settingsHeader = document.getElementById('settings-header');
const authLoggedOut = document.getElementById('auth-logged-out');
const authLoggedIn = document.getElementById('auth-logged-in');
const googleSignInBtn = document.getElementById('google-sign-in-btn');
const signOutBtn = document.getElementById('sign-out-btn');
const settingsUserEmail = document.getElementById('settings-user-email');
const settingsUsageBar = document.getElementById('settings-usage-bar');
const settingsUsageText = document.getElementById('settings-usage-text');
const settingsBillingRow = document.getElementById('settings-billing-row');
const settingsProRow = document.getElementById('settings-pro-row');
const settingsUpgradeBtn = document.getElementById('settings-upgrade-btn');
const settingsManageBtn = document.getElementById('settings-manage-btn');
const settingsMochiKey = document.getElementById('settings-mochi-key');
const settingsMochiDeck = document.getElementById('settings-mochi-deck');
const settingsFetchDecks = document.getElementById('settings-fetch-decks');
const settingsPrompt = document.getElementById('settings-prompt');
const settingsResetPrompt = document.getElementById('settings-reset-prompt');
const settingsSaveBtn = document.getElementById('settings-save-btn');
const settingsStatus = document.getElementById('settings-status');
const shortcutDisplay = document.getElementById('shortcut-display');

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
  // If using cache, we know we have selection - show loading immediately
  if (useCache && cachedSelectionData) {
    showState(loadingState);
  }

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
 * Check for selection and generate cards if found, otherwise show ready state
 */
async function initializePanel() {
  await checkMochiStatus();

  // First, quickly check if there's a selection
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      showState(noSelectionState);
      return;
    }

    // Try to get selection from content script
    const selectionData = await chrome.tabs.sendMessage(tab.id, { action: 'getSelection' });

    if (selectionData?.selection) {
      // We have text selected - show loading and generate
      showState(loadingState);
      generateCards();
    } else {
      // No selection - show ready state (not an error)
      showState(noSelectionState);
    }
  } catch (error) {
    // Content script not available (e.g., chrome:// pages)
    showState(noSelectionState);
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
 * Toggle settings section visibility
 */
function toggleSettings() {
  const isHidden = settingsSection.classList.contains('hidden');
  if (isHidden) {
    settingsSection.classList.remove('hidden');
    loadSettingsData();
    // Scroll to settings
    settingsSection.scrollIntoView({ behavior: 'smooth' });
  } else {
    settingsSection.classList.add('hidden');
  }
}

/**
 * Toggle settings content collapse
 */
function toggleSettingsCollapse() {
  settingsSection.classList.toggle('collapsed');
}

/**
 * Load settings data into the form
 */
async function loadSettingsData() {
  // Update shortcut display based on platform
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  shortcutDisplay.textContent = isMac ? 'Cmd+Shift+M' : 'Ctrl+Shift+M';

  // Load auth state
  await updateAuthDisplay();

  // Load saved settings
  try {
    const result = await chrome.storage.sync.get([
      'mochiApiKey',
      'mochiDeckId',
      'mochiDecks',
      'systemPrompt'
    ]);

    settingsPrompt.value = result.systemPrompt || DEFAULT_SYSTEM_PROMPT;

    if (result.mochiApiKey) {
      settingsMochiKey.value = result.mochiApiKey;
    }

    if (result.mochiDecks && result.mochiDecks.length > 0) {
      populateMochiDecks(result.mochiDecks, result.mochiDeckId);
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
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
    settingsUserEmail.textContent = user.email;

    // Fetch usage stats
    const profile = await getUserProfile();
    if (profile) {
      const used = profile.cards_generated_this_month || 0;
      const limit = FREE_TIER_LIMIT;
      const isPro = profile.subscription_status === 'active';

      if (isPro) {
        settingsUsageText.textContent = `${used} (unlimited)`;
        settingsUsageBar.style.width = '0%';
        settingsBillingRow.classList.add('hidden');
        settingsProRow.classList.remove('hidden');
      } else {
        const percentage = Math.min((used / limit) * 100, 100);
        settingsUsageText.textContent = `${used} / ${limit}`;
        settingsUsageBar.style.width = `${percentage}%`;
        settingsBillingRow.classList.remove('hidden');
        settingsProRow.classList.add('hidden');

        settingsUsageBar.classList.remove('warning', 'full');
        if (percentage >= 100) {
          settingsUsageBar.classList.add('full');
        } else if (percentage >= 75) {
          settingsUsageBar.classList.add('warning');
        }
      }
    }
  } else {
    authLoggedOut.classList.remove('hidden');
    authLoggedIn.classList.add('hidden');
  }
}

/**
 * Populate Mochi deck dropdown
 */
function populateMochiDecks(decks, selectedId) {
  settingsMochiDeck.innerHTML = '<option value="">Select deck</option>';
  settingsMochiDeck.disabled = false;

  decks.forEach(deck => {
    const option = document.createElement('option');
    option.value = deck.id;
    option.textContent = deck.name;
    if (deck.id === selectedId) {
      option.selected = true;
    }
    settingsMochiDeck.appendChild(option);
  });
}

/**
 * Fetch decks from Mochi API
 */
async function fetchMochiDecks() {
  const mochiApiKey = settingsMochiKey.value.trim();

  if (!mochiApiKey) {
    showSettingsStatus('Enter API key first', 'error');
    return;
  }

  settingsFetchDecks.disabled = true;
  settingsFetchDecks.textContent = '...';

  try {
    const response = await fetch('https://app.mochi.cards/api/decks/', {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + btoa(mochiApiKey + ':')
      }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const decks = data.docs.map(deck => ({
      id: deck.id,
      name: deck.name
    }));

    await chrome.storage.sync.set({ mochiDecks: decks });
    populateMochiDecks(decks, null);
    showSettingsStatus('Decks loaded!', 'success');
  } catch (error) {
    console.error('Failed to fetch decks:', error);
    showSettingsStatus('Failed to fetch', 'error');
  } finally {
    settingsFetchDecks.disabled = false;
    settingsFetchDecks.textContent = 'Fetch';
  }
}

/**
 * Save settings
 */
async function saveSettings() {
  settingsSaveBtn.disabled = true;
  settingsSaveBtn.textContent = 'Saving...';

  try {
    const systemPrompt = settingsPrompt.value.trim();
    const mochiApiKey = settingsMochiKey.value.trim();
    const mochiDeckId = settingsMochiDeck.value;

    await chrome.storage.sync.set({
      systemPrompt: systemPrompt || null,
      mochiApiKey: mochiApiKey || null,
      mochiDeckId: mochiDeckId || null
    });

    showSettingsStatus('Saved!', 'success');
    await checkMochiStatus();
  } catch (error) {
    console.error('Failed to save settings:', error);
    showSettingsStatus('Failed to save', 'error');
  } finally {
    settingsSaveBtn.disabled = false;
    settingsSaveBtn.textContent = 'Save Settings';
  }
}

/**
 * Show settings status message
 */
function showSettingsStatus(message, type) {
  settingsStatus.textContent = message;
  settingsStatus.className = `settings-status visible ${type}`;

  setTimeout(() => {
    settingsStatus.classList.remove('visible');
  }, 2500);
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
 * Handle sign out
 */
async function handleSignOut() {
  try {
    await signOut();
    await updateAuthDisplay();
  } catch (error) {
    console.error('Sign out error:', error);
    showSettingsStatus('Sign out failed', 'error');
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
 * Handle manage subscription - open Stripe Portal
 */
async function handleManageSubscription() {
  settingsManageBtn.disabled = true;
  settingsManageBtn.textContent = '...';

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
      throw new Error('Portal failed');
    }

    const { url } = await response.json();
    chrome.tabs.create({ url });
  } catch (error) {
    console.error('Portal error:', error);
    showSettingsStatus('Failed to open portal', 'error');
  } finally {
    settingsManageBtn.disabled = false;
    settingsManageBtn.textContent = 'Manage';
  }
}

/**
 * Reset prompt to default
 */
function resetPromptToDefault() {
  settingsPrompt.value = DEFAULT_SYSTEM_PROMPT;
  showSettingsStatus('Reset to default', 'success');
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

// Event Listeners - Main UI
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
settingsBtn.addEventListener('click', toggleSettings);
openSettingsBtn.addEventListener('click', toggleSettings);
upgradeBtn.addEventListener('click', toggleSettings);
closeBtn.addEventListener('click', closePanel);

// Event Listeners - Settings Section
settingsHeader.addEventListener('click', toggleSettingsCollapse);
googleSignInBtn.addEventListener('click', handleGoogleSignIn);
signOutBtn.addEventListener('click', handleSignOut);
settingsUpgradeBtn.addEventListener('click', handleUpgrade);
settingsManageBtn.addEventListener('click', handleManageSubscription);
settingsFetchDecks.addEventListener('click', fetchMochiDecks);
settingsResetPrompt.addEventListener('click', resetPromptToDefault);
settingsSaveBtn.addEventListener('click', saveSettings);

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
    // Session changed, update settings display if visible
    console.log('Auth state changed');
    if (!settingsSection.classList.contains('hidden')) {
      updateAuthDisplay();
    }
    // Retry generation if we were waiting for auth
    if (apiKeyState && !apiKeyState.classList.contains('hidden')) {
      initializePanel();
    }
  }
});

// Initialize panel - check for selection first
initializePanel();
