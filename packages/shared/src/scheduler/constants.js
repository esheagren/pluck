/**
 * Default configuration for spaced repetition algorithms.
 * These values match the database schema defaults in 002_spaced_repetition.sql
 */

export const DEFAULT_CONFIG = {
  // Initial ease factor for new cards (SM-2 style, typically 1.3 to 3.0)
  initialEase: 2.5,

  // Minimum ease factor (floor)
  minimumEase: 1.3,

  // Ease adjustments per rating
  easeBonus: {
    easy: 0.15,    // Added to ease on "easy"
    good: 0,       // No change on "good"
    hard: -0.15,   // Subtracted on "hard"
    again: -0.20,  // Subtracted on "again"
  },

  // Interval multipliers for existing cards
  intervalMultiplier: {
    hard: 1.2,
    easy: 1.3,  // Applied on top of ease factor
  },

  // Graduation multipliers for new cards
  graduationMultiplier: {
    hard: 0.5,  // Hard on new card = graduatingInterval * 0.5
    easy: 2.0,  // Easy on new card = graduatingInterval * easy * 2.0
  },

  // Learning phase - interval in days for "again" rating
  // 0.00694 = 10 minutes (10 / 1440 minutes per day)
  learningInterval: 0.00694,

  // First interval after graduating from "new" status (in days)
  graduatingInterval: 1.0,

  // Maximum interval cap (in days)
  maxIntervalDays: 365,
};

// Rating enum matching database schema
export const RATINGS = {
  AGAIN: 'again',
  HARD: 'hard',
  GOOD: 'good',
  EASY: 'easy',
};

// Card status enum matching database schema
export const STATUS = {
  NEW: 'new',
  LEARNING: 'learning',
  REVIEW: 'review',
  RELEARNING: 'relearning',
  SUSPENDED: 'suspended',
};

// Algorithm version for logging and analysis
export const ALGORITHM_VERSION = 'sm2-simple-v1.0';
