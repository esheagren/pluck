// Pluckk database schema (Neon Postgres via Drizzle).
// Ported 2026-08-28 from the Supabase project (migrations 001–009 + live dump).
// Dropped on purpose: Stripe/usage-limit columns, usernames/public profiles/feedback
// (private-first, 2026-09), the four rollup views (activity is computed in /api/v1/activity),
// and every RLS policy — authorization lives in the API layer (`where user_id = …`).

import { sql } from 'drizzle-orm';
import {
  pgTable, uuid, text, boolean, integer, bigint, bigserial, numeric, timestamp, jsonb, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { CardSpec, Provenance } from '@pluckk/core/entities';

const num = (name: string) => numeric(name, { mode: 'number' });
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'string' });

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email'),
  googleSub: text('google_sub').unique(),
  createdAt: ts('created_at').defaultNow().notNull(),
  mochiApiKey: text('mochi_api_key'),
  mochiDeckId: text('mochi_deck_id'),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  onboardingCompleted: boolean('onboarding_completed').default(false).notNull(),
  primaryCategory: text('primary_category'),
  studentLevel: text('student_level'),
  studentField: text('student_field'),
  workFields: text('work_fields').array(),
  workFieldOther: text('work_field_other'),
  workYearsExperience: text('work_years_experience'),
  researchField: text('research_field'),
  researchYearsExperience: text('research_years_experience'),
  additionalInterests: text('additional_interests').array(),
  additionalInterestsOther: text('additional_interests_other'),
  spacedRepExperience: text('spaced_rep_experience'),
  technicalityPreference: integer('technicality_preference'),
  breadthPreference: integer('breadth_preference'),
}, (t) => [
  uniqueIndex('users_email_idx').on(t.email),
]);

// Opaque bearer tokens issued by /api/auth/google. Stored hashed (sha256).
export const apiTokens = pgTable('api_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  label: text('label'),              // 'webapp' | 'extension' | 'macos' | custom
  createdAt: ts('created_at').defaultNow().notNull(),
  lastUsedAt: ts('last_used_at'),
  expiresAt: ts('expires_at'),
});

export const folders = pgTable('folders', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color').default('#6B7280'),
  sortOrder: integer('sort_order').default(0),
  // Review-mixer (2026-09): default-mix percentage (null = not in default mix),
  // paused folders never enter sessions, per-folder new-card introduction budget.
  weight: integer('weight'),
  isPaused: boolean('is_paused').default(false).notNull(),
  newPerDay: integer('new_per_day'),
  createdAt: ts('created_at').defaultNow().notNull(),
  updatedAt: ts('updated_at').defaultNow().notNull().$onUpdate(() => new Date().toISOString()),
}, (t) => [index('folders_user_idx').on(t.userId)]);

export const cards = pgTable('cards', {
  id: uuid('id').primaryKey().defaultRandom(),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  sourceUrl: text('source_url'),
  createdAt: ts('created_at').defaultNow().notNull(),
  imageUrl: text('image_url'),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  folderId: uuid('folder_id').references(() => folders.id, { onDelete: 'set null' }),
  style: text('style'),
  answerType: text('answer_type').default('text'),
  numericAnswer: num('numeric_answer'),
  numericLower: num('numeric_lower'),
  numericUpper: num('numeric_upper'),
  numericUnit: text('numeric_unit'),
  numericPrecision: integer('numeric_precision').default(0),
  tags: text('tags').array(),
  sourceSelection: text('source_selection'),
  sourceContext: text('source_context'),
  sourceTitle: text('source_title'),
  sourceSelector: text('source_selector'),
  sourceTextOffset: integer('source_text_offset'),
  // core-engine (step 2): the authored spec, structured provenance, capture identity,
  // soft delete, and snapshot bookkeeping. question/answer/style/source_* above are a
  // read-only mirror of spec/provenance until step 8 drops them.
  spec: jsonb('spec').$type<CardSpec>(),
  provenance: jsonb('provenance').$type<Provenance>(),
  captureKey: text('capture_key'),
  isDeleted: boolean('is_deleted').default(false).notNull(),
  snapshotSeq: bigint('snapshot_seq', { mode: 'number' }),
  snapshotAlgorithm: text('snapshot_algorithm'),
}, (t) => [
  index('cards_user_idx').on(t.userId),
  index('cards_folder_idx').on(t.folderId),
  index('cards_source_url_idx').on(t.sourceUrl),
  index('cards_user_deleted_idx').on(t.userId, t.isDeleted),
  uniqueIndex('cards_user_capture_key_idx').on(t.userId, t.captureKey).where(sql`capture_key is not null`),
]);

// The diary (core-engine step 2). Append-only; a card's state is the reduction of its events.
// `seq` is the global order and the sync cursor; `at` is when it happened (server-stamped).
export const cardEvents = pgTable('card_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  seq: bigserial('seq', { mode: 'number' }).notNull().unique(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  cardId: uuid('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  payload: jsonb('payload').notNull(),
  at: ts('at').defaultNow().notNull(),
}, (t) => [
  index('card_events_user_seq_idx').on(t.userId, t.seq),
  index('card_events_card_seq_idx').on(t.cardId, t.seq),
]);

export const algorithmConfigs = pgTable('algorithm_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  algorithmType: text('algorithm_type').notNull(),
  isActive: boolean('is_active').default(true),
  isSystemDefault: boolean('is_system_default').default(false),
  initialEase: num('initial_ease').default(2.5),
  minimumEase: num('minimum_ease').default(1.3),
  easeBonusEasy: num('ease_bonus_easy').default(0.15),
  easePenaltyAgain: num('ease_penalty_again').default(0.2),
  easePenaltyHard: num('ease_penalty_hard').default(0.15),
  hardIntervalMultiplier: num('hard_interval_multiplier').default(1.2),
  easyIntervalMultiplier: num('easy_interval_multiplier').default(1.3),
  learningSteps: num('learning_steps').array(),
  graduatingInterval: num('graduating_interval').default(1.0),
  easyGraduatingInterval: num('easy_graduating_interval').default(4.0),
  relearningSteps: num('relearning_steps').array(),
  minimumIntervalAfterLapse: num('minimum_interval_after_lapse').default(1.0),
  lapseEasePenalty: num('lapse_ease_penalty').default(0.2),
  lapseIntervalPercentage: num('lapse_interval_percentage').default(0.0),
  leechThreshold: integer('leech_threshold').default(8),
  intervalModifier: num('interval_modifier').default(1.0),
  maxIntervalDays: integer('max_interval_days').default(365),
  fsrsWeights: num('fsrs_weights').array(),
  fsrsDesiredRetention: num('fsrs_desired_retention').default(0.9),
  numericWideIntervalThreshold: num('numeric_wide_interval_threshold').default(2.0),
  numericTightIntervalThreshold: num('numeric_tight_interval_threshold').default(0.3),
  numericMissRating: text('numeric_miss_rating').default('again'),
  createdAt: ts('created_at').defaultNow().notNull(),
  updatedAt: ts('updated_at').defaultNow().notNull(),
});

export const userStudySettings = pgTable('user_study_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  ratingSystem: text('rating_system').default('4-button'),
  sessionSize: integer('session_size'),
  targetRetention: num('target_retention').default(0.9),
  newCardsPerDay: integer('new_cards_per_day').default(20),
  maxReviewsPerDay: integer('max_reviews_per_day'),
  interleaveTopics: boolean('interleave_topics').default(true),
  interleaveCardTypes: boolean('interleave_card_types').default(true),
  showAnswerTime: boolean('show_answer_time').default(false),
  showNextReviewDate: boolean('show_next_review_date').default(true),
  algorithmType: text('algorithm_type').default('sm2'),
  algorithmConfigId: uuid('algorithm_config_id').references(() => algorithmConfigs.id),
  confidenceLevel: num('confidence_level').default(0.95),
  numericScoringMode: text('numeric_scoring_mode').default('width_adjusted'),
  createdAt: ts('created_at').defaultNow().notNull(),
  updatedAt: ts('updated_at').defaultNow().notNull(),
});

export const cardReviewState = pgTable('card_review_state', {
  id: uuid('id').primaryKey().defaultRandom(),
  cardId: uuid('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // core-engine (step 2): one row per component ('main', 'forward'/'reverse', 'p0'…). This
  // table is the materialised snapshot of card_events; the API rebuilds it from the reducer.
  componentId: text('component_id').default('main').notNull(),
  status: text('status').default('new').notNull(),
  dueAt: ts('due_at').defaultNow().notNull(),
  intervalDays: num('interval_days').default(0).notNull(),
  easeFactor: num('ease_factor').default(2.5).notNull(),
  stability: num('stability'),
  difficulty: num('difficulty'),
  stepIndex: integer('step_index').default(0),
  reviewCount: integer('review_count').default(0).notNull(),
  lapseCount: integer('lapse_count').default(0).notNull(),
  streak: integer('streak').default(0).notNull(),
  numericReviewCount: integer('numeric_review_count').default(0),
  numericHits: integer('numeric_hits').default(0),
  calibrationScore: num('calibration_score'),
  avgIntervalWidth: num('avg_interval_width'),
  isLeech: boolean('is_leech').default(false),
  isBuriedToday: boolean('is_buried_today').default(false),
  lastReviewedAt: ts('last_reviewed_at'),
  graduatedAt: ts('graduated_at'),
  createdAt: ts('created_at').defaultNow().notNull(),
  updatedAt: ts('updated_at').defaultNow().notNull().$onUpdate(() => new Date().toISOString()),
}, (t) => [
  uniqueIndex('crs_card_user_component_idx').on(t.cardId, t.userId, t.componentId),
  index('crs_user_due_idx').on(t.userId, t.dueAt),
]);

export const reviewLogs = pgTable('review_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  cardReviewStateId: uuid('card_review_state_id').references(() => cardReviewState.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  cardId: uuid('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
  reviewMode: text('review_mode').default('standard').notNull(),
  rating: text('rating').notNull(),
  responseTimeMs: integer('response_time_ms'),
  responseLower: num('response_lower'),
  responseUpper: num('response_upper'),
  correctAnswer: num('correct_answer'),
  containedAnswer: boolean('contained_answer'),
  intervalWidth: num('interval_width'),
  relativeWidth: num('relative_width'),
  confidenceLevelUsed: num('confidence_level_used'),
  derivedRating: text('derived_rating'),
  previousStatus: text('previous_status'),
  previousInterval: num('previous_interval'),
  previousEase: num('previous_ease'),
  previousDue: ts('previous_due'),
  previousStability: num('previous_stability'),
  previousDifficulty: num('previous_difficulty'),
  newStatus: text('new_status'),
  newInterval: num('new_interval'),
  newEase: num('new_ease'),
  newDue: ts('new_due'),
  newStability: num('new_stability'),
  newDifficulty: num('new_difficulty'),
  algorithmVersion: text('algorithm_version'),
  algorithmParams: jsonb('algorithm_params'),
  scoringDetails: jsonb('scoring_details'),
  reviewedAt: ts('reviewed_at').defaultNow().notNull(),
}, (t) => [index('review_logs_user_time_idx').on(t.userId, t.reviewedAt)]);

export const studySessions = pgTable('study_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  startedAt: ts('started_at').defaultNow().notNull(),
  endedAt: ts('ended_at'),
  cardsNew: integer('cards_new').default(0),
  cardsLearning: integer('cards_learning').default(0),
  cardsReview: integer('cards_review').default(0),
  cardsRelearning: integer('cards_relearning').default(0),
  againCount: integer('again_count').default(0),
  hardCount: integer('hard_count').default(0),
  goodCount: integer('good_count').default(0),
  easyCount: integer('easy_count').default(0),
  numericReviews: integer('numeric_reviews').default(0),
  numericHits: integer('numeric_hits').default(0),
  totalTimeMs: integer('total_time_ms').default(0),
  avgTimePerCardMs: integer('avg_time_per_card_ms'),
  algorithmConfigId: uuid('algorithm_config_id').references(() => algorithmConfigs.id),
  algorithmType: text('algorithm_type'),
  platform: text('platform'),
  createdAt: ts('created_at').defaultNow().notNull(),
});

export const userCalibrationStats = pgTable('user_calibration_stats', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  totalNumericReviews: integer('total_numeric_reviews').default(0),
  totalHits: integer('total_hits').default(0),
  overallHitRate: num('overall_hit_rate'),
  statsByConfidence: jsonb('stats_by_confidence'),
  statsByMagnitude: jsonb('stats_by_magnitude'),
  statsByTag: jsonb('stats_by_tag'),
  calibrationTrend: jsonb('calibration_trend'),
  updatedAt: ts('updated_at').defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type Folder = typeof folders.$inferSelect;
export type CardReviewStateRow = typeof cardReviewState.$inferSelect;
export type ReviewLog = typeof reviewLogs.$inferSelect;
