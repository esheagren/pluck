import type { ClaudeResponse } from './claude-types.js';

// Model IDs live here so a retired model is a one-line change (or an env override), not an outage.
export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5';
export const CLAUDE_FAST_MODEL = process.env.CLAUDE_FAST_MODEL || 'claude-haiku-4-5';

/** The response's text, ignoring thinking blocks (current models emit those before the text). */
export function responseText(data: ClaudeResponse): string | undefined {
  const text = data.content?.find((block) => block.type === 'text')?.text;
  return text?.trim() || undefined;
}

/** JSON object embedded in model output, tolerating code fences and prose around it. */
export function extractJson(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return start >= 0 && end > start ? text.slice(start, end + 1) : text;
}
