// POST /api/generate-image
// Proxies Gemini API calls for image generation with server-side API key

import { authenticateRequest } from '../lib/auth.js';

const GEMINI_MODEL = 'gemini-2.5-flash-image';

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Authenticate user
  const authResult = await authenticateRequest(req);
  if (authResult.error) {
    return res.status(authResult.status).json({ error: authResult.error });
  }

  // Parse request body
  const { question, answer, sourceUrl } = req.body;

  if (!question || !answer) {
    return res.status(400).json({ error: 'Missing question or answer' });
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    return res.status(500).json({ error: 'Image generation not configured' });
  }

  // Build prompt for image generation
  const prompt = `Create a simple, memorable visual that represents this flashcard concept:

Question: ${question}
Answer: ${answer}

Requirements:
- Create a clear, educational illustration
- Use simple shapes and colors
- Make it memorable and relevant to the concept
- Avoid text in the image
- Style: clean, modern, educational`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

    const geminiResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiApiKey
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE']
        }
      })
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', geminiResponse.status, errorText);

      // Parse error details if possible
      let errorDetail = 'Failed to generate image';
      try {
        const errorJson = JSON.parse(errorText);
        errorDetail = errorJson.error?.message || errorText;
      } catch {
        errorDetail = errorText;
      }

      if (geminiResponse.status === 429) {
        return res.status(429).json({ error: 'rate_limit', message: 'Image generation rate limited' });
      }

      // Return actual error for debugging
      return res.status(geminiResponse.status).json({
        error: 'gemini_api_error',
        message: errorDetail,
        status: geminiResponse.status
      });
    }

    const data = await geminiResponse.json();

    // Extract image data from response
    const candidate = data.candidates?.[0];
    if (!candidate) {
      return res.status(500).json({ error: 'No image generated' });
    }

    // Find the inline_data part with the image
    const imagePart = candidate.content?.parts?.find(
      part => part.inline_data?.mime_type?.startsWith('image/')
    );

    if (!imagePart) {
      return res.status(500).json({ error: 'No image in response' });
    }

    return res.status(200).json({
      imageData: imagePart.inline_data.data,
      mimeType: imagePart.inline_data.mime_type
    });

  } catch (error) {
    console.error('Error generating image:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
