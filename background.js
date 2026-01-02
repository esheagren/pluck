// Pluckk - Background Service Worker
// Handles Claude API calls, Mochi integration, and message routing

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Enable side panel to be opened
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const MOCHI_API_URL = 'https://app.mochi.cards/api';

const SYSTEM_PROMPT = `You are a spaced repetition card generator. Given highlighted text and its surrounding context from a webpage, generate 2-3 high-quality flashcard options.

**Card Requirements:**
- Atomic: One concept per card
- Clear: Unambiguous question with definite answer
- Testable: Reader should be able to verify their answer
- Context-independent: Card should make sense without the source

**Output 2-3 cards in this exact JSON format (no markdown, just raw JSON):**
{
  "cards": [
    {
      "style": "qa",
      "question": "...",
      "answer": "..."
    }
  ]
}

**Card Styles:**
- qa: Direct question and answer (e.g., "What is X?" / "X is...")
- cloze: Fill-in-the-blank style (e.g., "The process of ___ allows..." / "photosynthesis")
- conceptual: "Why" or "How" questions testing deeper understanding

**Guidelines:**
- Focus on the key concept in the highlighted text
- Make questions specific and unambiguous
- Keep answers concise but complete
- Vary the card styles when appropriate
- For cloze cards, the question contains the blank, the answer is what fills it`;

/**
 * Get API key from storage
 */
async function getApiKey() {
  const result = await chrome.storage.sync.get(['apiKey']);
  return result.apiKey || null;
}

/**
 * Get selection data from the active tab's content script
 */
async function getSelectionFromTab(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { action: 'getSelection' });
    return response;
  } catch (error) {
    console.error('Failed to get selection:', error);
    return null;
  }
}

/**
 * Call Claude API to generate cards
 */
async function generateCards(selectionData, apiKey) {
  const userMessage = `**Selection:** ${selectionData.selection}

**Context:** ${selectionData.context}

**Source URL:** ${selectionData.url}
**Page Title:** ${selectionData.title}

Generate 2-3 spaced repetition cards for the highlighted selection.`;

  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userMessage
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Claude API error:', response.status, errorText);
    throw new Error(`API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  // Extract the text content from Claude's response
  const content = data.content?.[0]?.text;
  if (!content) {
    throw new Error('Empty response from Claude');
  }

  // Parse the JSON from the response
  // Handle potential markdown code blocks
  let jsonStr = content.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const parsed = JSON.parse(jsonStr);

  if (!parsed.cards || !Array.isArray(parsed.cards)) {
    throw new Error('Invalid response format: missing cards array');
  }

  return parsed.cards;
}

/**
 * Main handler for card generation requests
 */
async function handleGenerateCards(tabId) {
  // Get API key
  const apiKey = await getApiKey();
  if (!apiKey) {
    return { error: 'api_key_missing' };
  }

  // Get selection from content script
  const selectionData = await getSelectionFromTab(tabId);
  if (!selectionData) {
    return { error: 'content_script_error', message: 'Could not communicate with page' };
  }

  if (!selectionData.selection) {
    return { error: 'no_selection' };
  }

  // Generate cards
  try {
    const cards = await generateCards(selectionData, apiKey);
    return {
      cards,
      source: {
        url: selectionData.url,
        title: selectionData.title
      }
    };
  } catch (error) {
    console.error('Card generation failed:', error);

    if (error.message.includes('401')) {
      return { error: 'api_key_invalid' };
    }

    if (error.message.includes('429')) {
      return { error: 'rate_limit' };
    }

    if (error instanceof SyntaxError) {
      return { error: 'parse_error', message: 'Failed to parse Claude response' };
    }

    return { error: 'api_error', message: error.message };
  }
}

/**
 * Get Mochi settings from storage
 */
async function getMochiSettings() {
  const result = await chrome.storage.sync.get(['mochiApiKey', 'mochiDeckId']);
  return {
    apiKey: result.mochiApiKey || null,
    deckId: result.mochiDeckId || null
  };
}

/**
 * Create a card in Mochi
 */
async function createMochiCard(question, answer, sourceUrl) {
  const settings = await getMochiSettings();

  if (!settings.apiKey) {
    return { error: 'mochi_api_key_missing' };
  }

  if (!settings.deckId) {
    return { error: 'mochi_deck_not_selected' };
  }

  // Format content for Mochi (question on front, answer on back)
  let content = `# ${question}\n---\n${answer}`;
  if (sourceUrl) {
    content += `\n\n---\nSource: ${sourceUrl}`;
  }

  try {
    const response = await fetch(`${MOCHI_API_URL}/cards/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + btoa(settings.apiKey + ':')
      },
      body: JSON.stringify({
        'content': content,
        'deck-id': settings.deckId
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mochi API error:', response.status, errorText);
      throw new Error(`Mochi API error (${response.status}): ${errorText}`);
    }

    const card = await response.json();
    return { success: true, cardId: card.id };
  } catch (error) {
    console.error('Failed to create Mochi card:', error);
    return { error: 'mochi_api_error', message: error.message };
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'generateCards') {
    // Get the active tab and generate cards
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs[0]) {
        sendResponse({ error: 'no_active_tab' });
        return;
      }

      const result = await handleGenerateCards(tabs[0].id);
      sendResponse(result);
    });

    return true; // Keep message channel open for async response
  }

  if (request.action === 'sendToMochi') {
    createMochiCard(request.question, request.answer, request.sourceUrl)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: 'mochi_error', message: error.message }));

    return true; // Keep message channel open for async response
  }

  if (request.action === 'getMochiStatus') {
    getMochiSettings()
      .then(settings => {
        sendResponse({
          configured: !!(settings.apiKey && settings.deckId)
        });
      });

    return true;
  }
});
