// POST /api/send-to-mochi
// Proxies card creation to Mochi API using user's stored credentials
// Also handles attaching images to existing cards (when cardId is provided)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, isAuthError } from '../lib/auth.js';
import type { SendToMochiRequest, AttachMochiImageRequest, MochiCardResponse } from '../lib/types.js';

const MOCHI_API_URL = 'https://app.mochi.cards/api';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Authenticate user
  const authResult = await authenticateRequest(req);
  if (isAuthError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const { profile } = authResult;

  // Check Mochi configuration
  const mochiApiKey = profile.mochi_api_key;

  if (!mochiApiKey) {
    res.status(400).json({
      error: 'mochi_not_configured',
      message: 'Mochi API key not configured. Set it up in Settings.'
    });
    return;
  }

  // Check if this is an "attach image to existing card" request
  const { cardId } = req.body as AttachMochiImageRequest;
  if (cardId) {
    return handleAttachImage(req, res, mochiApiKey);
  }

  // Otherwise, it's a "create new card" request - need deck ID
  const mochiDeckId = profile.mochi_deck_id;
  if (!mochiDeckId) {
    res.status(400).json({
      error: 'mochi_deck_not_selected',
      message: 'No Mochi deck selected. Choose one in Settings.'
    });
    return;
  }

  const { question, answer, sourceUrl, imageData, imageMimeType } = req.body as SendToMochiRequest;

  if (!question || !answer) {
    res.status(400).json({ error: 'Missing question or answer' });
    return;
  }

  try {
    // Format content for Mochi (question on front, answer on back)
    let content = `${question}\n---\n${answer}`;
    if (sourceUrl) {
      content += `\n\n---\nSource: ${sourceUrl}`;
    }

    // Create card in Mochi
    const createResponse = await fetch(`${MOCHI_API_URL}/cards/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(mochiApiKey + ':').toString('base64')
      },
      body: JSON.stringify({
        'content': content,
        'deck-id': mochiDeckId
      })
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('Mochi API error:', createResponse.status, errorText);

      if (createResponse.status === 401) {
        res.status(400).json({
          error: 'mochi_auth_failed',
          message: 'Mochi API key is invalid. Update it in Settings.'
        });
        return;
      }

      res.status(500).json({
        error: 'mochi_api_error',
        message: `Mochi API error (${createResponse.status})`
      });
      return;
    }

    const card = await createResponse.json() as MochiCardResponse;
    const cardId = card.id;

    // If image data provided, upload it as attachment
    if (imageData && imageMimeType) {
      try {
        await uploadImageToMochiCard(cardId, imageData, imageMimeType, mochiApiKey, content);
      } catch (imageError) {
        console.error('Failed to attach image to Mochi card:', imageError);
        // Card was created, just image attachment failed - still return success
      }
    }

    res.status(200).json({
      success: true,
      cardId: cardId
    });

  } catch (error) {
    console.error('Error sending to Mochi:', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to send card to Mochi'
    });
  }
}

/**
 * Upload an image attachment to a Mochi card and update content to display it
 */
async function uploadImageToMochiCard(
  cardId: string,
  imageData: string,
  mimeType: string,
  apiKey: string,
  originalContent: string
): Promise<void> {
  // Determine file extension
  const ext = mimeType.includes('png') ? 'png' : 'jpg';
  const randomId = Math.random().toString(36).substring(2, 10);
  const filename = `img${randomId}.${ext}`;

  // Convert base64 to buffer
  const imageBuffer = Buffer.from(imageData, 'base64');

  // Build multipart form data manually
  const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);
  const parts = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"`,
    `Content-Type: ${mimeType}`,
    '',
    '' // Will be replaced with binary data
  ];
  const header = Buffer.from(parts.join('\r\n'));
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);

  // Combine header + image data + footer
  const body = Buffer.concat([header, imageBuffer, footer]);

  // Upload attachment
  const uploadResponse = await fetch(`${MOCHI_API_URL}/cards/${cardId}/attachments/${filename}`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(apiKey + ':').toString('base64'),
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body: body
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`Upload failed (${uploadResponse.status}): ${errorText}`);
  }

  // Update card content to display image inline
  const newContent = originalContent + `\n\n![](@media/${filename})`;

  const updateResponse = await fetch(`${MOCHI_API_URL}/cards/${cardId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + Buffer.from(apiKey + ':').toString('base64')
    },
    body: JSON.stringify({ 'content': newContent })
  });

  if (!updateResponse.ok) {
    const errorText = await updateResponse.text();
    throw new Error(`Update failed (${updateResponse.status}): ${errorText}`);
  }
}

/**
 * Handle attaching an image to an existing Mochi card
 */
async function handleAttachImage(
  req: VercelRequest,
  res: VercelResponse,
  mochiApiKey: string
): Promise<void> {
  const { cardId, imageData, imageMimeType, originalContent } = req.body as AttachMochiImageRequest;

  if (!cardId || !imageData || !imageMimeType) {
    res.status(400).json({ error: 'Missing cardId, imageData, or imageMimeType' });
    return;
  }

  try {
    // Determine file extension
    const ext = imageMimeType.includes('png') ? 'png' : 'jpg';
    const randomId = Math.random().toString(36).substring(2, 10);
    const filename = `img${randomId}.${ext}`;

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(imageData, 'base64');

    // Build multipart form data manually
    const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);
    const parts = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="file"; filename="${filename}"`,
      `Content-Type: ${imageMimeType}`,
      '',
      ''
    ];
    const header = Buffer.from(parts.join('\r\n'));
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([header, imageBuffer, footer]);

    // Upload attachment
    const uploadResponse = await fetch(`${MOCHI_API_URL}/cards/${cardId}/attachments/${filename}`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(mochiApiKey + ':').toString('base64'),
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: body
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('Mochi attachment upload error:', uploadResponse.status, errorText);
      res.status(500).json({ error: 'Failed to upload image to Mochi' });
      return;
    }

    // Update card content to display image inline
    if (originalContent) {
      const newContent = originalContent + `\n\n![](@media/${filename})`;

      const updateResponse = await fetch(`${MOCHI_API_URL}/cards/${cardId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + Buffer.from(mochiApiKey + ':').toString('base64')
        },
        body: JSON.stringify({ 'content': newContent })
      });

      if (!updateResponse.ok) {
        console.error('Mochi card update error:', updateResponse.status);
        // Image was uploaded, just content update failed - still partial success
      }
    }

    res.status(200).json({ success: true, filename });

  } catch (error) {
    console.error('Error attaching image to Mochi:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
