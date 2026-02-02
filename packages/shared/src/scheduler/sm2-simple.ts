/**
 * Simple SM-2 Spaced Repetition Algorithm
 *
 * This is a simplified implementation designed to be easily replaced.
 * The interface (calculateNextReview, previewIntervals) should be maintained
 * when swapping in a new algorithm.
 *
 * @see https://super-memory.com/english/ol/sm2.htm
 */

import { DEFAULT_CONFIG, RATINGS, STATUS } from './constants';
import type {
  Rating,
  CardStatus,
  SM2Config,
  CardReviewState,
  NextReviewResult,
  IntervalPreviews,
} from './types';

/**
 * Calculate the next review state based on current state and rating.
 *
 * @param currentState - Current card review state
 * @param rating - User rating: 'again', 'hard', 'good', 'easy'
 * @param config - Algorithm configuration (optional, uses defaults)
 * @returns New state with interval_days, ease_factor, due_at, status
 */
export function calculateNextReview(
  currentState: CardReviewState | null | undefined,
  rating: Rating,
  config: SM2Config = DEFAULT_CONFIG
): NextReviewResult {
  const {
    interval_days: currentInterval = 0,
    ease_factor: currentEase = config.initialEase,
    status: currentStatus = STATUS.NEW,
  } = currentState || {};

  let newInterval: number;
  let newEase = currentEase;
  let newStatus: CardStatus;

  const isNewCard = currentStatus === STATUS.NEW || currentInterval === 0;
  const isLearningPhase = currentStatus === STATUS.LEARNING || currentStatus === STATUS.RELEARNING;

  if (isNewCard) {
    // NEW cards: use fixed newCardIntervals
    newInterval = config.newCardIntervals[rating];
    newStatus = rating === RATINGS.AGAIN ? STATUS.LEARNING : STATUS.REVIEW;
    if (rating === RATINGS.AGAIN) {
      newEase = Math.max(config.minimumEase, currentEase + config.easeBonus.again);
    }
  } else if (isLearningPhase) {
    // LEARNING/RELEARNING cards: use fixed graduation intervals
    // Graduate to REVIEW on hard/good/easy, stay in learning on again
    newInterval = config.graduationIntervals[rating];
    if (newInterval === undefined) {
      throw new Error(`Unknown rating: ${rating}`);
    }
    // No ease adjustment during learning phase
    if (rating === RATINGS.AGAIN) {
      newStatus = currentStatus; // Stay in learning/relearning
    } else {
      newStatus = STATUS.REVIEW; // Graduate to review
    }
  } else {
    // REVIEW cards: use multiplier-based growth
    newEase = Math.max(
      config.minimumEase,
      currentEase + (config.easeBonus[rating] || 0)
    );

    switch (rating) {
      case RATINGS.AGAIN:
        newInterval = config.newCardIntervals.again; // 10 minutes
        newStatus = STATUS.RELEARNING;
        break;

      case RATINGS.HARD:
        newInterval = Math.max(
          currentInterval * config.intervalMultiplier.hard,
          1 // minimum 1 day
        );
        newStatus = STATUS.REVIEW;
        break;

      case RATINGS.GOOD:
        newInterval = Math.max(
          currentInterval * newEase,
          1 // minimum 1 day
        );
        newStatus = STATUS.REVIEW;
        break;

      case RATINGS.EASY:
        newInterval = Math.max(
          currentInterval * newEase * config.intervalMultiplier.easy,
          1 // minimum 1 day
        );
        newStatus = STATUS.REVIEW;
        break;

      default:
        throw new Error(`Unknown rating: ${rating}`);
    }
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
 * @param days - Interval in days (can be fractional)
 * @returns Human-readable interval: "10m", "1h", "1d", "5d", "2w", "3mo"
 */
export function getIntervalDisplay(days: number): string {
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
 * @param currentState - Current card review state
 * @param config - Algorithm configuration (optional)
 * @returns Intervals by rating: { again: "10m", hard: "2d", good: "5d", easy: "9d" }
 */
export function previewIntervals(
  currentState: CardReviewState | null | undefined,
  config: SM2Config = DEFAULT_CONFIG
): IntervalPreviews {
  const previews: IntervalPreviews = {
    again: '',
    hard: '',
    good: '',
    easy: '',
  };

  for (const rating of Object.values(RATINGS) as Rating[]) {
    const result = calculateNextReview(currentState, rating, config);
    previews[rating] = getIntervalDisplay(result.interval_days);
  }

  return previews;
}

/**
 * Get default initial state for a new card.
 *
 * @param config - Algorithm configuration (optional)
 * @returns Initial state: { interval_days, ease_factor, status, review_count, lapse_count, streak }
 */
export function getInitialState(config: SM2Config = DEFAULT_CONFIG): CardReviewState {
  return {
    interval_days: 0,
    ease_factor: config.initialEase,
    status: STATUS.NEW,
    review_count: 0,
    lapse_count: 0,
    streak: 0,
  };
}

/**
 * Get relative due date display from a due_at timestamp.
 * Returns human-friendly text like "in 3 days", "today", "overdue".
 *
 * @param dueAt - ISO date string for when the card is due
 * @returns Human-readable relative date: "today", "tomorrow", "in 3 days", "in 2 weeks", "overdue"
 */
export function getRelativeDueDate(dueAt: string | null | undefined): string {
  if (!dueAt) {
    return 'new';
  }

  const now = new Date();
  const due = new Date(dueAt);

  // Reset times to midnight for day comparison
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueMidnight = new Date(due.getFullYear(), due.getMonth(), due.getDate());

  const diffMs = dueMidnight.getTime() - nowMidnight.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return 'due';
  }

  if (diffDays === 0) {
    return 'today';
  }

  if (diffDays === 1) {
    return 'tomorrow';
  }

  if (diffDays < 7) {
    return `in ${diffDays} days`;
  }

  const weeks = Math.round(diffDays / 7);
  if (weeks < 4) {
    return weeks === 1 ? 'in 1 week' : `in ${weeks} weeks`;
  }

  const months = Math.round(diffDays / 30);
  if (months < 12) {
    return months === 1 ? 'in 1 month' : `in ${months} months`;
  }

  const years = Math.round(diffDays / 365);
  return years === 1 ? 'in 1 year' : `in ${years} years`;
}
