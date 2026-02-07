// POST /api/refine-card
// Refines a single card using a lightweight model

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, checkUsageLimit, isAuthError } from '../lib/auth.js';
import { incrementCardCount } from '../lib/supabase-admin.js';
import type { GeneratedCard } from '../lib/types.js';
import type { ClaudeResponse } from '../lib/claude-types.js';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';

type RefinementAction = 'rephrase' | 'simplify' | 'harder';

interface RefineCardRequest {
  card: GeneratedCard;
  refinementAction: RefinementAction;
  sourceSelection?: string;
  sourceContext?: string;
}

const ACTION_INSTRUCTIONS: Record<RefinementAction, string> = {
  rephrase: 'Rephrase the question and answer differently while testing the same knowledge. Use different wording, framing, or angle.',
  simplify: 'Break this into a more atomic, easier-to-answer card. Simplify the language and narrow the scope.',
  harder: 'Make this card require deeper recall or application. Increase specificity, ask "why" or "how" instead of "what".',
};

function buildRefinePrompt(action: RefinementAction): string {
  return `You are refining a single spaced repetition flashcard. ${ACTION_INSTRUCTIONS[action]}

Return ONLY valid JSON with the refined card in the exact same format as the input card. Preserve the style and tags. Do not add explanation.
Output format: {"card":{...}}`;
}

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

  const { user, profile } = authResult;

  const usage = checkUsageLimit(profile);
  if (!usage.allowed) {
    res.status(402).json({
      error: 'usage_limit_reached',
      message: `You've used all ${usage.limit} free cards this month. Upgrade to Pro for unlimited cards.`,
    });
    return;
  }

  const { card, refinementAction, sourceSelection, sourceContext } = req.body as RefineCardRequest;

  if (!card || !refinementAction) {
    res.status(400).json({ error: 'Missing card or refinementAction' });
    return;
  }

  if (!['rephrase', 'simplify', 'harder'].includes(refinementAction)) {
    res.status(400).json({ error: 'Invalid refinementAction' });
    return;
  }

  let userMessage = `**Original card:**\n${JSON.stringify(card, null, 2)}`;
  if (sourceSelection) {
    userMessage += `\n\n**Source text:** ${sourceSelection}`;
  }
  if (sourceContext) {
    userMessage += `\n\n**Surrounding context:** ${sourceContext}`;
  }
  userMessage += '\n\nRefine this card according to the instructions.';

  try {
    const claudeResponse = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 500,
        system: buildRefinePrompt(refinementAction),
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error('Claude API error:', claudeResponse.status, errorText);

      if (claudeResponse.status === 429) {
        res.status(429).json({ error: 'rate_limit', message: 'Too many requests, please try again later' });
        return;
      }
      res.status(500).json({ error: 'Failed to refine card' });
      return;
    }

    const data = await claudeResponse.json() as ClaudeResponse;
    const content = data.content?.[0]?.text;
    if (!content) {
      res.status(500).json({ error: 'Empty response from AI' });
      return;
    }

    let jsonStr = content.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(jsonStr) as { card: GeneratedCard };
    if (!parsed.card) {
      res.status(500).json({ error: 'Invalid response format from AI' });
      return;
    }

    await incrementCardCount(user.id, 1);

    res.status(200).json({ card: parsed.card });
  } catch (error) {
    console.error('Error refining card:', error);

    if (error instanceof SyntaxError) {
      res.status(500).json({ error: 'Failed to parse AI response' });
      return;
    }

    res.status(500).json({ error: 'Internal server error' });
  }
}
