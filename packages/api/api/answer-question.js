// POST /api/answer-question
// Generates an answer for a user-typed question, optionally improving the question

import { authenticateRequest, checkUsageLimit } from '../lib/auth.js';
import { incrementCardCount } from '../lib/supabase-admin.js';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

const SYSTEM_PROMPT = `You are a knowledge assistant that generates spaced repetition flashcards from user questions.

Your task:
1. Generate 2-4 flashcards based on the user's question
2. The FIRST card should directly answer what the user asked (optionally refined for clarity)
3. Additional cards should explore RELATED aspects the user might find valuable:
   - Underlying concepts or principles
   - Common misconceptions
   - Practical applications
   - Related facts or comparisons
4. If the user's question is vague, improve it for flashcard testability

Card Styles:
- **qa** - Direct factual Q&A
- **explanation** - "Why" or "How" questions for deeper understanding
- **application** - Real-world usage or decision-making

Guidelines:
- First card: Direct answer to user's question (refined if needed)
- Additional cards: Related knowledge the user would benefit from
- Keep answers concise (1-3 sentences)
- Include content_type and domain tags on all cards

Output Format (JSON only, no markdown code blocks):
{
  "cards": [
    {
      "question": "the question",
      "answer": "the answer",
      "style": "qa|explanation|application",
      "originalQuestion": "user's original question (only on first card, only if refined)",
      "wasImproved": true or false (only on first card),
      "tags": { "content_type": "fact|concept|procedure|definition", "domain": "inferred domain" }
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
  const { question, url, title } = req.body;

  if (!question || question.trim().length < 3) {
    return res.status(400).json({ error: 'Question is required (minimum 3 characters)' });
  }

  // Build user message with optional context
  let userMessage = `**Question:** ${question.trim()}`;

  if (url || title) {
    userMessage += `\n\n**Page Context:**`;
    if (title) userMessage += `\n- Page Title: ${title}`;
    if (url) userMessage += `\n- URL: ${url}`;
    userMessage += `\n\nUse this context to infer the domain and provide a more relevant answer.`;
  }

  try {
    // Call Claude API with server-side key
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
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: userMessage
          }
        ]
      })
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error('Claude API error:', claudeResponse.status, errorText);

      if (claudeResponse.status === 401) {
        return res.status(500).json({ error: 'API configuration error' });
      }
      if (claudeResponse.status === 429) {
        return res.status(429).json({ error: 'rate_limit', message: 'Too many requests, please try again later' });
      }

      return res.status(500).json({ error: 'Failed to generate answer' });
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

    if (!parsed.cards || !Array.isArray(parsed.cards) || parsed.cards.length === 0) {
      return res.status(500).json({ error: 'Invalid response format from AI' });
    }

    // Increment usage count by number of cards generated
    await incrementCardCount(user.id, parsed.cards.length);

    // Return cards with usage info
    return res.status(200).json({
      cards: parsed.cards,
      usage: {
        remaining: usage.remaining === Infinity ? 'unlimited' : usage.remaining - parsed.cards.length,
        limit: usage.limit,
        subscription: profile.subscription_status
      }
    });

  } catch (error) {
    console.error('Error generating answer:', error);

    if (error instanceof SyntaxError) {
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    return res.status(500).json({ error: 'Internal server error' });
  }
}
