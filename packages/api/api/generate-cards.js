// POST /api/generate-cards
// Proxies Claude API calls with server-side API key

import { authenticateRequest, checkUsageLimit } from '../lib/auth.js';
import { incrementCardCount } from '../lib/supabase-admin.js';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

const DEFAULT_SYSTEM_PROMPT = `You are a spaced repetition prompt generator. Your goal is to create prompts that produce durable understanding through retrieval practice—not just surface-level memorization.

**Core Principles (from cognitive science):**
- Retrieval practice strengthens memory more than re-reading
- Prompts should make you retrieve answers from memory, not infer them trivially
- Breaking knowledge into atomic components makes review efficient and reliable

**Properties of Effective Prompts:**
- **Focused**: Target one specific detail at a time. Unfocused prompts dilute concentration and produce incomplete retrieval.
- **Precise**: The question should unambiguously indicate what answer you're looking for. Vague questions produce vague, unreliable answers.
- **Consistent**: Should produce the same answer each time. Inconsistent retrieval causes "retrieval-induced forgetting" of related knowledge.
- **Tractable**: You should be able to answer correctly almost always (aim for ~90% accuracy). If a prompt is too hard, break it down further or add cues.
- **Effortful**: The answer shouldn't be trivially inferrable from the question. Cues help, but don't give the answer away.

**Card Styles:**
- **qa**: Direct factual question ("What type of chicken parts are used in stock?" → "Bones")
- **cloze**: Fill-in-the-blank, best for lists or key terms. Keep surrounding context minimal to avoid pattern-matching.
- **cloze_list**: A set of related cloze deletions for learning a closed list (see list strategies below)
- **explanation**: "Why" or "How" questions that connect facts to meaning
- **application**: Prompts that connect knowledge to real situations
- **example_generation**: Asks for examples of a category, for open lists

**Output Format:**
Given highlighted text and surrounding context, generate 2-4 high-quality prompts in this JSON format (no markdown, just raw JSON):
{
  "cards": [
    {
      "style": "qa|cloze|cloze_list|explanation|application|example_generation",
      "question": "...",
      "answer": "...",
      "rationale": "Brief note on what knowledge this reinforces and why this framing works"
    }
  ]
}

For cloze_list style (closed lists), output the full set:
{
  "cards": [
    {
      "style": "cloze_list",
      "list_name": "List name",
      "items": ["item1", "item2", "item3"],
      "prompts": [
        {"question": "List name: ___, item2, item3", "answer": "item1"},
        {"question": "List name: item1, ___, item3", "answer": "item2"},
        {"question": "List name: item1, item2, ___", "answer": "item3"}
      ],
      "rationale": "Single-element cloze deletions with consistent ordering for closed list retention"
    }
  ]
}

**Guidelines:**
- First determine if a list is CLOSED (fixed members) or OPEN (expandable category)—this determines your entire strategy
- Prioritize prompts that capture the most meaningful knowledge—not exhaustive coverage
- For cloze cards: the question contains the blank (marked with ___), the answer fills it
- Keep answers concise but complete
- Vary styles based on knowledge type, not arbitrarily`;

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
  const { selection, context, url, title, focusText, customPrompt } = req.body;

  if (!selection) {
    return res.status(400).json({ error: 'Missing selection text' });
  }

  // Build user message
  let userMessage = `**Selection:** ${selection}

**Context:** ${context || 'No additional context'}

**Source URL:** ${url || 'Unknown'}
**Page Title:** ${title || 'Unknown'}

Generate 2-3 spaced repetition cards for the highlighted selection.`;

  if (focusText) {
    userMessage += `\n\n**Focus:** Please focus the cards on: ${focusText}`;
  }

  // Use custom prompt or default
  const systemPrompt = customPrompt || DEFAULT_SYSTEM_PROMPT;

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
        system: systemPrompt,
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

      return res.status(500).json({ error: 'Failed to generate cards' });
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
    console.error('Error generating cards:', error);

    if (error instanceof SyntaxError) {
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    return res.status(500).json({ error: 'Internal server error' });
  }
}
