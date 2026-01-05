// Mochi Markdown Formatter
// Formats flashcards for Mochi's expected markdown format

/**
 * Format a single card for Mochi
 * @param {string} question - The card question
 * @param {string} answer - The card answer
 * @param {string} sourceUrl - The source URL (optional)
 * @returns {string} Mochi-formatted markdown
 */
export function formatForMochi(question, answer, sourceUrl) {
  let markdown = `# ${question}\n---\n${answer}`;

  if (sourceUrl) {
    markdown += `\n\n---\nSource: ${sourceUrl}`;
  }

  return markdown;
}

/**
 * Format a card object for Mochi
 * @param {Object} card - Card object with question and answer
 * @param {string} sourceUrl - The source URL (optional)
 * @returns {string} Mochi-formatted markdown
 */
export function formatCardForMochi(card, sourceUrl) {
  return formatForMochi(card.question, card.answer, sourceUrl);
}
