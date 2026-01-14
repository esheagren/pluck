/**
 * Spaced Repetition Scheduler
 *
 * This module provides a pluggable spaced repetition algorithm.
 * To replace the algorithm, create a new file with the same interface
 * and update the imports below.
 */

// Algorithm implementation (swap this import to change algorithms)
export {
  calculateNextReview,
  getIntervalDisplay,
  previewIntervals,
  getInitialState,
} from './sm2-simple.js';

// Constants and configuration
export {
  DEFAULT_CONFIG,
  RATINGS,
  STATUS,
  ALGORITHM_VERSION,
} from './constants.js';
