// POST /api/generate-cards
// Proxies Claude API calls with server-side API key

import { authenticateRequest, checkUsageLimit } from '../lib/auth.js';
import { incrementCardCount } from '../lib/supabase-admin.js';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

/**
 * Build the system prompt based on user's subscription status
 * Pro users get access to the diagram card style
 */
function buildSystemPrompt(isPro) {
  const diagramStyle = isPro ? `
7. **diagram** - For STRUCTURAL or COMPARATIVE knowledge that benefits from visual representation.
   When to use: taxonomies, hierarchies, system architectures, X vs Y comparisons, process flows
   The diagram_prompt describes what image to generate - be specific about layout, relationships, and visual structure.
   Example:
   {"style":"diagram","question":"What are the two main branches of supervised learning?","answer":"Classification (predicts categories) and Regression (predicts continuous values)","diagram_prompt":"A tree diagram with 'Supervised Learning' at the top, branching into two nodes: 'Classification' (with examples: spam detection, image recognition) and 'Regression' (with examples: price prediction, temperature forecasting)","tags":{"content_type":"concept","domain":"machine_learning"}}
` : '';

  return `You are a spaced repetition card generator. Create cards that produce durable understanding through retrieval practice.

**Card Styles (choose the most appropriate for each piece of knowledge):**

1. **qa** - Direct factual question for single facts
   Example:
   {"style":"qa","question":"What type of chicken parts are used in stock?","answer":"Bones","tags":{"content_type":"fact","domain":"cooking"}}

2. **qa_bidirectional** - For DEFINITIONS where both directions are useful. Generates forward (term→definition) and reverse (definition→term). Counts as ONE card toward the 2-4 target.
   ALWAYS use this style when the text defines a term, concept, or introduces vocabulary.
   Example:
   {"style":"qa_bidirectional","forward":{"question":"What is photosynthesis?","answer":"The process by which plants convert light energy into chemical energy"},"reverse":{"question":"What biological process describes plants converting light energy into chemical energy?","answer":"Photosynthesis"},"tags":{"content_type":"definition","domain":"biology"}}

3. **cloze** - Single fill-in-the-blank for key terms or relationships
   Example:
   {"style":"cloze","question":"The mitochondria is the ___ of the cell","answer":"powerhouse","tags":{"content_type":"fact","domain":"biology"}}

4. **cloze_list** - For CLOSED LISTS with fixed, known members. Creates one cloze per item. Counts as ONE card.
   Example:
   {"style":"cloze_list","list_name":"Primary colors","items":["red","blue","yellow"],"prompts":[{"question":"Primary colors: ___, blue, yellow","answer":"red"},{"question":"Primary colors: red, ___, yellow","answer":"blue"},{"question":"Primary colors: red, blue, ___","answer":"yellow"}],"tags":{"content_type":"list","domain":"art"}}

5. **explanation** - "Why" or "How" questions connecting facts to deeper meaning
   Example:
   {"style":"explanation","question":"Why are bones used instead of meat for making stock?","answer":"Bones contain collagen which converts to gelatin, giving the stock body and richness","tags":{"content_type":"concept","domain":"cooking"}}

6. **application** - Connect knowledge to real-world situations or decision-making
   Example:
   {"style":"application","question":"When cooking a savory dish with water, what should you consider using instead?","answer":"Stock, as it adds depth and flavor","tags":{"content_type":"procedure","domain":"cooking"}}
${diagramStyle}
**Tags (always include both):**
- content_type: "definition" | "fact" | "concept" | "procedure" | "list"
- domain: infer from context (e.g., "biology", "cooking", "programming", "machine_learning", "history")

**Critical Rules:**
- Generate 2-4 cards total (qa_bidirectional and cloze_list each count as ONE card)
- ALWAYS use qa_bidirectional when text contains a definition (X is Y, X means Y, X refers to Y)
- Use cloze_list for enumerated lists with fixed membership
- Prioritize the most important knowledge, not exhaustive coverage
- Tags help organization - always include content_type and domain

**Output Format:**
Return ONLY valid JSON, no markdown code blocks:
{"cards":[...]}`;
}


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

  // Determine if user is Pro (for diagram feature access)
  const isPro = profile.subscription_status === 'active' || profile.subscription_status === 'admin';

  // Use custom prompt or build based on subscription status
  const systemPrompt = customPrompt || buildSystemPrompt(isPro);

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

    // Return cards with updated usage info and subscription status
    return res.status(200).json({
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
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    return res.status(500).json({ error: 'Internal server error' });
  }
}
