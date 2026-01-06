// POST /api/generate-cards-from-image
// Uses Claude Sonnet vision to analyze screenshots and generate flashcards

import { authenticateRequest, checkUsageLimit } from '../lib/auth.js';
import { incrementCardCount } from '../lib/supabase-admin.js';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

const VISION_SYSTEM_PROMPT = `You are a spaced repetition prompt generator that analyzes images (screenshots, diagrams, handwritten notes, textbook photos) to create effective flashcards.

**Core Principles (from cognitive science):**
- Retrieval practice strengthens memory more than re-reading
- Prompts should make you retrieve answers from memory, not infer them trivially
- Breaking knowledge into atomic components makes review efficient and reliable

**Properties of Effective Prompts:**
- **Focused**: Target one specific detail at a time
- **Precise**: The question should unambiguously indicate what answer you're looking for
- **Consistent**: Should produce the same answer each time
- **Tractable**: Aim for ~90% accuracy - if too hard, break it down further
- **Effortful**: The answer shouldn't be trivially inferrable from the question

**Card Styles:**
- **qa**: Direct factual question
- **cloze**: Fill-in-the-blank for key terms
- **explanation**: "Why" or "How" questions that connect facts to meaning
- **application**: Prompts that connect knowledge to real situations

**Guidelines for Images:**
- First describe what type of content you see (diagram, text, handwriting, chart, etc.)
- Extract the key concepts, facts, or relationships
- For diagrams: focus on what the diagram teaches, not just labeling components
- For handwritten notes: extract the key learnings
- For textbook screenshots: identify the main concept being explained
- Generate 2-4 cards that capture the most important knowledge

**Output Format:**
Return JSON (no markdown code blocks):
{
  "cards": [
    {
      "style": "qa|cloze|explanation|application",
      "question": "...",
      "answer": "...",
      "rationale": "Brief note on what knowledge this reinforces"
    }
  ]
}`;

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

  const { user, profile } = authResult;

  // Check usage limits
  const usage = checkUsageLimit(profile);
  if (!usage.allowed) {
    return res.status(402).json({
      error: 'usage_limit_reached',
      message: `You've used all ${usage.limit} free cards this month. Upgrade to Pro for unlimited cards.`,
      remaining: 0,
      limit: usage.limit
    });
  }

  // Parse request body
  const { imageData, mimeType, focusText } = req.body;

  if (!imageData || !mimeType) {
    return res.status(400).json({ error: 'Missing image data or mime type' });
  }

  // Validate mime type
  const validMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!validMimeTypes.includes(mimeType)) {
    return res.status(400).json({ error: 'Invalid image type. Supported: JPEG, PNG, GIF, WebP' });
  }

  // Build user message
  let userMessage = 'Analyze this image and generate 2-4 spaced repetition flashcards based on its content.';
  if (focusText) {
    userMessage += `\n\nPlease focus the cards on: ${focusText}`;
  }

  try {
    // Call Claude API with vision
    const claudeResponse = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        system: VISION_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType,
                  data: imageData
                }
              },
              {
                type: 'text',
                text: userMessage
              }
            ]
          }
        ]
      })
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error('Claude Vision API error:', claudeResponse.status, errorText);

      if (claudeResponse.status === 401) {
        return res.status(500).json({ error: 'API configuration error' });
      }
      if (claudeResponse.status === 429) {
        return res.status(429).json({ error: 'rate_limit', message: 'Too many requests, please try again later' });
      }

      return res.status(500).json({ error: 'Failed to analyze image' });
    }

    const data = await claudeResponse.json();

    // Extract text content from Claude's response
    const content = data.content?.[0]?.text;
    if (!content) {
      return res.status(500).json({ error: 'Empty response from AI' });
    }

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(jsonStr);

    if (!parsed.cards || !Array.isArray(parsed.cards)) {
      return res.status(500).json({ error: 'Invalid response format from AI' });
    }

    // Increment usage count (number of cards generated)
    await incrementCardCount(user.id, parsed.cards.length);

    // Return cards with updated usage info
    return res.status(200).json({
      cards: parsed.cards,
      usage: {
        remaining: usage.remaining === Infinity ? 'unlimited' : usage.remaining - parsed.cards.length,
        limit: usage.limit,
        subscription: profile.subscription_status
      }
    });

  } catch (error) {
    console.error('Error generating cards from image:', error);

    if (error instanceof SyntaxError) {
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    return res.status(500).json({ error: 'Internal server error' });
  }
}
