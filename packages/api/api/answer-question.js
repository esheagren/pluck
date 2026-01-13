// POST /api/answer-question
// Generates an answer for a user-typed question, optionally improving the question

import { authenticateRequest, checkUsageLimit } from '../lib/auth.js';
import { incrementCardCount } from '../lib/supabase-admin.js';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

const SYSTEM_PROMPT = `You are a knowledge assistant that answers questions for flashcard creation.

Your task:
1. If the question is vague, too broad, or could be improved for flashcard use, provide an improved version
2. Provide a clear, concise answer suitable for a flashcard (1-3 sentences)
3. Identify the content type and domain

Guidelines for question improvement:
- Add specificity if the question is too broad (e.g., "What is it?" → "What is [specific thing from context]?")
- Add context if the question is ambiguous
- Rephrase for testability (the answer should be verifiable)
- Keep the user's intent intact
- If the question is already clear and specific, don't change it

Guidelines for answers:
- Be concise but complete (1-3 sentences ideal)
- Include the key fact, concept, or explanation
- Avoid unnecessary hedging or qualifications
- Be factually accurate

Output Format (JSON only, no markdown code blocks):
{
  "originalQuestion": "user's exact original question",
  "improvedQuestion": "improved version (or same as original if no improvement needed)",
  "wasImproved": true or false,
  "answer": "the answer to the question",
  "contentType": "fact|concept|procedure|definition",
  "domain": "inferred domain like biology, programming, history, etc."
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

    if (!parsed.answer) {
      return res.status(500).json({ error: 'Invalid response format from AI' });
    }

    // Increment usage count by 1 (single card)
    await incrementCardCount(user.id, 1);

    // Build card response
    const card = {
      originalQuestion: parsed.originalQuestion || question.trim(),
      question: parsed.improvedQuestion || parsed.originalQuestion || question.trim(),
      answer: parsed.answer,
      wasImproved: parsed.wasImproved || false,
      style: 'qa',
      tags: {
        content_type: parsed.contentType || 'fact',
        domain: parsed.domain || 'general'
      }
    };

    // Return card with usage info
    return res.status(200).json({
      card,
      usage: {
        remaining: usage.remaining === Infinity ? 'unlimited' : usage.remaining - 1,
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
