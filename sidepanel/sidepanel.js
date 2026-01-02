// Pluck - Side Panel Script
// Main UI logic for card generation and Mochi integration

(function() {
  'use strict';

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
  const refreshBtn = document.getElementById('refresh-btn');
  const regenerateBtn = document.getElementById('regenerate-btn');
  const settingsBtn = document.getElementById('settings-btn');
  const openSettingsBtn = document.getElementById('open-settings-btn');
  const selectAllBtn = document.getElementById('select-all-btn');
  const selectedCountEl = document.getElementById('selected-count');
  const totalCountEl = document.getElementById('total-count');

  // State
  let cards = [];
  let selectedIndices = new Set(); // Multi-select support
  let sourceUrl = '';
  let editedCards = {};
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
   * Update selection count display
   */
  function updateSelectionCount() {
    const count = selectedIndices.size;
    selectedCountEl.textContent = count;
    totalCountEl.textContent = cards.length;

    // Update button states
    const hasSelection = count > 0;
    copyBtn.disabled = !hasSelection;
    if (mochiConfigured) {
      mochiBtn.disabled = !hasSelection;
    }

    // Update select all button text
    if (count === cards.length) {
      selectAllBtn.textContent = 'Deselect All';
    } else {
      selectAllBtn.textContent = 'Select All';
    }

    // Update button text with count
    if (hasSelection && count > 1) {
      mochiBtn.querySelector('.btn-text').textContent = `Send ${count} to Mochi`;
      copyBtn.querySelector('.btn-text').textContent = `Copy ${count}`;
    } else {
      mochiBtn.querySelector('.btn-text').textContent = 'Send to Mochi';
      copyBtn.querySelector('.btn-text').textContent = 'Copy';
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
        <div class="card-header">
          <div class="card-checkbox"></div>
          <span class="card-style ${card.style}">${formatStyleLabel(card.style)}</span>
        </div>
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

    // Update source info
    if (sourceUrl) {
      const displayUrl = sourceUrl.length > 60
        ? sourceUrl.substring(0, 60) + '...'
        : sourceUrl;
      sourceInfo.innerHTML = `Source: <a href="${escapeHtml(sourceUrl)}" target="_blank">${escapeHtml(displayUrl)}</a>`;
    }

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
   * Select or deselect all cards
   */
  function toggleSelectAll() {
    if (selectedIndices.size === cards.length) {
      // Deselect all
      selectedIndices.clear();
    } else {
      // Select all
      cards.forEach((_, index) => selectedIndices.add(index));
    }

    // Update UI
    document.querySelectorAll('.card-item').forEach((el, i) => {
      el.classList.toggle('selected', selectedIndices.has(i));
    });

    updateSelectionCount();
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
   * Escape HTML for safe rendering
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
   * Copy selected cards to clipboard
   */
  async function copyToClipboard() {
    const selectedCards = getSelectedCards();
    if (selectedCards.length === 0) return;

    // Format all selected cards
    const markdown = selectedCards.map(card =>
      window.MochiFormat.formatForMochi(card.question, card.answer, sourceUrl)
    ).join('\n\n---\n\n');

    try {
      await navigator.clipboard.writeText(markdown);

      copyBtn.classList.add('btn-success');
      copyBtn.classList.remove('btn-secondary');
      copyBtn.querySelector('.btn-text').textContent = 'Copied!';

      setTimeout(() => {
        copyBtn.classList.remove('btn-success');
        copyBtn.classList.add('btn-secondary');
        updateSelectionCount(); // Restore button text
      }, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      showError('Failed to copy to clipboard');
    }
  }

  /**
   * Send selected cards to Mochi (one at a time due to rate limiting)
   */
  async function sendToMochi() {
    const selectedCards = getSelectedCards();
    if (selectedCards.length === 0) return;

    mochiBtn.disabled = true;
    const totalCards = selectedCards.length;
    let sentCount = 0;
    let errors = [];

    mochiBtn.querySelector('.btn-text').textContent = `Sending 0/${totalCards}...`;

    for (const card of selectedCards) {
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'sendToMochi',
          question: card.question,
          answer: card.answer,
          sourceUrl: sourceUrl
        });

        if (response.error) {
          errors.push(response.error);
        } else {
          sentCount++;
        }

        mochiBtn.querySelector('.btn-text').textContent = `Sending ${sentCount}/${totalCards}...`;

        // Small delay between requests to respect rate limiting
        if (selectedCards.indexOf(card) < selectedCards.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } catch (error) {
        errors.push(error.message);
      }
    }

    if (errors.length > 0 && sentCount === 0) {
      // All failed
      let errorMsg = 'Failed to send to Mochi';
      if (errors[0] === 'mochi_api_key_missing') {
        errorMsg = 'Mochi API key not configured';
      } else if (errors[0] === 'mochi_deck_not_selected') {
        errorMsg = 'No Mochi deck selected';
      }
      showError(errorMsg);
      mochiBtn.disabled = false;
      updateSelectionCount();
      return;
    }

    // Show success
    mochiBtn.classList.add('btn-success');
    mochiBtn.classList.remove('btn-mochi');

    if (errors.length > 0) {
      mochiBtn.querySelector('.btn-text').textContent = `Sent ${sentCount}/${totalCards}`;
    } else {
      mochiBtn.querySelector('.btn-text').textContent = `Sent ${sentCount}!`;
    }

    setTimeout(() => {
      mochiBtn.classList.remove('btn-success');
      mochiBtn.classList.add('btn-mochi');
      mochiBtn.disabled = false;
      updateSelectionCount();
    }, 2000);
  }

  /**
   * Generate cards by calling background script
   */
  async function generateCards() {
    showState(loadingState);
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

      cards = response.cards;
      sourceUrl = response.source?.url || '';
      selectedIndices = new Set();
      editedCards = {};

      // Auto-select all cards by default
      cards.forEach((_, index) => selectedIndices.add(index));

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
  refreshBtn.addEventListener('click', generateCards);
  regenerateBtn.addEventListener('click', generateCards);
  settingsBtn.addEventListener('click', openSettings);
  openSettingsBtn.addEventListener('click', openSettings);
  selectAllBtn.addEventListener('click', toggleSelectAll);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Number keys 1-3 to toggle cards
    if (e.key >= '1' && e.key <= '3' && !e.target.isContentEditable) {
      const index = parseInt(e.key) - 1;
      if (index < cards.length) {
        toggleCard(index);
      }
    }

    // A to select/deselect all
    if (e.key === 'a' && !e.target.isContentEditable) {
      toggleSelectAll();
    }

    // Enter to send to Mochi (if configured) or copy
    if (e.key === 'Enter' && !e.target.isContentEditable && selectedIndices.size > 0) {
      if (mochiConfigured) {
        sendToMochi();
      } else {
        copyToClipboard();
      }
    }

    // R to regenerate
    if (e.key === 'r' && !e.target.isContentEditable) {
      generateCards();
    }
  });

  // Start generation on panel open
  generateCards();

})();
