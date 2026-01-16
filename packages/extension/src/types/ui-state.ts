/**
 * UI State Types
 * Defines types for UI state management in sidepanel and popup
 */

import type { GeneratedCard, UsageInfo } from './messages';

// UI mode states
export type UIMode =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'screenshot'
  | 'cards'
  | 'auth-required'
  | 'usage-limit'
  | 'error';

// Sidepanel state
export interface SidepanelState {
  mode: UIMode;
  cards: GeneratedCard[];
  selectedIndices: Set<number>;
  editedCards: Record<number, EditedCard>;
  sourceUrl: string;
  error?: string;
  isImageMode: boolean;
  isQuestionMode: boolean;
  mochiConfigured: boolean;
}

// Edited card content
export interface EditedCard {
  question?: string;
  answer?: string;
  // For bidirectional cards
  forwardQuestion?: string;
  forwardAnswer?: string;
  reverseQuestion?: string;
  reverseAnswer?: string;
}

// Popup state
export interface PopupState {
  mode: UIMode;
  cards: GeneratedCard[];
  selectedIndex: number;
  editedCards: Record<number, EditedCard>;
  sourceUrl: string;
  mochiConfigured: boolean;
}

// Card to be saved (with edits applied)
export interface CardToSave {
  question: string;
  answer: string;
  style: string;
  tags?: string[];
  direction?: 'forward' | 'reverse';
  list_name?: string;
  diagram_prompt?: string;
  generateDiagram?: boolean;
}

// Profile display state
export interface ProfileDisplayState {
  isPro: boolean;
  cardsUsed: number;
  cardsLimit: number;
  percentageUsed: number;
}

// Auth display state
export interface AuthDisplayState {
  isAuthenticated: boolean;
  userEmail?: string;
}

// Usage update from API response
export interface UsageUpdate {
  usage?: UsageInfo;
  subscription?: {
    isPro: boolean;
    status?: string;
  };
}

// Card style labels for display
export const CARD_STYLE_LABELS: Record<string, string> = {
  qa: 'Q&A',
  cloze: 'Cloze',
  conceptual: 'Conceptual',
  definition: 'Definition',
  example: 'Example',
  explanation: 'Explanation',
  application: 'Application',
  diagram: 'Diagram',
  qa_bidirectional: 'Bidirectional',
  cloze_list: 'List',
};

/**
 * Format a card style for display
 */
export function formatStyleLabel(style: string): string {
  return CARD_STYLE_LABELS[style] || style;
}
