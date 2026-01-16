// Mochi Markdown Formatter
// Formats flashcards for Mochi's expected markdown format

import type { SimpleCard } from './types';

/**
 * Format a single card for Mochi
 * @param question - The card question
 * @param answer - The card answer
 * @param sourceUrl - The source URL (optional)
 * @returns Mochi-formatted markdown
 */
export function formatForMochi(
  question: string,
  answer: string,
  sourceUrl?: string
): string {
  let markdown = `# ${question}\n---\n${answer}`;

  if (sourceUrl) {
    markdown += `\n\n---\nSource: ${sourceUrl}`;
  }

  return markdown;
}

/**
 * Format a card object for Mochi
 * @param card - Card object with question and answer
 * @param sourceUrl - The source URL (optional)
 * @returns Mochi-formatted markdown
 */
export function formatCardForMochi(card: SimpleCard, sourceUrl?: string): string {
  return formatForMochi(card.question, card.answer, sourceUrl);
}
