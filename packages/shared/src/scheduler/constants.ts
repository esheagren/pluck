/**
 * Default configuration for spaced repetition algorithms.
 * These values match the database schema defaults in 002_spaced_repetition.sql
 */

import type { SM2Config, RatingsMap, StatusMap } from './types';

export const DEFAULT_CONFIG: SM2Config = {
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

  // Intervals for new/first-time cards (in days)
  newCardIntervals: {
    again: 0.00694,  // 10 minutes
    hard: 1,         // 1 day
    good: 3,         // 3 days
    easy: 7,         // 7 days
  },

  // Graduation intervals for learning/relearning cards (in days)
  // Used when card is in LEARNING or RELEARNING status
  graduationIntervals: {
    again: 0.00694,  // 10 minutes (stay in learning)
    hard: 1,         // 1 day
    good: 2,         // 2 days
    easy: 4,         // 4 days
  },

  // Maximum interval cap (in days)
  maxIntervalDays: 365,
};

// Rating enum matching database schema
export const RATINGS: RatingsMap = {
  AGAIN: 'again',
  HARD: 'hard',
  GOOD: 'good',
  EASY: 'easy',
} as const;

// Card status enum matching database schema
export const STATUS: StatusMap = {
  NEW: 'new',
  LEARNING: 'learning',
  REVIEW: 'review',
  RELEARNING: 'relearning',
  SUSPENDED: 'suspended',
} as const;

// Algorithm version for logging and analysis
export const ALGORITHM_VERSION = 'sm2-simple-v1.0';
