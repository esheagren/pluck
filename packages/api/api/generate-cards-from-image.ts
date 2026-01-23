// POST /api/generate-cards-from-image
// Uses Claude Sonnet vision to analyze screenshots and generate flashcards

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, checkUsageLimit, isAuthError } from '../lib/auth.js';
import { incrementCardCount } from '../lib/supabase-admin.js';
import type { GenerateCardsFromImageRequest, GeneratedCard } from '../lib/types.js';
import type { ClaudeResponse } from '../lib/claude-types.js';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

const VISION_SYSTEM_PROMPT = `You are a spaced repetition prompt generator that analyzes images (screenshots, diagrams, handwritten notes, textbook photos) to create effective flashcards.

Users do not have access to the image that you are analyzing. Your questions must therefore be about the content of the image, not the image itself. Therefore do not refer to "the image" or "the screenshot" in your questions. The questions should be about the content of the image.

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
- Generate 4-8 cards that capture the key concepts thoroughly, depending on the complexity and richness of the content

**CRITICAL: Output ONLY valid JSON, nothing else. No explanations, no descriptions, no markdown.**

Output format:
{"cards":[{"style":"qa|cloze|explanation|application","question":"...","answer":"...","rationale":"..."}]}`;

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

  const { user, profile } = authResult;

  // Check usage limits
  const usage = checkUsageLimit(profile);
  if (!usage.allowed) {
    res.status(402).json({
      error: 'usage_limit_reached',
      message: `You've used all ${usage.limit} free cards this month. Upgrade to Pro for unlimited cards.`,
      remaining: 0,
      limit: usage.limit
    });
    return;
  }

  // Parse request body
  const { imageData, mimeType, focusText, pageContext } = req.body as GenerateCardsFromImageRequest;

  if (!imageData || !mimeType) {
    res.status(400).json({ error: 'Missing image data or mime type' });
    return;
  }

  // Validate mime type
  const validMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!validMimeTypes.includes(mimeType)) {
    res.status(400).json({ error: 'Invalid image type. Supported: JPEG, PNG, GIF, WebP' });
    return;
  }

  // Build user message
  let userMessage = 'Analyze this image and generate 4-8 spaced repetition flashcards depending on the complexity of the content. Output ONLY JSON.';
  if (focusText) {
    userMessage += ` Focus on: ${focusText}`;
  }

  // Add page context information if provided
  if (pageContext?.domContext) {
    const { domContext } = pageContext;
    userMessage += '\n\n**Page Context (from where the screenshot was taken):**';
    if (domContext.title) {
      userMessage += `\nPage title: ${domContext.title}`;
    }
    if (domContext.headings.length > 0) {
      userMessage += `\nVisible headings: ${domContext.headings.join(' > ')}`;
    }
    if (domContext.visibleText) {
      userMessage += `\nVisible text excerpt: ${domContext.visibleText.substring(0, 800)}`;
    }
    userMessage += '\n\nUse this context to understand what topic or concept the screenshot relates to.';
  }

  // Build message content array
  interface ImageContent {
    type: 'image';
    source: {
      type: 'base64';
      media_type: string;
      data: string;
    };
  }

  interface TextContent {
    type: 'text';
    text: string;
  }

  type MessageContent = ImageContent | TextContent;
  const messageContent: MessageContent[] = [];

  // Add the main screenshot
  messageContent.push({
    type: 'image',
    source: {
      type: 'base64',
      media_type: mimeType,
      data: imageData
    }
  });

  // Add viewport screenshot if provided (shows the page context visually)
  if (pageContext?.viewportScreenshot) {
    messageContent.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: pageContext.viewportScreenshot.mimeType,
        data: pageContext.viewportScreenshot.imageData
      }
    });
  }

  // Add the text message
  messageContent.push({
    type: 'text',
    text: userMessage
  });

  try {
    // Call Claude API with vision
    const claudeResponse = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 2500,
        system: VISION_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: messageContent
          },
          {
            role: 'assistant',
            content: '{"cards":['
          }
        ]
      })
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error('Claude Vision API error:', claudeResponse.status, errorText);

      if (claudeResponse.status === 401) {
        res.status(500).json({ error: 'API configuration error' });
        return;
      }
      if (claudeResponse.status === 429) {
        res.status(429).json({ error: 'rate_limit', message: 'Too many requests, please try again later' });
        return;
      }

      res.status(500).json({ error: 'Failed to analyze image' });
      return;
    }

    const data = await claudeResponse.json() as ClaudeResponse;

    // Extract text content from Claude's response
    const content = data.content?.[0]?.text;
    if (!content) {
      res.status(500).json({ error: 'Empty response from AI' });
      return;
    }

    // Claude continues from the prefill '{"cards":[', so prepend it
    let jsonStr = '{"cards":[' + content.trim();

    // Handle if Claude still wrapped in code blocks
    if (jsonStr.includes('```')) {
      jsonStr = jsonStr.replace(/```(?:json)?\n?/g, '').replace(/\n?```/g, '');
    }

    const parsed = JSON.parse(jsonStr) as { cards: GeneratedCard[] };

    if (!parsed.cards || !Array.isArray(parsed.cards)) {
      res.status(500).json({ error: 'Invalid response format from AI' });
      return;
    }

    // Increment usage count (number of cards generated)
    await incrementCardCount(user.id, parsed.cards.length);

    // Return cards with updated usage info
    res.status(200).json({
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
      console.error('JSON parse error. Raw content from Claude may have been malformed.');
      res.status(500).json({ error: 'Failed to parse AI response. Please try again.' });
      return;
    }

    res.status(500).json({ error: 'Internal server error' });
  }
}
