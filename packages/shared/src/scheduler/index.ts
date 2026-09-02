/**
 * Spaced Repetition Scheduler — now lives in @pluckk/core. This module re-exports
 * the same names so existing imports keep working while the webapp moves to the
 * server-computed review path (core-engine plan, step 3).
 */
export {
  calculateNextReview,
  getIntervalDisplay,
  previewIntervals,
  getInitialState,
  getRelativeDueDate,
  DEFAULT_CONFIG,
  RATINGS,
  STATUS,
  ALGORITHM_VERSION,
} from '@pluckk/core/scheduler';

export type {
  Rating,
  CardStatus,
  SM2Config,
  CardReviewState,
  NextReviewResult,
  IntervalPreviews,
  EaseBonus,
  IntervalMultiplier,
  NewCardIntervals,
  GraduationIntervals,
  RatingsMap,
  StatusMap,
} from '@pluckk/core/scheduler';
