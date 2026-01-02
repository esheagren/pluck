// Pluckk - Options Page Script

(function() {
  'use strict';

  // Claude settings elements
  const apiKeyInput = document.getElementById('api-key');
  const toggleBtn = document.getElementById('toggle-visibility');
  const form = document.getElementById('settings-form');
  const saveBtn = document.getElementById('save-btn');
  const statusEl = document.getElementById('status');
  const shortcutDisplay = document.getElementById('shortcut-display');
  const closePageBtn = document.getElementById('close-page-btn');

  // Mochi settings elements
  const mochiApiKeyInput = document.getElementById('mochi-api-key');
  const mochiDeckSelect = document.getElementById('mochi-deck');
  const fetchDecksBtn = document.getElementById('fetch-decks-btn');

  // Detect platform for shortcut display
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  shortcutDisplay.textContent = isMac ? 'Cmd+Shift+M' : 'Ctrl+Shift+M';

  // Load existing settings on page load
  async function loadSettings() {
    try {
      const result = await chrome.storage.sync.get(['apiKey', 'mochiApiKey', 'mochiDeckId', 'mochiDecks']);

      if (result.apiKey) {
        apiKeyInput.value = result.apiKey;
      }

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

  // Populate deck dropdown
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

  // Fetch decks from Mochi API
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

  // Toggle password visibility
  toggleBtn.addEventListener('click', () => {
    const isPassword = apiKeyInput.type === 'password';
    apiKeyInput.type = isPassword ? 'text' : 'password';

    toggleBtn.innerHTML = isPassword
      ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
           <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
           <line x1="1" y1="1" x2="23" y2="23"></line>
         </svg>`
      : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
           <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
           <circle cx="12" cy="12" r="3"></circle>
         </svg>`;
  });

  // Show status message
  function showStatus(message, type) {
    statusEl.textContent = message;
    statusEl.className = `status visible ${type}`;

    setTimeout(() => {
      statusEl.classList.remove('visible');
    }, 3000);
  }

  // Fetch decks button
  fetchDecksBtn.addEventListener('click', fetchDecks);

  // Save settings
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const apiKey = apiKeyInput.value.trim();
    const mochiApiKey = mochiApiKeyInput.value.trim();
    const mochiDeckId = mochiDeckSelect.value;

    if (!apiKey) {
      showStatus('Please enter Claude API key', 'error');
      return;
    }

    // Basic validation for Claude API key
    if (!apiKey.startsWith('sk-')) {
      showStatus('Claude API key should start with sk-', 'error');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      await chrome.storage.sync.set({
        apiKey,
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

  // Initialize
  loadSettings();

})();
