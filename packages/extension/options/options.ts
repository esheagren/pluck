// Pluckk - Options Page Script

import { DEFAULT_SYSTEM_PROMPT, FREE_TIER_LIMIT, BACKEND_URL } from '@pluckk/shared/constants';
import {
  signInWithGoogle,
  signOut,
  getSession,
  getUserProfile,
  getAccessToken,
  onAuthStateChange
} from '../src/auth';
import { initializeTheme } from '../src/theme';
import type { SessionUser } from '../src/types';

// DOM Elements
const loginSection = document.getElementById('login-section') as HTMLElement | null;
const settingsSection = document.getElementById('settings-section') as HTMLElement | null;
const pageSubtitle = document.getElementById('page-subtitle') as HTMLElement | null;
const googleSignInBtn = document.getElementById('google-sign-in-btn') as HTMLButtonElement | null;
const signOutBtn = document.getElementById('sign-out-btn') as HTMLButtonElement | null;
const userEmailEl = document.getElementById('user-email') as HTMLElement | null;
const usageBarFill = document.getElementById('usage-bar-fill') as HTMLElement | null;
const usageText = document.getElementById('usage-text') as HTMLElement | null;
const billingActions = document.getElementById('billing-actions') as HTMLElement | null;
const proActions = document.getElementById('pro-actions') as HTMLElement | null;
const upgradeBtn = document.getElementById('upgrade-btn') as HTMLButtonElement | null;
const manageSubscriptionBtn = document.getElementById('manage-subscription-btn') as HTMLButtonElement | null;

// Prompt elements
const systemPromptInput = document.getElementById('system-prompt') as HTMLTextAreaElement | null;
const resetPromptBtn = document.getElementById('reset-prompt-btn') as HTMLButtonElement | null;

// Form elements
const form = document.getElementById('settings-form') as HTMLFormElement | null;
const saveBtn = document.getElementById('save-btn') as HTMLButtonElement | null;
const statusEl = document.getElementById('status') as HTMLElement | null;
const shortcutDisplay = document.getElementById('shortcut-display') as HTMLElement | null;
const closePageBtn = document.getElementById('close-page-btn') as HTMLButtonElement | null;
const showAnnotationsToggle = document.getElementById('show-annotations-toggle') as HTMLInputElement | null;


// State
let _currentUser: SessionUser | null = null;

// Detect platform for shortcut display
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
if (shortcutDisplay) {
  shortcutDisplay.textContent = isMac ? 'Cmd+Shift+M' : 'Ctrl+Shift+M';
}

/**
 * Show login section, hide settings
 */
function showLoginState(): void {
  loginSection?.classList.remove('hidden');
  settingsSection?.classList.add('hidden');
  if (pageSubtitle) {
    pageSubtitle.textContent = 'Sign in to generate flashcards';
  }
}

/**
 * Show settings section, hide login
 */
function showSettingsState(): void {
  loginSection?.classList.add('hidden');
  settingsSection?.classList.remove('hidden');
  if (pageSubtitle) {
    pageSubtitle.textContent = 'Configure your Pluckk settings';
  }
}

/**
 * Update user display with email and usage stats
 */
async function updateUserDisplay(user: SessionUser | null): Promise<void> {
  if (!user) {
    showLoginState();
    return;
  }

  if (userEmailEl) {
    userEmailEl.textContent = user.email;
  }
  showSettingsState();

  // Fetch and display usage stats
  const profile = await getUserProfile();
  if (profile) {
    const used = profile.cards_generated_this_month || 0;
    const limit = FREE_TIER_LIMIT;
    const isPro = profile.subscription_status === 'active';

    if (isPro) {
      if (usageText) usageText.textContent = `${used} cards (unlimited)`;
      if (usageBarFill) usageBarFill.style.width = '0%';
      billingActions?.classList.add('hidden');
      proActions?.classList.remove('hidden');
    } else {
      const percentage = Math.min((used / limit) * 100, 100);
      if (usageText) usageText.textContent = `${used} / ${limit} cards`;
      if (usageBarFill) usageBarFill.style.width = `${percentage}%`;
      billingActions?.classList.remove('hidden');
      proActions?.classList.add('hidden');

      // Update bar color based on usage
      usageBarFill?.classList.remove('warning', 'full');
      if (percentage >= 100) {
        usageBarFill?.classList.add('full');
      } else if (percentage >= 75) {
        usageBarFill?.classList.add('warning');
      }
    }
  }
}

/**
 * Load existing settings on page load
 */
async function loadSettings(): Promise<void> {
  try {
    interface StorageResult {
      systemPrompt?: string;
      showPageAnnotations?: boolean;
    }

    const result: StorageResult = await chrome.storage.sync.get([
      'systemPrompt',
      'showPageAnnotations'
    ]);

    // Load system prompt (use default if not set)
    if (systemPromptInput) {
      systemPromptInput.value = result.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    }

    // Load annotations toggle (default to false)
    if (showAnnotationsToggle) {
      showAnnotationsToggle.checked = result.showPageAnnotations === true;
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

/**
 * Reset prompt to default
 */
resetPromptBtn?.addEventListener('click', () => {
  if (systemPromptInput) {
    systemPromptInput.value = DEFAULT_SYSTEM_PROMPT;
  }
  showStatus('Prompt reset to default', 'success');
});

/**
 * Show status message
 */
function showStatus(message: string, type: 'success' | 'error'): void {
  if (!statusEl) return;

  statusEl.textContent = message;
  statusEl.className = `status visible ${type}`;

  setTimeout(() => {
    statusEl.classList.remove('visible');
  }, 3000);
}

/**
 * Handle Google sign in
 */
async function handleSignIn(): Promise<void> {
  if (googleSignInBtn) {
    googleSignInBtn.disabled = true;
    googleSignInBtn.textContent = 'Signing in...';
  }

  try {
    const { user } = await signInWithGoogle();
    _currentUser = user;
    updateUserDisplay(user);
  } catch (error) {
    console.error('Sign in error:', error);
    showStatus('Sign in failed: ' + (error as Error).message, 'error');
  } finally {
    if (googleSignInBtn) {
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
}

/**
 * Handle sign out
 */
async function handleSignOut(): Promise<void> {
  try {
    await signOut();
    _currentUser = null;
    showLoginState();
  } catch (error) {
    console.error('Sign out error:', error);
    showStatus('Sign out failed', 'error');
  }
}

/**
 * Handle upgrade button click - open Stripe Checkout
 */
async function handleUpgrade(): Promise<void> {
  if (upgradeBtn) {
    upgradeBtn.disabled = true;
    upgradeBtn.textContent = 'Loading...';
  }

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
      interface ErrorResponse {
        message?: string;
      }
      const error: ErrorResponse = await response.json();
      throw new Error(error.message || 'Checkout failed');
    }

    interface CheckoutResponse {
      url: string;
    }
    const { url }: CheckoutResponse = await response.json();
    // Open checkout in new tab
    window.open(url, '_blank');
  } catch (error) {
    console.error('Upgrade error:', error);
    showStatus('Failed to start checkout', 'error');
  } finally {
    if (upgradeBtn) {
      upgradeBtn.disabled = false;
      upgradeBtn.textContent = 'Upgrade to Pro';
    }
  }
}

/**
 * Handle manage subscription button click - open Stripe Customer Portal
 */
async function handleManageSubscription(): Promise<void> {
  if (manageSubscriptionBtn) {
    manageSubscriptionBtn.disabled = true;
    manageSubscriptionBtn.textContent = 'Loading...';
  }

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
      interface ErrorResponse {
        message?: string;
      }
      const error: ErrorResponse = await response.json();
      throw new Error(error.message || 'Portal failed');
    }

    interface PortalResponse {
      url: string;
    }
    const { url }: PortalResponse = await response.json();
    // Open portal in new tab
    window.open(url, '_blank');
  } catch (error) {
    console.error('Portal error:', error);
    showStatus('Failed to open subscription portal', 'error');
  } finally {
    if (manageSubscriptionBtn) {
      manageSubscriptionBtn.disabled = false;
      manageSubscriptionBtn.textContent = 'Manage subscription';
    }
  }
}

// Event Listeners
googleSignInBtn?.addEventListener('click', handleSignIn);
signOutBtn?.addEventListener('click', handleSignOut);
upgradeBtn?.addEventListener('click', handleUpgrade);
manageSubscriptionBtn?.addEventListener('click', handleManageSubscription);

// Save annotations toggle immediately when changed
showAnnotationsToggle?.addEventListener('change', async () => {
  try {
    await chrome.storage.sync.set({
      showPageAnnotations: showAnnotationsToggle.checked
    });
    showStatus(showAnnotationsToggle.checked ? 'Annotations enabled' : 'Annotations disabled', 'success');
  } catch (error) {
    console.error('Failed to save annotations setting:', error);
    showStatus('Failed to save setting', 'error');
  }
});

// Save settings
form?.addEventListener('submit', async (e: SubmitEvent) => {
  e.preventDefault();

  const systemPrompt = systemPromptInput?.value.trim() || '';

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
  }

  try {
    await chrome.storage.sync.set({
      systemPrompt: systemPrompt || null
    });
    showStatus('Settings saved!', 'success');
  } catch (error) {
    console.error('Failed to save settings:', error);
    showStatus('Failed to save settings', 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Settings';
    }
  }
});

// Close page button
closePageBtn?.addEventListener('click', () => {
  window.close();
});

/**
 * Initialize the page
 */
async function init(): Promise<void> {
  // Initialize theme
  await initializeTheme();

  // Check for existing session
  const { user } = await getSession();

  if (user) {
    _currentUser = user;
    updateUserDisplay(user);
    loadSettings();
  } else {
    showLoginState();
  }

  // Listen for auth state changes
  onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      _currentUser = session.user;
      updateUserDisplay(session.user);
      loadSettings();
    } else if (event === 'SIGNED_OUT') {
      _currentUser = null;
      showLoginState();
    }
  });
}

// Initialize
init();
