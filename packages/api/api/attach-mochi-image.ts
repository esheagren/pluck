// POST /api/attach-mochi-image
// Attaches an image to an existing Mochi card

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, isAuthError } from '../lib/auth.js';
import type { AttachMochiImageRequest } from '../lib/types.js';

const MOCHI_API_URL = 'https://app.mochi.cards/api';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const authResult = await authenticateRequest(req);
  if (isAuthError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const { profile } = authResult;
  const mochiApiKey = profile.mochi_api_key;

  if (!mochiApiKey) {
    res.status(400).json({ error: 'mochi_not_configured' });
    return;
  }

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
