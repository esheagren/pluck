/**
 * Type definitions for the spaced repetition scheduler module
 */

// Rating values that map to user actions
export type Rating = 'again' | 'hard' | 'good' | 'easy';

// Card status in the learning queue
export type CardStatus = 'new' | 'learning' | 'review' | 'relearning' | 'suspended';

/**
 * Ease bonus adjustments per rating
 */
export interface EaseBonus {
  easy: number;
  good: number;
  hard: number;
  again: number;
}

/**
 * Interval multipliers for existing cards
 */
export interface IntervalMultiplier {
  hard: number;
  easy: number;
}

/**
 * Fixed intervals for new cards (in days)
 */
export interface NewCardIntervals {
  again: number;
  hard: number;
  good: number;
  easy: number;
}

/**
 * Graduation intervals for learning/relearning cards (in days)
 */
export interface GraduationIntervals {
  again: number;
  hard: number;
  good: number;
  easy: number;
}

/**
 * Algorithm configuration options
 */
export interface SM2Config {
  /** Initial ease factor for new cards (typically 2.5) */
  initialEase: number;
  /** Minimum ease factor floor (typically 1.3) */
  minimumEase: number;
  /** Ease adjustments per rating */
  easeBonus: EaseBonus;
  /** Interval multipliers for review cards */
  intervalMultiplier: IntervalMultiplier;
  /** Fixed intervals for first-time cards (in days) */
  newCardIntervals: NewCardIntervals;
  /** Graduation intervals for learning cards (in days) */
  graduationIntervals: GraduationIntervals;
  /** Maximum interval cap (in days) */
  maxIntervalDays: number;
}

/**
 * Current state of a card in the review system
 */
export interface CardReviewState {
  /** Current interval in days (0 for new cards) */
  interval_days: number;
  /** Current ease factor (default 2.5) */
  ease_factor: number;
  /** Current card status */
  status: CardStatus;
  /** Number of successful reviews */
  review_count?: number;
  /** Number of lapses (forgetting) */
  lapse_count?: number;
  /** Current streak of successful reviews */
  streak?: number;
}

/**
 * Result of calculating the next review
 */
export interface NextReviewResult {
  /** New interval in days */
  interval_days: number;
  /** Updated ease factor */
  ease_factor: number;
  /** ISO date string for next review */
  due_at: string;
  /** New card status */
  status: CardStatus;
}

/**
 * Preview intervals for each rating option
 */
export interface IntervalPreviews {
  again: string;
  hard: string;
  good: string;
  easy: string;
}

/**
 * Rating constants object type
 */
export interface RatingsMap {
  readonly AGAIN: 'again';
  readonly HARD: 'hard';
  readonly GOOD: 'good';
  readonly EASY: 'easy';
}

/**
 * Status constants object type
 */
export interface StatusMap {
  readonly NEW: 'new';
  readonly LEARNING: 'learning';
  readonly REVIEW: 'review';
  readonly RELEARNING: 'relearning';
  readonly SUSPENDED: 'suspended';
}
