// Pluckk - Options Page Script

import { DEFAULT_SYSTEM_PROMPT } from '@pluckk/shared/constants';
import { initializeTheme } from '../src/theme';

// DOM Elements

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

// Detect platform for shortcut display
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
if (shortcutDisplay) {
  shortcutDisplay.textContent = isMac ? 'Cmd+Shift+M' : 'Ctrl+Shift+M';
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





// Event Listeners

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
  await initializeTheme();
  loadSettings();
}

// Initialize
init();
