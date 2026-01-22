// POST /api/generate-cards
// Proxies Claude API calls with server-side API key

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildPersonaPrompt } from '../lib/prompts.js';
import { authenticateRequest, checkUsageLimit, isAuthError } from '../lib/auth.js';
import { incrementCardCount } from '../lib/supabase-admin.js';
import type { GenerateCardsRequest, GeneratedCard, UserProfile } from '../lib/types.js';
import type { ClaudeResponse } from '../lib/claude-types.js';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

/**
 * Build the system prompt based on user's subscription status and learning profile
 * Pro users get access to the diagram card style
 * Learning profile adds personalization context
 */
function buildSystemPrompt(isPro: boolean, profile?: UserProfile): string {
  // Build persona prompt from learning profile
  const personaPrompt = buildPersonaPrompt({
    primaryCategory: profile?.primary_category,
    studentLevel: profile?.student_level,
    studentField: profile?.student_field,
    workFields: profile?.work_fields,
    workFieldOther: profile?.work_field_other,
    workYearsExperience: profile?.work_years_experience,
    researchField: profile?.research_field,
    researchYearsExperience: profile?.research_years_experience,
    additionalInterests: profile?.additional_interests,
    additionalInterestsOther: profile?.additional_interests_other,
    spacedRepExperience: profile?.spaced_rep_experience,
    technicalityPreference: profile?.technicality_preference,
    breadthPreference: profile?.breadth_preference,
  });
  const diagramStyle = isPro ? `
7. **diagram** - For STRUCTURAL or COMPARATIVE knowledge that benefits from visual representation.
   When to use: taxonomies, hierarchies, system architectures, X vs Y comparisons, process flows
   The diagram_prompt describes what image to generate - be specific about layout, relationships, and visual structure.
   Example:
   {"style":"diagram","question":"What are the two main branches of supervised learning?","answer":"Classification (predicts categories) and Regression (predicts continuous values)","diagram_prompt":"A tree diagram with 'Supervised Learning' at the top, branching into two nodes: 'Classification' (with examples: spam detection, image recognition) and 'Regression' (with examples: price prediction, temperature forecasting)","tags":{"content_type":"concept","domain":"machine_learning","technicality":2}}
` : '';

  return `You are a spaced repetition card generator. Create cards that produce durable understanding through retrieval practice.
${personaPrompt}

**Card Styles (choose the most appropriate for each piece of knowledge):**

1. **qa** - Direct factual question for single facts
   Example:
   {"style":"qa","question":"What type of chicken parts are used in stock?","answer":"Bones","tags":{"content_type":"fact","domain":"cooking","technicality":1}}

2. **qa_bidirectional** - For DEFINITIONS where both directions are useful. Generates forward (term→definition) and reverse (definition→term). Counts as ONE card toward the 2-4 target.
   ALWAYS use this style when the text defines a term, concept, or introduces vocabulary.
   Example:
   {"style":"qa_bidirectional","forward":{"question":"What is photosynthesis?","answer":"The process by which plants convert light energy into chemical energy"},"reverse":{"question":"What biological process describes plants converting light energy into chemical energy?","answer":"Photosynthesis"},"tags":{"content_type":"definition","domain":"biology","technicality":2}}

3. **cloze** - Single fill-in-the-blank for key terms or relationships
   Example:
   {"style":"cloze","question":"The mitochondria is the ___ of the cell","answer":"powerhouse","tags":{"content_type":"fact","domain":"biology","technicality":1}}

4. **cloze_list** - For CLOSED LISTS with fixed, known members. Creates N+1 clozes: one per item PLUS a final "recall all" card. Counts as ONE card in UI but expands to N+1 on save.
   For N items: first N prompts each occlude ONE item, final prompt occludes ALL items.
   Example (3 items → 4 prompts):
   {"style":"cloze_list","list_name":"Primary colors","items":["red","blue","yellow"],"prompts":[{"question":"Primary colors: ___, blue, yellow","answer":"red"},{"question":"Primary colors: red, ___, yellow","answer":"blue"},{"question":"Primary colors: red, blue, ___","answer":"yellow"},{"question":"Primary colors: ___, ___, ___","answer":"red, blue, yellow"}],"tags":{"content_type":"list","domain":"art","technicality":1}}

5. **explanation** - "Why" or "How" questions connecting facts to deeper meaning
   Example:
   {"style":"explanation","question":"Why are bones used instead of meat for making stock?","answer":"Bones contain collagen which converts to gelatin, giving the stock body and richness","tags":{"content_type":"concept","domain":"cooking","technicality":2}}

6. **application** - Connect knowledge to real-world situations or decision-making
   Example:
   {"style":"application","question":"When cooking a savory dish with water, what should you consider using instead?","answer":"Stock, as it adds depth and flavor","tags":{"content_type":"procedure","domain":"cooking","technicality":1}}
${diagramStyle}
**Tags (always include all three):**
- content_type: "definition" | "fact" | "concept" | "procedure" | "list"
- domain: infer from context (e.g., "biology", "cooking", "programming", "machine_learning", "history")
- technicality: 1 | 2 | 3 | 4
  - 1 = Intuitive (early high school or before): simple analogies, everyday language, no jargon
  - 2 = Foundational (high school): basic terminology, concepts explained accessibly
  - 3 = College: technical terminology, specific details, assumes foundational knowledge
  - 4 = Graduate: expert precision, formulas, quantitative details, assumes deep background

**Critical Rules:**
- Generate 2-4 cards total (qa_bidirectional and cloze_list each count as ONE card)
- ALWAYS use qa_bidirectional when text contains a definition (X is Y, X means Y, X refers to Y)
- Use cloze_list for enumerated lists with fixed membership
- Prioritize the most important knowledge, not exhaustive coverage
- Tags help organization - always include content_type, domain, and technicality

**Output Format:**
Return ONLY valid JSON, no markdown code blocks:
{"cards":[...]}`;
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
  const { selection, context, url, title, focusText, customPrompt } = req.body as GenerateCardsRequest;

  if (!selection) {
    res.status(400).json({ error: 'Missing selection text' });
    return;
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

  // Determine if user is Pro (for diagram feature access)
  const isPro = profile.subscription_status === 'active' || profile.subscription_status === 'admin';

  // Use custom prompt or build based on subscription status and learning profile
  const systemPrompt = customPrompt || buildSystemPrompt(isPro, profile);

  try {
    // Call Claude API with server-side key
    const claudeResponse = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY || '',
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
        res.status(500).json({ error: 'API configuration error' });
        return;
      }
      if (claudeResponse.status === 429) {
        res.status(429).json({ error: 'rate_limit', message: 'Too many requests, please try again later' });
        return;
      }

      res.status(500).json({ error: 'Failed to generate cards' });
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

    const parsed = JSON.parse(jsonStr) as { cards: GeneratedCard[] };

    if (!parsed.cards || !Array.isArray(parsed.cards)) {
      res.status(500).json({ error: 'Invalid response format from AI' });
      return;
    }

    // Increment usage count (number of cards generated)
    await incrementCardCount(user.id, parsed.cards.length);

    // Return cards with updated usage info and subscription status
    res.status(200).json({
      cards: parsed.cards,
      isPro,
      usage: {
        remaining: usage.remaining === Infinity ? 'unlimited' : usage.remaining - parsed.cards.length,
        limit: usage.limit,
        subscription: profile.subscription_status
      }
    });

  } catch (error) {
    console.error('Error generating cards:', error);

    if (error instanceof SyntaxError) {
      res.status(500).json({ error: 'Failed to parse AI response' });
      return;
    }

    res.status(500).json({ error: 'Internal server error' });
  }
}
