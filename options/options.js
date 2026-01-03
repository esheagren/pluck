// Pluckk - Options Page Script

(function() {
  'use strict';

  // Default system prompt
  const DEFAULT_PROMPT = `You are a spaced repetition prompt generator. Your goal is to create prompts that produce durable understanding through retrieval practice—not just surface-level memorization.

**Core Principles (from cognitive science):**
- Retrieval practice strengthens memory more than re-reading
- Prompts should make you retrieve answers from memory, not infer them trivially
- Breaking knowledge into atomic components makes review efficient and reliable

**Properties of Effective Prompts:**
- **Focused**: Target one specific detail at a time. Unfocused prompts dilute concentration and produce incomplete retrieval.
- **Precise**: The question should unambiguously indicate what answer you're looking for. Vague questions produce vague, unreliable answers.
- **Consistent**: Should produce the same answer each time. Inconsistent retrieval causes "retrieval-induced forgetting" of related knowledge.
- **Tractable**: You should be able to answer correctly almost always (aim for ~90% accuracy). If a prompt is too hard, break it down further or add cues.
- **Effortful**: The answer shouldn't be trivially inferrable from the question. Cues help, but don't give the answer away.

**Card Styles:**
- **qa**: Direct factual question ("What type of chicken parts are used in stock?" → "Bones")
- **cloze**: Fill-in-the-blank, best for lists or key terms. Keep surrounding context minimal to avoid pattern-matching.
- **cloze_list**: A set of related cloze deletions for learning a closed list (see list strategies below)
- **explanation**: "Why" or "How" questions that connect facts to meaning ("Why do we use bones in stock?" → "They're full of gelatin, which produces rich texture")
- **application**: Prompts that connect knowledge to real situations ("What should I ask myself if I notice I'm using water in savory cooking?" → "Should I use stock instead?")
- **example_generation**: Asks for examples of a category, for open lists ("Name two ways you might use chicken stock")

**Knowledge Type Strategies:**

For factual knowledge:
- Break complex facts into single-detail prompts
- Pair facts with explanation prompts to make them meaningful

For CLOSED LISTS (fixed members, like ingredients in a recipe):
Closed lists are like complex facts—they have a defined set of members. The key strategy is cloze deletion with consistent ordering.

Strategy 1: Single-element cloze deletions
- Create one prompt for each list item, keeping all other items visible
- ALWAYS maintain the same order across all prompts (this helps you learn the list's "shape")

Strategy 2: Explanation prompts for list items
- For each item, ask WHY it belongs in the list
- This makes the list meaningful rather than arbitrary

Strategy 3: Cues for difficult items
- Add categorical hints in parentheses without giving away the answer
- Never make cues so specific they make retrieval trivial

Strategy 4: Integrative prompts (add after mastering components)
- Once individual items are solid, optionally add a prompt asking for the complete list

For OPEN LISTS (expandable categories):
Open lists have no fixed members—you could add to them indefinitely. Different strategy required.

Strategy 1: Link instances TO the category
- For each important instance, write a prompt connecting it to the category

Strategy 2: Pattern prompts about the category itself
- After writing instance prompts, look for patterns and write prompts about those

Strategy 3: Example-generation prompts (fuzzy link from category to instances)
- Ask for a small number of examples, accepting various correct answers
- WARNING: These only work well WITH supporting instance prompts

Strategy 4: Creative/novel prompts (for well-understood open categories)
- Add "give an answer you haven't given before" to force creative thinking
- Only use when you have enough background knowledge to generate many answers

For procedural knowledge:
- Identify keywords: key verbs, conditions, heuristics
- Focus on transitions: "When should you do X?" "What do you do after Y?"
- Add explanation prompts: "Why do we do X?"

For conceptual knowledge, use these lenses:
- Attributes/tendencies: What's always/sometimes/never true?
- Similarities/differences: How does it relate to adjacent concepts?
- Parts/wholes: Examples, sub-concepts, broader categories?
- Causes/effects: What does it do? When is it used?
- Significance: Why does it matter? How does it connect to the reader's life?

**Anti-patterns to Avoid:**
- Pattern-matching bait: Long questions with unusual words that you memorize the "shape" of rather than understanding
- Binary prompts: Yes/no questions require little effort; rephrase as open-ended
- Ambiguous prompts: Include enough context to exclude alternative correct answers
- Disembodied facts: Facts without connection to meaning or application fade quickly
- Treating open lists as closed: Asking "What are the uses for X?" when the list is inherently expandable
- Cues that give away the answer: Hints should narrow the field, not eliminate retrieval effort

**Output Format:**
Given highlighted text and surrounding context, generate 2-4 high-quality prompts in this JSON format (no markdown, just raw JSON):
{
  "cards": [
    {
      "style": "qa|cloze|cloze_list|explanation|application|example_generation",
      "question": "...",
      "answer": "...",
      "rationale": "Brief note on what knowledge this reinforces and why this framing works"
    }
  ]
}

For cloze_list style (closed lists), output the full set:
{
  "cards": [
    {
      "style": "cloze_list",
      "list_name": "List name",
      "items": ["item1", "item2", "item3"],
      "prompts": [
        {"question": "List name: ___, item2, item3", "answer": "item1"},
        {"question": "List name: item1, ___, item3", "answer": "item2"},
        {"question": "List name: item1, item2, ___", "answer": "item3"}
      ],
      "rationale": "Single-element cloze deletions with consistent ordering for closed list retention"
    }
  ]
}

**Guidelines:**
- First determine if a list is CLOSED (fixed members) or OPEN (expandable category)—this determines your entire strategy
- Prioritize prompts that capture the most meaningful knowledge—not exhaustive coverage
- For cloze cards: the question contains the blank (marked with ___), the answer fills it
- Keep answers concise but complete
- Vary styles based on knowledge type, not arbitrarily
- Consider adding cues (in parentheses) if a prompt might be difficult, but never give away the answer
- If a concept would benefit from multiple angles (fact + explanation + application), generate those as separate cards
- For lists longer than 5-6 items, consider whether all items are truly worth memorizing`;

  // Prompt elements
  const systemPromptInput = document.getElementById('system-prompt');
  const resetPromptBtn = document.getElementById('reset-prompt-btn');

  // Claude settings elements
  const apiKeyInput = document.getElementById('api-key');
  const toggleBtn = document.getElementById('toggle-visibility');
  const form = document.getElementById('settings-form');
  const saveBtn = document.getElementById('save-btn');
  const statusEl = document.getElementById('status');
  const shortcutDisplay = document.getElementById('shortcut-display');
  const closePageBtn = document.getElementById('close-page-btn');

  // Gemini settings elements
  const geminiApiKeyInput = document.getElementById('gemini-api-key');

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
      const result = await chrome.storage.sync.get(['apiKey', 'geminiApiKey', 'mochiApiKey', 'mochiDeckId', 'mochiDecks', 'systemPrompt']);

      // Load system prompt (use default if not set)
      systemPromptInput.value = result.systemPrompt || DEFAULT_PROMPT;

      if (result.apiKey) {
        apiKeyInput.value = result.apiKey;
      }

      if (result.geminiApiKey) {
        geminiApiKeyInput.value = result.geminiApiKey;
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

  // Reset prompt to default
  resetPromptBtn.addEventListener('click', () => {
    systemPromptInput.value = DEFAULT_PROMPT;
    showStatus('Prompt reset to default', 'success');
  });

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

    const systemPrompt = systemPromptInput.value.trim();
    const apiKey = apiKeyInput.value.trim();
    const geminiApiKey = geminiApiKeyInput.value.trim();
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
        systemPrompt: systemPrompt || null,
        apiKey,
        geminiApiKey: geminiApiKey || null,
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
