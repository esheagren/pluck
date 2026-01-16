// Card Types
export type CardStyle =
  | 'qa'
  | 'qa_bidirectional'
  | 'cloze'
  | 'cloze_list'
  | 'conceptual'
  | 'definition'
  | 'example';

export interface BaseCard {
  id?: string;
  style: CardStyle;
  tags?: string[];
  created_at?: string;
}

export interface QACard extends BaseCard {
  style: 'qa';
  question: string;
  answer: string;
}

export interface BidirectionalCard extends BaseCard {
  style: 'qa_bidirectional';
  forward: { question: string; answer: string };
  reverse: { question: string; answer: string };
}

export interface ClozeCard extends BaseCard {
  style: 'cloze';
  text: string;
  cloze_deletions: string[];
}

export interface ClozeListCard extends BaseCard {
  style: 'cloze_list';
  list_name: string;
  items: string[];
  prompts: string[];
}

export type Card = QACard | BidirectionalCard | ClozeCard | ClozeListCard;

// User Types
export interface User {
  id: string;
  email: string;
  created_at: string;
  subscription_tier?: 'free' | 'pro' | 'team';
}

// Deck Types
export interface Deck {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
  card_count?: number;
}

// Review Types
export interface ReviewResult {
  card_id: string;
  quality: 0 | 1 | 2 | 3 | 4 | 5;
  reviewed_at: string;
}

// SM-2 Algorithm Types
export interface SM2State {
  easiness: number;
  interval: number;
  repetitions: number;
  next_review: string;
}

// API Response Types
export interface GenerateCardsResponse {
  cards: Card[];
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

// Chrome Message Types (for extension)
export interface ExtensionMessage {
  action: string;
  payload?: unknown;
}

export interface SelectionContext {
  selectedText: string;
  surroundingContext: string;
  url: string;
  title: string;
}
