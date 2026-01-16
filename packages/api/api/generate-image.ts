// POST /api/generate-image
// Proxies Gemini API calls for image generation with server-side API key

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from '../lib/auth.js';
import type { GenerateImageRequest } from '../lib/types.js';
import type { GeminiResponse } from '../lib/claude-types.js';

const GEMINI_MODEL = 'gemini-2.5-flash-image';

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
  if (authResult.error) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  // Parse request body
  const { question, answer, diagramPrompt } = req.body as GenerateImageRequest;

  if (!question || !answer) {
    res.status(400).json({ error: 'Missing question or answer' });
    return;
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    res.status(500).json({ error: 'Image generation not configured' });
    return;
  }

  // Build prompt for image generation
  // Use diagramPrompt if provided (for diagram card style), otherwise generate from Q&A
  let prompt: string;
  if (diagramPrompt) {
    prompt = `Create a clear, educational diagram based on this description:

${diagramPrompt}

Requirements:
- Create a structured, informative diagram
- Use clean layout with clear visual hierarchy
- Include labeled nodes, arrows, or connections as appropriate
- Use a professional color scheme (blues, grays, subtle accents)
- Make relationships and structure visually clear
- Style: clean, professional, educational diagram`;
  } else {
    prompt = `Create a simple, memorable visual that represents this flashcard concept:

Question: ${question}
Answer: ${answer}

Requirements:
- Create a clear, educational illustration
- Use simple shapes and colors
- Make it memorable and relevant to the concept
- Avoid text in the image
- Style: clean, modern, educational`;
  }

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
        const errorJson = JSON.parse(errorText) as { error?: { message?: string } };
        errorDetail = errorJson.error?.message || errorText;
      } catch {
        errorDetail = errorText;
      }

      if (geminiResponse.status === 429) {
        res.status(429).json({ error: 'rate_limit', message: 'Image generation rate limited' });
        return;
      }

      // Return actual error for debugging
      res.status(geminiResponse.status).json({
        error: 'gemini_api_error',
        message: errorDetail,
        status: geminiResponse.status
      });
      return;
    }

    const data = await geminiResponse.json() as GeminiResponse;

    // Log full response structure for debugging
    console.log('Gemini response structure:', JSON.stringify(data, null, 2));

    // Extract image data from response
    const candidate = data.candidates?.[0];
    if (!candidate) {
      console.error('No candidates in response:', data);
      res.status(500).json({ error: 'No image generated', details: 'No candidates in response' });
      return;
    }

    // Log candidate parts for debugging
    console.log('Candidate parts:', JSON.stringify(candidate.content?.parts, null, 2));

    // Find the inlineData part with the image (Gemini API uses camelCase)
    const imagePart = candidate.content?.parts?.find(
      part => part.inlineData?.mimeType?.startsWith('image/')
    );

    if (!imagePart || !imagePart.inlineData) {
      // Return what we got for debugging
      const partTypes = candidate.content?.parts?.map(p =>
        p.text ? 'text' : p.inlineData ? `inlineData(${p.inlineData.mimeType})` : 'unknown'
      );
      console.error('No image part found. Part types:', partTypes);
      res.status(500).json({
        error: 'No image in response',
        partTypes: partTypes,
        finishReason: candidate.finishReason
      });
      return;
    }

    res.status(200).json({
      imageData: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType
    });

  } catch (error) {
    console.error('Error generating image:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
