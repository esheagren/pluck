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
  const { question, answer, sourceUrl, diagramPrompt } = req.body;

  if (!question || !answer) {
    return res.status(400).json({ error: 'Missing question or answer' });
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    return res.status(500).json({ error: 'Image generation not configured' });
  }

  // Build prompt for image generation
  // Use diagramPrompt if provided (for diagram card style), otherwise generate from Q&A
  let prompt;
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

    // Log full response structure for debugging
    console.log('Gemini response structure:', JSON.stringify(data, null, 2));

    // Extract image data from response
    const candidate = data.candidates?.[0];
    if (!candidate) {
      console.error('No candidates in response:', data);
      return res.status(500).json({ error: 'No image generated', details: 'No candidates in response' });
    }

    // Log candidate parts for debugging
    console.log('Candidate parts:', JSON.stringify(candidate.content?.parts, null, 2));

    // Find the inlineData part with the image (Gemini API uses camelCase)
    const imagePart = candidate.content?.parts?.find(
      part => part.inlineData?.mimeType?.startsWith('image/')
    );

    if (!imagePart) {
      // Return what we got for debugging
      const partTypes = candidate.content?.parts?.map(p =>
        p.text ? 'text' : p.inlineData ? `inlineData(${p.inlineData.mimeType})` : 'unknown'
      );
      console.error('No image part found. Part types:', partTypes);
      return res.status(500).json({
        error: 'No image in response',
        partTypes: partTypes,
        finishReason: candidate.finishReason
      });
    }

    return res.status(200).json({
      imageData: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType
    });

  } catch (error) {
    console.error('Error generating image:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
