// Pluckk - Background Service Worker
// Handles API calls via backend proxy, Mochi integration, and message routing

import { createSupabaseClient } from '@pluckk/shared/supabase';
import {
  BACKEND_URL,
  MOCHI_API_URL,
  DEFAULT_SYSTEM_PROMPT
} from '@pluckk/shared/constants';
import { sleep } from '@pluckk/shared/utils';
import { getSession, getAccessToken } from './auth.js';

// Initialize Supabase client
const supabase = createSupabaseClient({
  onError: (msg, err) => console.error('[Pluckk]', msg, err)
});

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Enable side panel to be opened
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

/**
 * Get system prompt from storage (or use default)
 */
async function getSystemPrompt() {
  const result = await chrome.storage.sync.get(['systemPrompt']);
  return result.systemPrompt || DEFAULT_SYSTEM_PROMPT;
}

/**
 * Check if user is authenticated
 */
async function checkAuth() {
  const { session } = await getSession();
  return !!session;
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
 * Call backend API to generate cards
 * @param {Object} selectionData - Selection data from content script
 * @param {string} focusText - Optional focus/guidance for card generation
 */
async function generateCards(selectionData, focusText = '') {
  const systemPrompt = await getSystemPrompt();
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error('not_authenticated');
  }

  const response = await fetch(`${BACKEND_URL}/api/generate-cards`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      selection: selectionData.selection,
      context: selectionData.context,
      url: selectionData.url,
      title: selectionData.title,
      focusText: focusText || undefined,
      systemPrompt: systemPrompt !== DEFAULT_SYSTEM_PROMPT ? systemPrompt : undefined
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));

    if (response.status === 401) {
      throw new Error('not_authenticated');
    }

    if (response.status === 402) {
      throw new Error('usage_limit_reached');
    }

    console.error('Backend API error:', response.status, errorData);
    throw new Error(`API error (${response.status}): ${errorData.error || 'Unknown error'}`);
  }

  const data = await response.json();

  if (!data.cards || !Array.isArray(data.cards)) {
    throw new Error('Invalid response format: missing cards array');
  }

  return data.cards;
}

/**
 * Main handler for card generation requests
 * @param {number} tabId - The active tab ID
 * @param {string} focusText - Optional focus/guidance for card generation
 * @param {Object} cachedSelection - Optional cached selection data from previous generation
 */
async function handleGenerateCards(tabId, focusText = '', cachedSelection = null) {
  // Check authentication
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) {
    return { error: 'not_authenticated' };
  }

  // Use cached selection if provided, otherwise get from content script
  let selectionData;
  if (cachedSelection && cachedSelection.selection) {
    selectionData = cachedSelection;
  } else {
    selectionData = await getSelectionFromTab(tabId);
    if (!selectionData) {
      return { error: 'content_script_error', message: 'Could not communicate with page' };
    }

    if (!selectionData.selection) {
      return { error: 'no_selection' };
    }
  }

  // Generate cards
  try {
    const cards = await generateCards(selectionData, focusText);
    return {
      cards,
      source: {
        url: selectionData.url,
        title: selectionData.title
      },
      // Return selection data so sidepanel can cache it
      selectionData: selectionData
    };
  } catch (error) {
    console.error('Card generation failed:', error);

    if (error.message === 'not_authenticated') {
      return { error: 'not_authenticated' };
    }

    if (error.message === 'usage_limit_reached') {
      return { error: 'usage_limit_reached' };
    }

    if (error.message.includes('429')) {
      return { error: 'rate_limit' };
    }

    if (error instanceof SyntaxError) {
      return { error: 'parse_error', message: 'Failed to parse response' };
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
 * Generate an image using backend Gemini proxy based on the card content
 */
async function generateImageWithBackend(question, answer) {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error('not_authenticated');
  }

  console.log(`[Pluckk] Generating image via backend...`);

  const response = await fetch(`${BACKEND_URL}/api/generate-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      question,
      answer
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error(`[Pluckk] Image generation failed:`, response.status, errorData);
    throw new Error(`Image API error (${response.status}): ${errorData.error || 'Unknown error'}`);
  }

  const data = await response.json();
  console.log(`[Pluckk] Image generated successfully!`);

  return {
    data: data.imageData,
    mimeType: data.mimeType || 'image/png'
  };
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
 * Background task to generate and attach image to a Mochi card (and optionally Supabase)
 * This runs asynchronously after the card is created (fire-and-forget)
 */
async function generateAndAttachImage(mochiCardId, question, answer, sourceUrl, supabaseCardId = null) {
  const taskId = `${mochiCardId}-${Date.now()}`;
  pendingTasks.add(taskId);

  // Start keep-alive mechanism to prevent service worker termination
  startKeepAlive();

  try {
    console.log('[Pluckk] Starting image generation task:', taskId);

    // Check if user is authenticated (required for backend image generation)
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) {
      console.log('[Pluckk] User not authenticated, skipping image generation');
      return;
    }

    const mochiSettings = await getMochiSettings();
    if (!mochiSettings.apiKey) {
      console.log('[Pluckk] No Mochi API key, cannot attach image');
      return;
    }

    console.log('[Pluckk] Generating image for card:', mochiCardId, 'Question:', question.substring(0, 50));
    console.log('[Pluckk] Calling backend image API...');
    const imageResult = await generateImageWithBackend(question, answer);
    console.log('[Pluckk] Image generated successfully, mimeType:', imageResult.mimeType, 'size:', imageResult.data.length);

    // Upload to Mochi
    console.log('[Pluckk] Uploading image to Mochi card:', mochiCardId);
    const uploadResult = await uploadMochiAttachment(mochiCardId, imageResult.data, imageResult.mimeType, mochiSettings.apiKey);
    const filename = uploadResult.filename;
    console.log('[Pluckk] Image attached to Mochi successfully:', filename);

    // Update Mochi card content to display the image inline
    let newContent = `${question}\n---\n${answer}\n\n![](@media/${filename})`;
    if (sourceUrl) {
      newContent += `\n\n---\nSource: ${sourceUrl}`;
    }

    console.log('[Pluckk] Updating Mochi card to display image inline...');
    await updateMochiCardContent(mochiCardId, newContent, mochiSettings.apiKey);
    console.log('[Pluckk] Mochi card updated with inline image!');

    // Upload to Supabase Storage if we have a Supabase card ID
    if (supabaseCardId) {
      try {
        console.log('[Pluckk] Uploading image to Supabase Storage...');
        const imageUrl = await supabase.uploadImage(imageResult.data, imageResult.mimeType, supabaseCardId);
        console.log('[Pluckk] Image uploaded to Supabase:', imageUrl);

        console.log('[Pluckk] Updating Supabase card with image URL...');
        await supabase.updateCardImage(supabaseCardId, imageUrl);
        console.log('[Pluckk] Supabase card updated with image URL!');
      } catch (supabaseError) {
        // Log but don't fail the whole task if Supabase upload fails
        console.error('[Pluckk] Supabase image upload failed:', supabaseError.message);
      }
    }
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
 * Background task to generate image and upload to Supabase only (no Mochi)
 * Used when Mochi is not configured
 */
async function generateImageForSupabase(supabaseCardId, question, answer) {
  const taskId = `supabase-${supabaseCardId}-${Date.now()}`;
  pendingTasks.add(taskId);
  startKeepAlive();

  try {
    console.log('[Pluckk] Starting Supabase-only image generation task:', taskId);

    // Check if user is authenticated (required for backend image generation)
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) {
      console.log('[Pluckk] User not authenticated, skipping image generation');
      return;
    }

    console.log('[Pluckk] Generating image for Supabase card:', supabaseCardId);
    const imageResult = await generateImageWithBackend(question, answer);
    console.log('[Pluckk] Image generated successfully, mimeType:', imageResult.mimeType);

    // Upload to Supabase Storage
    console.log('[Pluckk] Uploading image to Supabase Storage...');
    const imageUrl = await supabase.uploadImage(imageResult.data, imageResult.mimeType, supabaseCardId);
    console.log('[Pluckk] Image uploaded to Supabase:', imageUrl);

    // Update Supabase card with image URL
    console.log('[Pluckk] Updating Supabase card with image URL...');
    await supabase.updateCardImage(supabaseCardId, imageUrl);
    console.log('[Pluckk] Supabase card updated with image URL!');
  } catch (error) {
    console.error('[Pluckk] Failed to generate/upload image for Supabase:', error.message, error);
  } finally {
    pendingTasks.delete(taskId);
    console.log('[Pluckk] Task completed:', taskId, 'Remaining tasks:', pendingTasks.size);
    if (pendingTasks.size === 0) {
      stopKeepAlive();
    }
  }
}

/**
 * Background task to upload a screenshot to Supabase only
 * Used when user pastes a screenshot for card generation
 * Note: Screenshots are NOT sent to Mochi, only to Pluckk's Supabase storage
 */
async function uploadScreenshotToSupabase(supabaseCardId, screenshotData, screenshotMimeType) {
  if (!supabaseCardId) {
    console.log('[Pluckk] No Supabase card ID, skipping screenshot upload');
    return;
  }

  const taskId = `screenshot-${supabaseCardId}-${Date.now()}`;
  pendingTasks.add(taskId);
  startKeepAlive();

  try {
    console.log('[Pluckk] Starting screenshot upload task:', taskId);
    console.log('[Pluckk] Uploading screenshot to Supabase Storage...');
    const imageUrl = await supabase.uploadImage(screenshotData, screenshotMimeType, supabaseCardId);
    console.log('[Pluckk] Screenshot uploaded to Supabase:', imageUrl);

    console.log('[Pluckk] Updating Supabase card with image URL...');
    await supabase.updateCardImage(supabaseCardId, imageUrl);
    console.log('[Pluckk] Supabase card updated with image URL!');
  } catch (error) {
    console.error('[Pluckk] Failed to upload screenshot:', error.message, error);
  } finally {
    pendingTasks.delete(taskId);
    console.log('[Pluckk] Task completed:', taskId, 'Remaining tasks:', pendingTasks.size);
    if (pendingTasks.size === 0) {
      stopKeepAlive();
    }
  }
}

/**
 * Create a card in Mochi (without automatically triggering image generation)
 * Returns the card ID so caller can decide how to handle image attachment
 */
async function createMochiCardWithoutImage(question, answer, sourceUrl) {
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
    return { success: true, cardId: card.id };
  } catch (error) {
    console.error('Failed to create Mochi card:', error);
    return { error: 'mochi_api_error', message: error.message };
  }
}

/**
 * Create a card in Mochi (legacy function that auto-triggers AI image generation)
 * @deprecated Use createMochiCardWithoutImage instead for better control
 */
async function createMochiCard(question, answer, sourceUrl, supabaseCardId = null) {
  const result = await createMochiCardWithoutImage(question, answer, sourceUrl);

  if (result.success && result.cardId) {
    // Fire-and-forget: trigger background image generation
    // Don't await - let it run asynchronously so user doesn't experience latency
    // Pass supabaseCardId so image can also be saved to Supabase
    generateAndAttachImage(result.cardId, question, answer, sourceUrl, supabaseCardId);
  }

  return result;
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

      const result = await handleGenerateCards(
        tabs[0].id,
        request.focusText || '',
        request.cachedSelection || null
      );
      sendResponse(result);
    });

    return true; // Keep message channel open for async response
  }

  if (request.action === 'sendToMochi') {
    // Save to Supabase first to get card ID, then create Mochi card with that ID
    // This allows the image (screenshot or AI-generated) to update both Mochi and Supabase
    (async () => {
      let supabaseResult = { supabase: { success: true } };
      let supabaseCardId = null;

      // Get user session for user_id
      const { session, user } = await getSession();

      // Require authentication to save cards
      if (!user?.id) {
        sendResponse({
          mochi: { error: 'not_authenticated', message: 'Please sign in to save cards' },
          supabase: { error: 'not_authenticated', message: 'Please sign in to save cards' }
        });
        return;
      }

      // Check if this is a screenshot-based card
      const hasScreenshot = request.screenshotData && request.screenshotMimeType;

      // First, save to Supabase with user association
      try {
        const result = await supabase.saveCard(
          request.question,
          request.answer,
          request.sourceUrl,
          {
            userId: user.id,
            accessToken: session?.access_token
          }
        );
        supabaseCardId = result.cardId;
        supabaseResult = { supabase: result };
      } catch (error) {
        supabaseResult = { supabase: { error: 'supabase_error', message: error.message } };
      }

      // Then, create Mochi card with Supabase card ID (for image linking)
      let mochiResult;
      try {
        const result = await createMochiCardWithoutImage(request.question, request.answer, request.sourceUrl);
        mochiResult = { mochi: result };

        if (result.success && result.cardId) {
          if (hasScreenshot) {
            // Fire-and-forget: upload screenshot to Supabase only (not Mochi)
            uploadScreenshotToSupabase(supabaseCardId, request.screenshotData, request.screenshotMimeType);
          } else {
            // Fire-and-forget: generate AI image and attach to Mochi and Supabase
            generateAndAttachImage(result.cardId, request.question, request.answer, request.sourceUrl, supabaseCardId);
          }
        } else if ((result.error === 'mochi_api_key_missing' || result.error === 'mochi_deck_not_selected') && supabaseCardId) {
          // Mochi isn't configured but we have a Supabase card
          if (hasScreenshot) {
            // Fire-and-forget: upload screenshot to Supabase only
            uploadScreenshotToSupabase(supabaseCardId, request.screenshotData, request.screenshotMimeType);
          } else {
            // Fire-and-forget: generate image for Supabase card only
            generateImageForSupabase(supabaseCardId, request.question, request.answer);
          }
        }
      } catch (error) {
        mochiResult = { mochi: { error: 'mochi_error', message: error.message } };
      }

      sendResponse({ ...mochiResult, ...supabaseResult });
    })();

    return true; // Keep message channel open for async response
  }

  if (request.action === 'generateCardsFromImage') {
    // Generate cards from a pasted screenshot using Claude vision
    (async () => {
      // Get access token (getSession handles token refresh if needed)
      const accessToken = await getAccessToken();
      if (!accessToken) {
        sendResponse({ error: 'not_authenticated' });
        return;
      }

      try {
        const response = await fetch(`${BACKEND_URL}/api/generate-cards-from-image`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            imageData: request.imageData,
            mimeType: request.mimeType,
            focusText: request.focusText || ''
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));

          if (response.status === 401) {
            sendResponse({ error: 'not_authenticated' });
            return;
          }

          if (response.status === 402) {
            sendResponse({ error: 'usage_limit_reached' });
            return;
          }

          console.error('Image card generation API error:', response.status, errorData);
          sendResponse({ error: 'api_error', message: errorData.error || 'Failed to analyze image' });
          return;
        }

        const data = await response.json();
        sendResponse({
          cards: data.cards,
          usage: data.usage
        });
      } catch (error) {
        console.error('Image card generation failed:', error);
        sendResponse({ error: 'api_error', message: error.message });
      }
    })();

    return true;
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

  if (request.action === 'saveToSupabase') {
    (async () => {
      try {
        const { session, user } = await getSession();

        // Require authentication to save cards
        if (!user?.id) {
          sendResponse({ error: 'not_authenticated', message: 'Please sign in to save cards' });
          return;
        }

        const result = await supabase.saveCard(
          request.question,
          request.answer,
          request.sourceUrl,
          {
            userId: user.id,
            accessToken: session?.access_token
          }
        );
        sendResponse(result);
      } catch (error) {
        sendResponse({ error: 'supabase_error', message: error.message });
      }
    })();

    return true;
  }

  if (request.action === 'getAuthStatus') {
    getSession()
      .then(({ session, user }) => {
        sendResponse({
          authenticated: !!session,
          user: user ? { email: user.email, id: user.id } : null
        });
      })
      .catch(error => sendResponse({ authenticated: false, error: error.message }));

    return true;
  }
});
