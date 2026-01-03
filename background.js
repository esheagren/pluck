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
const GEMINI_IMAGE_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

const DEFAULT_SYSTEM_PROMPT = `You are a spaced repetition prompt generator. Your goal is to create prompts that produce durable understanding through retrieval practice—not just surface-level memorization.

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

/**
 * Get system prompt from storage (or use default)
 */
async function getSystemPrompt() {
  const result = await chrome.storage.sync.get(['systemPrompt']);
  return result.systemPrompt || DEFAULT_SYSTEM_PROMPT;
}

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
 * @param {Object} selectionData - Selection data from content script
 * @param {string} apiKey - Claude API key
 * @param {string} focusText - Optional focus/guidance for card generation
 */
async function generateCards(selectionData, apiKey, focusText = '') {
  const systemPrompt = await getSystemPrompt();

  let userMessage = `**Selection:** ${selectionData.selection}

**Context:** ${selectionData.context}

**Source URL:** ${selectionData.url}
**Page Title:** ${selectionData.title}

Generate 2-3 spaced repetition cards for the highlighted selection.`;

  // Append focus guidance if provided
  if (focusText) {
    userMessage += `\n\n**Focus:** Please focus the cards on: ${focusText}`;
  }

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
      system: systemPrompt,
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
 * @param {number} tabId - The active tab ID
 * @param {string} focusText - Optional focus/guidance for card generation
 */
async function handleGenerateCards(tabId, focusText = '') {
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
    const cards = await generateCards(selectionData, apiKey, focusText);
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
 * Get Gemini API key from storage
 */
async function getGeminiApiKey() {
  const result = await chrome.storage.sync.get(['geminiApiKey']);
  return result.geminiApiKey || null;
}

/**
 * Generate an image using Gemini based on the card content
 */
async function generateImageWithGemini(question, answer, geminiApiKey) {
  const prompt = `Create a simple, clean, minimalist educational illustration for a flashcard about: ${question} - ${answer}. Style: flat design, iconic, memorable, no text in the image.`;

  // Model for image generation (from Google AI docs)
  const model = 'gemini-2.5-flash-image';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;

  console.log(`[Pluckk] Generating image with ${model}...`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Pluckk] Image generation failed:`, response.status, errorText);
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  console.log(`[Pluckk] Response received, checking for image...`);

  // Extract image data from response
  const candidate = data.candidates?.[0];
  if (candidate?.content?.parts) {
    for (const part of candidate.content.parts) {
      if (part.inlineData?.data) {
        console.log(`[Pluckk] Image generated successfully!`);
        return {
          data: part.inlineData.data,
          mimeType: part.inlineData.mimeType || 'image/png'
        };
      }
    }
  }

  throw new Error('No image in response');
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Upload an image attachment to a Mochi card
 * Includes retry logic with exponential backoff for rate limiting
 */
async function uploadMochiAttachment(cardId, imageData, mimeType, mochiApiKey, maxRetries = 5) {
  // Determine file extension from mime type
  const ext = mimeType.includes('png') ? 'png' : 'jpg';
  // Mochi requires filename to match /[0-9a-zA-Z]{4,16}/ (no hyphens, 4-16 alphanumeric chars)
  const randomId = Math.random().toString(36).substring(2, 10);
  const filename = `img${randomId}.${ext}`;

  // Convert base64 to blob
  const byteCharacters = atob(imageData);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });

  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 1s, 2s, 4s, 8s, 16s
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`[Pluckk] Rate limited on upload, waiting ${delay}ms before retry ${attempt + 1}/${maxRetries}`);
      await sleep(delay);
    }

    // Mochi requires multipart/form-data with a 'file' field
    const formData = new FormData();
    formData.append('file', blob, filename);

    const response = await fetch(`${MOCHI_API_URL}/cards/${cardId}/attachments/${filename}`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(mochiApiKey + ':')
        // Don't set Content-Type - browser will set it with boundary for FormData
      },
      body: formData
    });

    if (response.ok) {
      // Mochi may return empty body on success - handle gracefully
      const responseText = await response.text();
      if (responseText) {
        const result = JSON.parse(responseText);
        result.filename = filename;
        return result;
      }
      return { success: true, filename };
    }

    if (response.status === 429) {
      // Rate limited - will retry
      const errorText = await response.text();
      console.log('[Pluckk] Mochi upload rate limit hit:', errorText);
      lastError = new Error(`Mochi upload rate limit (attempt ${attempt + 1})`);
      continue;
    }

    // Non-retryable error
    const errorText = await response.text();
    console.error('Mochi attachment upload error:', response.status, errorText);
    throw new Error(`Mochi attachment error (${response.status})`);
  }

  throw lastError || new Error('Max retries exceeded for upload');
}

/**
 * Update a Mochi card's content to include an image reference
 * Includes retry logic with exponential backoff for rate limiting
 */
async function updateMochiCardContent(cardId, newContent, mochiApiKey, maxRetries = 5) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 1s, 2s, 4s, 8s, 16s
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`[Pluckk] Rate limited, waiting ${delay}ms before retry ${attempt + 1}/${maxRetries}`);
      await sleep(delay);
    }

    const response = await fetch(`${MOCHI_API_URL}/cards/${cardId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + btoa(mochiApiKey + ':')
      },
      body: JSON.stringify({
        'content': newContent
      })
    });

    if (response.ok) {
      return await response.json();
    }

    if (response.status === 429) {
      // Rate limited - will retry
      const errorText = await response.text();
      console.log('[Pluckk] Mochi rate limit hit:', errorText);
      lastError = new Error(`Mochi rate limit (attempt ${attempt + 1})`);
      continue;
    }

    // Non-retryable error
    const errorText = await response.text();
    console.error('Mochi card update error:', response.status, errorText);
    throw new Error(`Mochi update error (${response.status})`);
  }

  throw lastError || new Error('Max retries exceeded');
}

// Track pending image generation tasks to keep service worker alive
const pendingTasks = new Set();
const KEEP_ALIVE_ALARM = 'pluckk-keep-alive';

/**
 * Keep service worker alive while tasks are pending
 * Uses chrome.alarms which properly extends service worker lifetime
 */
async function startKeepAlive() {
  console.log('[Pluckk] Starting keep-alive alarm');
  await chrome.alarms.create(KEEP_ALIVE_ALARM, { periodInMinutes: 0.5 }); // Every 30 seconds
}

async function stopKeepAlive() {
  console.log('[Pluckk] Stopping keep-alive alarm');
  await chrome.alarms.clear(KEEP_ALIVE_ALARM);
}

// Listen for alarms to keep service worker active
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEP_ALIVE_ALARM) {
    console.log('[Pluckk] Keep-alive ping, pending tasks:', pendingTasks.size);
    if (pendingTasks.size === 0) {
      stopKeepAlive();
    }
  }
});

/**
 * Background task to generate and attach image to a Mochi card
 * This runs asynchronously after the card is created (fire-and-forget)
 */
async function generateAndAttachImage(cardId, question, answer, sourceUrl) {
  const taskId = `${cardId}-${Date.now()}`;
  pendingTasks.add(taskId);

  // Start keep-alive mechanism to prevent service worker termination
  startKeepAlive();

  try {
    console.log('[Pluckk] Starting image generation task:', taskId);

    const geminiApiKey = await getGeminiApiKey();
    if (!geminiApiKey) {
      console.log('[Pluckk] No Gemini API key configured, skipping image generation');
      return;
    }
    console.log('[Pluckk] Gemini API key found, starting image generation...');

    const mochiSettings = await getMochiSettings();
    if (!mochiSettings.apiKey) {
      console.log('[Pluckk] No Mochi API key, cannot attach image');
      return;
    }

    console.log('[Pluckk] Generating image for card:', cardId, 'Question:', question.substring(0, 50));
    console.log('[Pluckk] Calling Gemini API...');
    const imageResult = await generateImageWithGemini(question, answer, geminiApiKey);
    console.log('[Pluckk] Image generated successfully, mimeType:', imageResult.mimeType, 'size:', imageResult.data.length);

    console.log('[Pluckk] Uploading image to Mochi card:', cardId);
    const uploadResult = await uploadMochiAttachment(cardId, imageResult.data, imageResult.mimeType, mochiSettings.apiKey);
    const filename = uploadResult.filename;
    console.log('[Pluckk] Image attached successfully:', filename);

    // Update card content to display the image inline
    let newContent = `${question}\n---\n${answer}\n\n![](@media/${filename})`;
    if (sourceUrl) {
      newContent += `\n\n---\nSource: ${sourceUrl}`;
    }

    console.log('[Pluckk] Updating card to display image inline...');
    await updateMochiCardContent(cardId, newContent, mochiSettings.apiKey);
    console.log('[Pluckk] Card updated with inline image!');
  } catch (error) {
    // Log error but don't throw - this is fire-and-forget
    console.error('[Pluckk] Failed to generate/attach image:', error.message, error);
  } finally {
    pendingTasks.delete(taskId);
    console.log('[Pluckk] Task completed:', taskId, 'Remaining tasks:', pendingTasks.size);
    if (pendingTasks.size === 0) {
      stopKeepAlive();
    }
  }
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
  let content = `${question}\n---\n${answer}`;
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

    // Fire-and-forget: trigger background image generation
    // Don't await - let it run asynchronously so user doesn't experience latency
    generateAndAttachImage(card.id, question, answer, sourceUrl);

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

      const result = await handleGenerateCards(tabs[0].id, request.focusText || '');
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
