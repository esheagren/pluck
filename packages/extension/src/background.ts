// Pluckk - Background Service Worker
// Handles API calls via backend proxy and message routing

import { createSupabaseClient } from '@pluckk/shared/supabase';
import {
  BACKEND_URL,
  DEFAULT_SYSTEM_PROMPT
} from '@pluckk/shared/constants';
import { getSession, getAccessToken, getUserProfile } from './auth';
import type {
  SelectionData,
  GeneratedCard,
  GenerateCardsResponse,
  MochiResult,
  SupabaseResult,
  AuthStatusResponse,
  MochiStatusResponse,
  ExtensionMessage,
} from './types';

// Initialize Supabase client
const supabase = createSupabaseClient({
  onError: (msg: string, err: unknown) => console.error('[Pluckk]', msg, err)
});

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  if (tab.windowId) {
    chrome.sidePanel.open({ windowId: tab.windowId });
  }
});

// Enable side panel to be opened
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

/**
 * Get system prompt from storage (or use default)
 */
async function getSystemPrompt(): Promise<string> {
  const result = await chrome.storage.sync.get(['systemPrompt']);
  return (result.systemPrompt as string) || DEFAULT_SYSTEM_PROMPT;
}

/**
 * Check if user is authenticated
 */
async function checkAuth(): Promise<boolean> {
  const { session } = await getSession();
  return !!session;
}

/**
 * Inject content script into the tab if not already injected
 */
async function ensureContentScriptInjected(tabId: number): Promise<boolean> {
  try {
    // Try to ping the content script first to see if it's already there
    await chrome.tabs.sendMessage(tabId, { action: 'ping' });
    return true;
  } catch {
    // Content script not injected yet, inject it now
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      });
      return true;
    } catch (error) {
      console.error('Failed to inject content script:', error);
      return false;
    }
  }
}

/**
 * Get selection data from the active tab's content script
 */
async function getSelectionFromTab(tabId: number): Promise<SelectionData | null> {
  try {
    // Ensure content script is injected first
    const injected = await ensureContentScriptInjected(tabId);
    if (!injected) {
      return null;
    }

    const response = await chrome.tabs.sendMessage(tabId, { action: 'getSelection' });
    return response as SelectionData;
  } catch (error) {
    console.error('Failed to get selection:', error);
    return null;
  }
}

/**
 * Capture viewport screenshot and resize/compress
 */
async function captureViewportScreenshot(): Promise<{ imageData: string; mimeType: string } | null> {
  try {
    // Capture the visible tab
    const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'jpeg', quality: 80 });

    // Extract base64 data
    const base64Data = dataUrl.split(',')[1];

    // Resize if needed (max 1024px, target ~200KB)
    const resized = await resizeImageInWorker(base64Data, 'image/jpeg', 1024, 200);

    return {
      imageData: resized.data,
      mimeType: resized.mimeType
    };
  } catch (error) {
    console.error('Failed to capture viewport:', error);
    return null;
  }
}

/**
 * Resize an image using OffscreenCanvas (service worker compatible)
 */
async function resizeImageInWorker(
  base64Data: string,
  mimeType: string,
  maxDimension = 1024,
  targetSizeKB = 200
): Promise<{ data: string; mimeType: string }> {
  // Create blob from base64
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });

  // Create ImageBitmap
  const imageBitmap = await createImageBitmap(blob);

  // Calculate new dimensions
  let { width, height } = imageBitmap;
  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      height = Math.round((height / width) * maxDimension);
      width = maxDimension;
    } else {
      width = Math.round((width / height) * maxDimension);
      height = maxDimension;
    }
  }

  // Use OffscreenCanvas for service worker
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }
  ctx.drawImage(imageBitmap, 0, 0, width, height);

  // Compress to target size
  let quality = 0.85;
  let resultBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality });

  while (resultBlob.size > targetSizeKB * 1024 && quality > 0.1) {
    quality -= 0.1;
    resultBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
  }

  // Convert blob to base64
  const arrayBuffer = await resultBlob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  let binaryStr = '';
  for (const byte of uint8Array) {
    binaryStr += String.fromCharCode(byte);
  }
  const data = btoa(binaryStr);

  return { data, mimeType: 'image/jpeg' };
}

/**
 * Call backend API to generate cards
 */
async function generateCards(selectionData: SelectionData, focusText = ''): Promise<GeneratedCard[]> {
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

  interface GenerateResponse {
    cards: GeneratedCard[];
  }

  const data: GenerateResponse = await response.json();

  if (!data.cards || !Array.isArray(data.cards)) {
    throw new Error('Invalid response format: missing cards array');
  }

  return data.cards;
}

/**
 * Main handler for card generation requests
 */
async function handleGenerateCards(
  tabId: number,
  focusText = '',
  cachedSelection: SelectionData | null = null
): Promise<GenerateCardsResponse> {
  // Check authentication
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) {
    return { error: 'not_authenticated' };
  }

  // Use cached selection if provided, otherwise get from content script
  let selectionData: SelectionData | null;
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
    const errorMessage = (error as Error).message;

    if (errorMessage === 'not_authenticated') {
      return { error: 'not_authenticated' };
    }

    if (errorMessage === 'usage_limit_reached') {
      return { error: 'usage_limit_reached' };
    }

    if (errorMessage.includes('429')) {
      return { error: 'rate_limit' };
    }

    if (error instanceof SyntaxError) {
      return { error: 'parse_error', message: 'Failed to parse response' };
    }

    return { error: 'api_error', message: errorMessage };
  }
}

/**
 * Image generation result
 */
interface ImageResult {
  data: string;
  mimeType: string;
}

/**
 * Generate an image using backend Gemini proxy based on the card content
 */
async function generateImageWithBackend(
  question: string,
  answer: string,
  diagramPrompt: string | null = null
): Promise<ImageResult> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error('not_authenticated');
  }

  console.log(`[Pluckk] Generating image via backend...${diagramPrompt ? ' (diagram mode)' : ''}`);

  interface ImageRequestBody {
    question: string;
    answer: string;
    diagramPrompt?: string;
  }

  const body: ImageRequestBody = { question, answer };
  if (diagramPrompt) {
    body.diagramPrompt = diagramPrompt;
  }

  const response = await fetch(`${BACKEND_URL}/api/generate-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error(`[Pluckk] Image generation failed:`, response.status, errorData);
    throw new Error(`Image API error (${response.status}): ${errorData.error || 'Unknown error'}`);
  }

  interface ImageResponse {
    imageData: string;
    mimeType?: string;
  }

  const data: ImageResponse = await response.json();
  console.log(`[Pluckk] Image generated successfully!`);

  return {
    data: data.imageData,
    mimeType: data.mimeType || 'image/png'
  };
}


// Track pending image generation tasks to keep service worker alive
const pendingTasks = new Set<string>();
const KEEP_ALIVE_ALARM = 'pluckk-keep-alive';

/**
 * Keep service worker alive while tasks are pending
 * Uses chrome.alarms which properly extends service worker lifetime
 */
async function startKeepAlive(): Promise<void> {
  console.log('[Pluckk] Starting keep-alive alarm');
  await chrome.alarms.create(KEEP_ALIVE_ALARM, { periodInMinutes: 0.5 }); // Every 30 seconds
}

async function stopKeepAlive(): Promise<void> {
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
async function generateAndAttachImage(
  mochiCardId: string,
  question: string,
  answer: string,
  sourceUrl: string,
  supabaseCardId: string | null = null,
  diagramPrompt: string | null = null
): Promise<void> {
  const taskId = `${mochiCardId}-${Date.now()}`;
  pendingTasks.add(taskId);

  // Start keep-alive mechanism to prevent service worker termination
  startKeepAlive();

  try {
    console.log('[Pluckk] Starting image generation task:', taskId, diagramPrompt ? '(diagram)' : '');

    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.log('[Pluckk] User not authenticated, skipping image generation');
      return;
    }

    console.log('[Pluckk] Generating image for card:', mochiCardId, 'Question:', question.substring(0, 50));
    const imageResult = await generateImageWithBackend(question, answer, diagramPrompt);
    console.log('[Pluckk] Image generated successfully, mimeType:', imageResult.mimeType);

    // Attach to Mochi via backend API
    if (mochiCardId) {
      console.log('[Pluckk] Attaching image to Mochi card via backend...');
      let originalContent = `${question}\n---\n${answer}`;
      if (sourceUrl) {
        originalContent += `\n\n---\nSource: ${sourceUrl}`;
      }

      const attachResponse = await fetch(`${BACKEND_URL}/api/send-to-mochi`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          cardId: mochiCardId,
          imageData: imageResult.data,
          imageMimeType: imageResult.mimeType,
          originalContent
        })
      });

      if (attachResponse.ok) {
        console.log('[Pluckk] Image attached to Mochi successfully!');
      } else {
        const error = await attachResponse.json().catch(() => ({}));
        console.error('[Pluckk] Failed to attach image to Mochi:', error);
      }
    }

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
        console.error('[Pluckk] Supabase image upload failed:', (supabaseError as Error).message);
      }
    }
  } catch (error) {
    console.error('[Pluckk] Failed to generate/attach image:', (error as Error).message, error);
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
async function generateImageForSupabase(
  supabaseCardId: string,
  question: string,
  answer: string,
  diagramPrompt: string | null = null
): Promise<void> {
  const taskId = `supabase-${supabaseCardId}-${Date.now()}`;
  pendingTasks.add(taskId);
  startKeepAlive();

  try {
    console.log('[Pluckk] Starting Supabase-only image generation task:', taskId, diagramPrompt ? '(diagram)' : '');

    // Check if user is authenticated (required for backend image generation)
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) {
      console.log('[Pluckk] User not authenticated, skipping image generation');
      return;
    }

    console.log('[Pluckk] Generating image for Supabase card:', supabaseCardId);
    const imageResult = await generateImageWithBackend(question, answer, diagramPrompt);
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
    console.error('[Pluckk] Failed to generate/upload image for Supabase:', (error as Error).message, error);
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
async function uploadScreenshotToSupabase(
  supabaseCardId: string,
  screenshotData: string,
  screenshotMimeType: string
): Promise<void> {
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
    console.error('[Pluckk] Failed to upload screenshot:', (error as Error).message, error);
  } finally {
    pendingTasks.delete(taskId);
    console.log('[Pluckk] Task completed:', taskId, 'Remaining tasks:', pendingTasks.size);
    if (pendingTasks.size === 0) {
      stopKeepAlive();
    }
  }
}

/**
 * Create a card in Mochi via backend API
 * Returns the card ID so caller can decide how to handle image attachment
 */
async function sendCardToMochi(
  question: string,
  answer: string,
  sourceUrl: string,
  imageData: string | null = null,
  imageMimeType: string | null = null
): Promise<MochiResult> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return { error: 'not_authenticated' };
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/send-to-mochi`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        question,
        answer,
        sourceUrl,
        imageData,
        imageMimeType
      })
    });

    interface MochiResponse {
      cardId?: string;
      error?: string;
      message?: string;
    }

    const data: MochiResponse = await response.json();

    if (!response.ok) {
      console.error('Mochi API error:', response.status, data);
      return { error: data.error || 'mochi_api_error', message: data.message };
    }

    return { success: true, cardId: data.cardId };
  } catch (error) {
    console.error('Failed to create Mochi card:', error);
    return { error: 'mochi_api_error', message: (error as Error).message };
  }
}

// Message request types
interface GenerateCardsRequest extends ExtensionMessage {
  action: 'generateCards';
  focusText?: string;
  cachedSelection?: SelectionData | null;
}

interface SendToMochiRequest extends ExtensionMessage {
  action: 'sendToMochi';
  question: string;
  answer: string;
  sourceUrl: string;
  tags?: string[];
  screenshotData?: string;
  screenshotMimeType?: string;
  generateDiagram?: boolean;
  diagramPrompt?: string;
  // Source context for storage
  sourceSelection?: string;
  sourceContext?: string;
  sourceTitle?: string;
}

interface PageContext {
  domContext: {
    headings: string[];
    visibleText: string;
    url: string;
    title: string;
  };
  viewportScreenshot?: {
    imageData: string;
    mimeType: string;
  };
}

interface GenerateCardsFromImageRequest extends ExtensionMessage {
  action: 'generateCardsFromImage';
  imageData: string;
  mimeType: string;
  focusText?: string;
  pageContext?: PageContext;
}

interface AnswerQuestionRequest extends ExtensionMessage {
  action: 'answerQuestion';
  question: string;
  url?: string;
  title?: string;
}

interface SaveToSupabaseRequest extends ExtensionMessage {
  action: 'saveToSupabase';
  question: string;
  answer: string;
  sourceUrl: string;
}

type MessageRequest =
  | GenerateCardsRequest
  | SendToMochiRequest
  | GenerateCardsFromImageRequest
  | AnswerQuestionRequest
  | SaveToSupabaseRequest
  | { action: 'getMochiStatus' }
  | { action: 'getAuthStatus' }
  | { action: 'captureViewport' };

// Listen for messages from popup
chrome.runtime.onMessage.addListener(
  (
    request: MessageRequest,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ): boolean => {
    if (request.action === 'generateCards') {
      const req = request as GenerateCardsRequest;
      // Get the active tab and generate cards
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (!tabs[0] || !tabs[0].id) {
          sendResponse({ error: 'no_active_tab' });
          return;
        }

        const result = await handleGenerateCards(
          tabs[0].id,
          req.focusText || '',
          req.cachedSelection || null
        );
        sendResponse(result);
      });

      return true; // Keep message channel open for async response
    }

    if (request.action === 'sendToMochi') {
      const req = request as SendToMochiRequest;
      // Save to Supabase first, then send to Mochi via backend API
      (async () => {
        let supabaseResult: { supabase: SupabaseResult } = { supabase: { success: true } };
        let supabaseCardId: string | null = null;

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
        const hasScreenshot = req.screenshotData && req.screenshotMimeType;

        // First, save to Supabase with user association
        try {
          const result = await supabase.saveCard(
            req.question,
            req.answer,
            req.sourceUrl,
            {
              userId: user.id,
              accessToken: session?.access_token,
              sourceSelection: req.sourceSelection,
              sourceContext: req.sourceContext,
              sourceTitle: req.sourceTitle
            }
          );
          supabaseCardId = result.cardId || null;
          supabaseResult = { supabase: result };
        } catch (error) {
          supabaseResult = { supabase: { error: 'supabase_error', message: (error as Error).message } };
        }

        // Send to Mochi via backend API
        let mochiResult: { mochi: MochiResult };
        try {
          // For screenshots, send the image with the card creation
          // For text cards, create card first, then generate AI image in background
          if (hasScreenshot) {
            const result = await sendCardToMochi(
              req.question,
              req.answer,
              req.sourceUrl,
              req.screenshotData,
              req.screenshotMimeType
            );
            mochiResult = { mochi: result };

            // Also upload screenshot to Supabase
            if (supabaseCardId) {
              uploadScreenshotToSupabase(supabaseCardId, req.screenshotData!, req.screenshotMimeType!);
            }
          } else {
            // Create card without image first (fast response)
            const result = await sendCardToMochi(req.question, req.answer, req.sourceUrl);
            mochiResult = { mochi: result };

            // Determine if we should generate an image:
            // - Only for diagram cards when generateDiagram checkbox was checked
            // - Regular cards: no automatic image generation
            const isDiagramCard = !!req.diagramPrompt;
            const shouldGenerateImage = isDiagramCard && req.generateDiagram;
            const diagramPrompt = shouldGenerateImage ? req.diagramPrompt : null;

            if (result.success && result.cardId && shouldGenerateImage) {
              // Fire-and-forget: generate AI image and attach to Mochi and Supabase
              generateAndAttachImage(result.cardId, req.question, req.answer, req.sourceUrl, supabaseCardId, diagramPrompt || null);
            } else if (result.error === 'mochi_not_configured' && supabaseCardId && shouldGenerateImage) {
              // Mochi isn't configured but we have a Supabase card
              generateImageForSupabase(supabaseCardId, req.question, req.answer, diagramPrompt || null);
            }
          }
        } catch (error) {
          mochiResult = { mochi: { error: 'mochi_error', message: (error as Error).message } };
        }

        sendResponse({ ...mochiResult, ...supabaseResult });
      })();

      return true; // Keep message channel open for async response
    }

    if (request.action === 'generateCardsFromImage') {
      const req = request as GenerateCardsFromImageRequest;
      // Generate cards from a pasted screenshot using Claude vision
      (async () => {
        // Get access token (getSession handles token refresh if needed)
        const accessToken = await getAccessToken();
        if (!accessToken) {
          sendResponse({ error: 'not_authenticated' });
          return;
        }

        try {
          interface RequestBody {
            imageData: string;
            mimeType: string;
            focusText: string;
            pageContext?: PageContext;
          }

          const body: RequestBody = {
            imageData: req.imageData,
            mimeType: req.mimeType,
            focusText: req.focusText || ''
          };

          // Include page context if provided
          if (req.pageContext) {
            body.pageContext = req.pageContext;
          }

          const response = await fetch(`${BACKEND_URL}/api/generate-cards-from-image`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(body)
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

          interface ImageCardsResponse {
            cards: GeneratedCard[];
            usage?: { input_tokens: number; output_tokens: number };
          }

          const data: ImageCardsResponse = await response.json();
          sendResponse({
            cards: data.cards,
            usage: data.usage
          });
        } catch (error) {
          console.error('Image card generation failed:', error);
          sendResponse({ error: 'api_error', message: (error as Error).message });
        }
      })();

      return true;
    }

    if (request.action === 'answerQuestion') {
      const req = request as AnswerQuestionRequest;
      // Generate answer for a user-typed question
      (async () => {
        const accessToken = await getAccessToken();
        if (!accessToken) {
          sendResponse({ error: 'not_authenticated' });
          return;
        }

        try {
          const response = await fetch(`${BACKEND_URL}/api/answer-question`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
              question: req.question,
              url: req.url,
              title: req.title
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

            if (response.status === 429) {
              sendResponse({ error: 'rate_limit', message: 'Too many requests, please try again later' });
              return;
            }

            console.error('Answer question API error:', response.status, errorData);
            sendResponse({ error: 'api_error', message: errorData.error || 'Failed to generate answer' });
            return;
          }

          interface AnswerResponse {
            cards: GeneratedCard[];
            usage?: { input_tokens: number; output_tokens: number };
          }

          const data: AnswerResponse = await response.json();
          // API returns cards array directly
          sendResponse({
            cards: data.cards,
            isQuestionMode: true,
            usage: data.usage
          });
        } catch (error) {
          console.error('Answer question failed:', error);
          sendResponse({ error: 'api_error', message: (error as Error).message });
        }
      })();

      return true;
    }

    if (request.action === 'getMochiStatus') {
      (async () => {
        try {
          const profile = await getUserProfile();
          const configured = !!(profile?.settings?.mochiApiKey && profile?.settings?.mochiDeckId);
          sendResponse({ configured } as MochiStatusResponse);
        } catch (error) {
          console.error('Failed to get Mochi status:', error);
          sendResponse({ configured: false } as MochiStatusResponse);
        }
      })();

      return true;
    }

    if (request.action === 'saveToSupabase') {
      const req = request as SaveToSupabaseRequest;
      (async () => {
        try {
          const { session, user } = await getSession();

          // Require authentication to save cards
          if (!user?.id) {
            sendResponse({ error: 'not_authenticated', message: 'Please sign in to save cards' });
            return;
          }

          const result = await supabase.saveCard(
            req.question,
            req.answer,
            req.sourceUrl,
            {
              userId: user.id,
              accessToken: session?.access_token
            }
          );
          sendResponse(result);
        } catch (error) {
          sendResponse({ error: 'supabase_error', message: (error as Error).message });
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
          } as AuthStatusResponse);
        })
        .catch(error => sendResponse({ authenticated: false, error: (error as Error).message } as AuthStatusResponse));

      return true;
    }

    if (request.action === 'captureViewport') {
      captureViewportScreenshot()
        .then(result => sendResponse(result))
        .catch(error => {
          console.error('Viewport capture failed:', error);
          sendResponse(null);
        });

      return true;
    }

    return false;
  }
);
