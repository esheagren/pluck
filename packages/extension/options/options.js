// Pluckk - Options Page Script

import { DEFAULT_SYSTEM_PROMPT, FREE_TIER_LIMIT, BACKEND_URL } from '@pluckk/shared/constants';
import {
  signInWithGoogle,
  signOut,
  getSession,
  getUserProfile,
  getAccessToken,
  onAuthStateChange
} from '../src/auth.js';

// DOM Elements
const loginSection = document.getElementById('login-section');
const settingsSection = document.getElementById('settings-section');
const pageSubtitle = document.getElementById('page-subtitle');
const googleSignInBtn = document.getElementById('google-sign-in-btn');
const signOutBtn = document.getElementById('sign-out-btn');
const userEmailEl = document.getElementById('user-email');
const usageBarFill = document.getElementById('usage-bar-fill');
const usageText = document.getElementById('usage-text');
const billingActions = document.getElementById('billing-actions');
const proActions = document.getElementById('pro-actions');
const upgradeBtn = document.getElementById('upgrade-btn');
const manageSubscriptionBtn = document.getElementById('manage-subscription-btn');

// Prompt elements
const systemPromptInput = document.getElementById('system-prompt');
const resetPromptBtn = document.getElementById('reset-prompt-btn');

// Form elements
const form = document.getElementById('settings-form');
const saveBtn = document.getElementById('save-btn');
const statusEl = document.getElementById('status');
const shortcutDisplay = document.getElementById('shortcut-display');
const closePageBtn = document.getElementById('close-page-btn');

// Mochi settings elements
const mochiApiKeyInput = document.getElementById('mochi-api-key');
const mochiDeckSelect = document.getElementById('mochi-deck');
const fetchDecksBtn = document.getElementById('fetch-decks-btn');

// State
let currentUser = null;

// Detect platform for shortcut display
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
shortcutDisplay.textContent = isMac ? 'Cmd+Shift+M' : 'Ctrl+Shift+M';

/**
 * Show login section, hide settings
 */
function showLoginState() {
  loginSection.classList.remove('hidden');
  settingsSection.classList.add('hidden');
  pageSubtitle.textContent = 'Sign in to generate flashcards';
}

/**
 * Show settings section, hide login
 */
function showSettingsState() {
  loginSection.classList.add('hidden');
  settingsSection.classList.remove('hidden');
  pageSubtitle.textContent = 'Configure your Pluckk settings';
}

/**
 * Update user display with email and usage stats
 */
async function updateUserDisplay(user) {
  if (!user) {
    showLoginState();
    return;
  }

  userEmailEl.textContent = user.email;
  showSettingsState();

  // Fetch and display usage stats
  const profile = await getUserProfile();
  if (profile) {
    const used = profile.cards_generated_this_month || 0;
    const limit = FREE_TIER_LIMIT;
    const isPro = profile.subscription_status === 'active';

    if (isPro) {
      usageText.textContent = `${used} cards (unlimited)`;
      usageBarFill.style.width = '0%';
      billingActions.classList.add('hidden');
      proActions.classList.remove('hidden');
    } else {
      const percentage = Math.min((used / limit) * 100, 100);
      usageText.textContent = `${used} / ${limit} cards`;
      usageBarFill.style.width = `${percentage}%`;
      billingActions.classList.remove('hidden');
      proActions.classList.add('hidden');

      // Update bar color based on usage
      usageBarFill.classList.remove('warning', 'full');
      if (percentage >= 100) {
        usageBarFill.classList.add('full');
      } else if (percentage >= 75) {
        usageBarFill.classList.add('warning');
      }
    }
  }
}

/**
 * Load existing settings on page load
 */
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get([
      'mochiApiKey',
      'mochiDeckId',
      'mochiDecks',
      'systemPrompt'
    ]);

    // Load system prompt (use default if not set)
    systemPromptInput.value = result.systemPrompt || DEFAULT_SYSTEM_PROMPT;

    if (result.mochiApiKey) {
      mochiApiKeyInput.value = result.mochiApiKey;
    }

    // If we have cached decks, populate the dropdown
    if (result.mochiDecks && result.mochiDecks.length > 0) {
      populateDecks(result.mochiDecks, result.mochiDeckId);
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

/**
 * Reset prompt to default
 */
resetPromptBtn.addEventListener('click', () => {
  systemPromptInput.value = DEFAULT_SYSTEM_PROMPT;
  showStatus('Prompt reset to default', 'success');
});

/**
 * Populate deck dropdown
 */
function populateDecks(decks, selectedId) {
  mochiDeckSelect.innerHTML = '<option value="">Select a deck</option>';
  mochiDeckSelect.disabled = false;

  decks.forEach(deck => {
    const option = document.createElement('option');
    option.value = deck.id;
    option.textContent = deck.name;
    if (deck.id === selectedId) {
      option.selected = true;
    }
    mochiDeckSelect.appendChild(option);
  });
}

/**
 * Fetch decks from Mochi API
 */
async function fetchDecks() {
  const mochiApiKey = mochiApiKeyInput.value.trim();

  if (!mochiApiKey) {
    showStatus('Enter Mochi API key first', 'error');
    return;
  }

  fetchDecksBtn.disabled = true;
  fetchDecksBtn.textContent = 'Fetching...';

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

    // Cache decks
    await chrome.storage.sync.set({ mochiDecks: decks });

    populateDecks(decks, null);
    showStatus('Decks loaded!', 'success');
  } catch (error) {
    console.error('Failed to fetch decks:', error);
    showStatus('Failed to fetch decks', 'error');
  } finally {
    fetchDecksBtn.disabled = false;
    fetchDecksBtn.textContent = 'Fetch Decks';
  }
}

/**
 * Show status message
 */
function showStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `status visible ${type}`;

  setTimeout(() => {
    statusEl.classList.remove('visible');
  }, 3000);
}

/**
 * Handle Google sign in
 */
async function handleSignIn() {
  googleSignInBtn.disabled = true;
  googleSignInBtn.textContent = 'Signing in...';

  try {
    const { user } = await signInWithGoogle();
    currentUser = user;
    updateUserDisplay(user);
  } catch (error) {
    console.error('Sign in error:', error);
    showStatus('Sign in failed: ' + error.message, 'error');
  } finally {
    googleSignInBtn.disabled = false;
    googleSignInBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24">
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
    currentUser = null;
    showLoginState();
  } catch (error) {
    console.error('Sign out error:', error);
    showStatus('Sign out failed', 'error');
  }
}

/**
 * Handle upgrade button click - open Stripe Checkout
 */
async function handleUpgrade() {
  upgradeBtn.disabled = true;
  upgradeBtn.textContent = 'Loading...';

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      showStatus('Please sign in first', 'error');
      return;
    }

    const response = await fetch(`${BACKEND_URL}/api/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        successUrl: window.location.href,
        cancelUrl: window.location.href
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Checkout failed');
    }

    const { url } = await response.json();
    // Open checkout in new tab
    window.open(url, '_blank');
  } catch (error) {
    console.error('Upgrade error:', error);
    showStatus('Failed to start checkout', 'error');
  } finally {
    upgradeBtn.disabled = false;
    upgradeBtn.textContent = 'Upgrade to Pro';
  }
}

/**
 * Handle manage subscription button click - open Stripe Customer Portal
 */
async function handleManageSubscription() {
  manageSubscriptionBtn.disabled = true;
  manageSubscriptionBtn.textContent = 'Loading...';

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      showStatus('Please sign in first', 'error');
      return;
    }

    const response = await fetch(`${BACKEND_URL}/api/portal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        returnUrl: window.location.href
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Portal failed');
    }

    const { url } = await response.json();
    // Open portal in new tab
    window.open(url, '_blank');
  } catch (error) {
    console.error('Portal error:', error);
    showStatus('Failed to open subscription portal', 'error');
  } finally {
    manageSubscriptionBtn.disabled = false;
    manageSubscriptionBtn.textContent = 'Manage subscription';
  }
}

// Event Listeners
fetchDecksBtn.addEventListener('click', fetchDecks);
googleSignInBtn.addEventListener('click', handleSignIn);
signOutBtn.addEventListener('click', handleSignOut);
upgradeBtn.addEventListener('click', handleUpgrade);
manageSubscriptionBtn.addEventListener('click', handleManageSubscription);

// Save settings
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const systemPrompt = systemPromptInput.value.trim();
  const mochiApiKey = mochiApiKeyInput.value.trim();
  const mochiDeckId = mochiDeckSelect.value;

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  try {
    await chrome.storage.sync.set({
      systemPrompt: systemPrompt || null,
      mochiApiKey: mochiApiKey || null,
      mochiDeckId: mochiDeckId || null
    });
    showStatus('Settings saved!', 'success');
  } catch (error) {
    console.error('Failed to save settings:', error);
    showStatus('Failed to save settings', 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Settings';
  }
});

// Close page button
closePageBtn.addEventListener('click', () => {
  window.close();
});

/**
 * Initialize the page
 */
async function init() {
  // Check for existing session
  const { user } = await getSession();

  if (user) {
    currentUser = user;
    updateUserDisplay(user);
    loadSettings();
  } else {
    showLoginState();
  }

  // Listen for auth state changes
  onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      currentUser = session.user;
      updateUserDisplay(session.user);
      loadSettings();
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      showLoginState();
    }
  });
}

// Initialize
init();
