// POST /api/onboarding/example-question
// Generates a personalized example question for the technicality preference step

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, isAuthError } from '../../lib/auth.js';
import type { ClaudeResponse } from '../../lib/claude-types.js';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';

// Input validation constants
const MAX_FIELD_LENGTH = 100;
const VALID_CATEGORIES = ['student', 'worker', 'researcher'] as const;
const VALID_YEARS = ['1-2', '3-5', '6-10', '10+'] as const;

interface ExampleQuestionRequest {
  primaryCategory: 'student' | 'worker' | 'researcher';
  field: string;
  yearsExperience?: string;
}

interface ExampleQuestionResponse {
  question: string;
  answers: {
    intuitive: string;
    conceptual: string;
    detailed: string;
    technical: string;
  };
}

/**
 * Sanitize user input to prevent prompt injection
 */
function sanitizeInput(input: string): string {
  return input
    .replace(/[<>\"'`]/g, '') // Remove potentially dangerous characters
    .trim()
    .slice(0, MAX_FIELD_LENGTH);
}

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

  const { primaryCategory, field, yearsExperience } = req.body as ExampleQuestionRequest;

  // Validate primaryCategory
  if (!primaryCategory || !VALID_CATEGORIES.includes(primaryCategory)) {
    res.status(400).json({ error: 'Invalid primaryCategory. Must be student, worker, or researcher.' });
    return;
  }

  // Validate and sanitize field
  if (!field || typeof field !== 'string' || field.trim().length === 0) {
    res.status(400).json({ error: 'Field is required and must be a non-empty string.' });
    return;
  }

  const sanitizedField = sanitizeInput(field);
  if (sanitizedField.length === 0) {
    res.status(400).json({ error: 'Field contains only invalid characters.' });
    return;
  }

  // Validate yearsExperience if provided
  if (yearsExperience && !VALID_YEARS.includes(yearsExperience as typeof VALID_YEARS[number])) {
    res.status(400).json({ error: 'Invalid yearsExperience. Must be 1-2, 3-5, 6-10, or 10+.' });
    return;
  }

  // Build context for the prompt
  let userContext = '';
  if (primaryCategory === 'student') {
    userContext = `a student studying ${sanitizedField}`;
  } else if (primaryCategory === 'worker') {
    userContext = `a professional working in ${sanitizedField}${yearsExperience ? ` with ${yearsExperience} years of experience` : ''}`;
  } else if (primaryCategory === 'researcher') {
    userContext = `a researcher in ${sanitizedField}${yearsExperience ? ` with ${yearsExperience} years of experience` : ''}`;
  }

  const systemPrompt = `You generate example flashcard questions to help users understand different technicality levels.

Given a user's background, create ONE question relevant to their field, then provide 4 answers at different technicality levels:

1. **Intuitive**: Uses analogies and everyday language. No jargon. A curious beginner could understand.
2. **Conceptual**: Explains mechanisms and relationships. Some field terminology but accessible.
3. **Detailed**: Uses specific terminology, includes numbers/specifics where relevant. College-level understanding assumed.
4. **Technical**: Expert-level precision. Assumes deep domain knowledge. May include formulas or precise values.

IMPORTANT:
- The question should be fundamental to the field but interesting
- Each answer should be 1-3 sentences (technical level may include formulas or precise values)
- The answers should all be correct, just at different levels of detail
- Make the progression feel natural and educational

Return ONLY valid JSON in this exact format:
{"question":"...","answers":{"intuitive":"...","conceptual":"...","detailed":"...","technical":"..."}}`;

  const userMessage = `The user is ${userContext}.

Generate a relevant example question for their field with 4 answers at different technicality levels.`;

  try {
    const claudeResponse = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1500,
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
      // Log only status code, not full error to avoid leaking sensitive info
      console.error('Claude API error:', claudeResponse.status);
      res.status(500).json({ error: 'Failed to generate example question' });
      return;
    }

    const data = await claudeResponse.json() as ClaudeResponse;

    // Extract text content from Claude's response
    const content = data.content?.[0]?.text;
    if (!content) {
      res.status(500).json({ error: 'Empty response from AI' });
      return;
    }

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(jsonStr) as ExampleQuestionResponse;

    // Validate response structure
    if (!parsed.question || typeof parsed.question !== 'string' ||
        !parsed.answers || typeof parsed.answers !== 'object' ||
        !parsed.answers.intuitive || !parsed.answers.conceptual ||
        !parsed.answers.detailed || !parsed.answers.technical) {
      console.error('Invalid response format from AI');
      res.status(500).json({ error: 'Invalid response format from AI' });
      return;
    }

    res.status(200).json(parsed);

  } catch (error) {
    console.error('Error generating example question:', error instanceof Error ? error.message : 'Unknown error');

    if (error instanceof SyntaxError) {
      res.status(500).json({ error: 'Failed to parse AI response' });
      return;
    }

    res.status(500).json({ error: 'Internal server error' });
  }
}
