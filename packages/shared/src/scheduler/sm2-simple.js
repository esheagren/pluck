/**
 * Simple SM-2 Spaced Repetition Algorithm
 *
 * This is a simplified implementation designed to be easily replaced.
 * The interface (calculateNextReview, previewIntervals) should be maintained
 * when swapping in a new algorithm.
 *
 * @see https://super-memory.com/english/ol/sm2.htm
 */

import { DEFAULT_CONFIG, RATINGS, STATUS } from './constants.js';

/**
 * Calculate the next review state based on current state and rating.
 *
 * @param {Object} currentState - Current card review state
 * @param {number} currentState.interval_days - Current interval in days (0 for new)
 * @param {number} currentState.ease_factor - Current ease factor (default 2.5)
 * @param {string} currentState.status - Current status (new, learning, review, etc.)
 * @param {string} rating - User rating: 'again', 'hard', 'good', 'easy'
 * @param {Object} config - Algorithm configuration (optional, uses defaults)
 * @returns {Object} New state: { interval_days, ease_factor, due_at, status }
 */
export function calculateNextReview(currentState, rating, config = DEFAULT_CONFIG) {
  const {
    interval_days: currentInterval = 0,
    ease_factor: currentEase = config.initialEase,
    status: currentStatus = STATUS.NEW,
  } = currentState || {};

  let newInterval;
  let newEase = currentEase;
  let newStatus;
  const isNewCard = currentStatus === STATUS.NEW || currentInterval === 0;

  // Only adjust ease for graduated cards (not new cards per SM-2 spec)
  if (!isNewCard) {
    newEase = Math.max(
      config.minimumEase,
      currentEase + (config.easeBonus[rating] || 0)
    );
  }

  // Calculate new interval based on rating
  switch (rating) {
    case RATINGS.AGAIN:
      // Reset to learning interval (10 minutes)
      newInterval = config.learningInterval;
      newStatus = currentStatus === STATUS.NEW ? STATUS.LEARNING : STATUS.RELEARNING;
      // Ease penalty applies even for new cards on "again"
      newEase = Math.max(config.minimumEase, currentEase + config.easeBonus.again);
      break;

    case RATINGS.HARD:
      if (isNewCard) {
        // New card marked hard: give it a shorter graduating interval
        newInterval = config.graduatingInterval * config.graduationMultiplier.hard;
        newStatus = STATUS.REVIEW;
      } else {
        // Existing card: small increase
        newInterval = Math.max(
          currentInterval * config.intervalMultiplier.hard,
          config.graduatingInterval
        );
        newStatus = STATUS.REVIEW;
      }
      break;

    case RATINGS.GOOD:
      if (isNewCard) {
        // New card: graduate to first interval
        newInterval = config.graduatingInterval;
        newStatus = STATUS.REVIEW;
      } else {
        // Existing card: multiply by ease factor
        newInterval = currentInterval * newEase;
        newStatus = STATUS.REVIEW;
      }
      break;

    case RATINGS.EASY:
      if (isNewCard) {
        // New card marked easy: give bonus interval
        newInterval = config.graduatingInterval * config.intervalMultiplier.easy * config.graduationMultiplier.easy;
        newStatus = STATUS.REVIEW;
      } else {
        // Existing card: multiply by ease and easy bonus
        newInterval = currentInterval * newEase * config.intervalMultiplier.easy;
        newStatus = STATUS.REVIEW;
      }
      break;

    default:
      throw new Error(`Unknown rating: ${rating}`);
  }

  // Cap interval at maximum
  newInterval = Math.min(newInterval, config.maxIntervalDays);

  // Calculate due date
  const now = new Date();
  const dueAt = new Date(now.getTime() + newInterval * 24 * 60 * 60 * 1000);

  return {
    interval_days: newInterval,
    ease_factor: newEase,
    due_at: dueAt.toISOString(),
    status: newStatus,
  };
}

/**
 * Convert interval in days to human-readable string.
 *
 * @param {number} days - Interval in days (can be fractional)
 * @returns {string} Human-readable interval: "10m", "1h", "1d", "5d", "2w", "3mo"
 */
export function getIntervalDisplay(days) {
  if (days < 0.0007) {
    // Less than 1 minute
    return '<1m';
  }

  const minutes = days * 24 * 60;

  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }

  const hours = minutes / 60;
  if (hours < 24) {
    return `${Math.round(hours)}h`;
  }

  if (days < 7) {
    return `${Math.round(days)}d`;
  }

  const weeks = days / 7;
  if (weeks < 4) {
    return `${Math.round(weeks)}w`;
  }

  const months = days / 30;
  if (months < 12) {
    return `${Math.round(months)}mo`;
  }

  const years = days / 365;
  return `${years.toFixed(1)}y`;
}

/**
 * Preview what intervals each rating would produce.
 * Used to display intervals on rating buttons.
 *
 * @param {Object} currentState - Current card review state
 * @param {Object} config - Algorithm configuration (optional)
 * @returns {Object} Intervals by rating: { again: "10m", hard: "2d", good: "5d", easy: "9d" }
 */
export function previewIntervals(currentState, config = DEFAULT_CONFIG) {
  const previews = {};

  for (const rating of Object.values(RATINGS)) {
    const result = calculateNextReview(currentState, rating, config);
    previews[rating] = getIntervalDisplay(result.interval_days);
  }

  return previews;
}

/**
 * Get default initial state for a new card.
 *
 * @param {Object} config - Algorithm configuration (optional)
 * @returns {Object} Initial state: { interval_days, ease_factor, status }
 */
export function getInitialState(config = DEFAULT_CONFIG) {
  return {
    interval_days: 0,
    ease_factor: config.initialEase,
    status: STATUS.NEW,
    review_count: 0,
    lapse_count: 0,
    streak: 0,
  };
}
