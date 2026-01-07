// POST /api/attach-mochi-image
// Attaches an image to an existing Mochi card

import { authenticateRequest } from '../lib/auth.js';

const MOCHI_API_URL = 'https://app.mochi.cards/api';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authResult = await authenticateRequest(req);
  if (authResult.error) {
    return res.status(authResult.status).json({ error: authResult.error });
  }

  const { profile } = authResult;
  const mochiApiKey = profile.mochi_api_key;

  if (!mochiApiKey) {
    return res.status(400).json({ error: 'mochi_not_configured' });
  }

  const { cardId, imageData, imageMimeType, originalContent } = req.body;

  if (!cardId || !imageData || !imageMimeType) {
    return res.status(400).json({ error: 'Missing cardId, imageData, or imageMimeType' });
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
      return res.status(500).json({ error: 'Failed to upload image to Mochi' });
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

    return res.status(200).json({ success: true, filename });

  } catch (error) {
    console.error('Error attaching image to Mochi:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
