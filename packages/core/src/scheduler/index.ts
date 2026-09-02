// The scheduler behind an interface, so FSRS can be a second implementation replayed
// over the same event diary.

import type { ComponentState, Rating } from '../entities.js';
import { DEFAULT_CONFIG, DEFAULT_MECHANICS, SCHEDULER_ID } from './constants.js';
import { computeNext, initialComponentState, isDue, previewComponent } from './sm2.js';
import type { IntervalPreviews, Mechanics, SM2Config } from './types.js';

export interface Scheduler {
  /** Stored on every snapshot so a later algorithm swap knows what produced it. */
  id: string;
  mechanics: Mechanics;
  initial(now: Date): ComponentState;
  /** `mechanics` overrides the scheduler's own — the reducer passes the ones recorded on the event. */
  next(state: ComponentState, rating: Rating, now: Date, mechanics?: Mechanics): ComponentState;
  preview(state: ComponentState, now: Date): IntervalPreviews;
  isDue(state: Pick<ComponentState, 'dueAt'>, now: Date): boolean;
}

export function sm2Scheduler(config: SM2Config = DEFAULT_CONFIG, mechanics: Mechanics = DEFAULT_MECHANICS): Scheduler {
  return {
    id: SCHEDULER_ID,
    mechanics,
    initial: (now) => initialComponentState(now, config),
    next: (state, rating, now, m) => computeNext(state, rating, now, config, m ?? mechanics),
    preview: (state, now) => previewComponent(state, now, config, mechanics),
    isDue: (state, now) => isDue(state, now, mechanics),
  };
}

export const defaultScheduler: Scheduler = sm2Scheduler();

export {
  computeNext, initialComponentState, isDue, previewComponent, jitterMinutes,
  getIntervalDisplay, getRelativeDueDate,
  calculateNextReview, previewIntervals, getInitialState, fromLegacyState,
} from './sm2.js';
export {
  DEFAULT_CONFIG, DEFAULT_MECHANICS, MECHANICS_OFF, MECHANICS_ORBIT, RATINGS, STATUS,
  ALGORITHM_VERSION, SCHEDULER_ID, DAY_MS, MINUTE_MS,
} from './constants.js';
export type {
  SM2Config, Mechanics, CardReviewState, NextReviewResult, IntervalPreviews,
  EaseBonus, IntervalMultiplier, NewCardIntervals, GraduationIntervals, RatingsMap, StatusMap,
  Rating, CardStatus,
} from './types.js';
