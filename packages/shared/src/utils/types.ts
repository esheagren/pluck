/**
 * Type definitions for utility functions
 */

/**
 * Card object with question and answer
 */
export interface SimpleCard {
  question: string;
  answer: string;
}

/**
 * Options for formatting a card for Mochi
 */
export interface FormatOptions {
  /** Whether to include the source URL */
  includeSource?: boolean;
  /** Source URL to include */
  sourceUrl?: string;
}
