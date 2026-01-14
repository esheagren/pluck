-- Migration: Spaced Repetition System
-- Run this in Supabase SQL Editor after 001_users_and_auth.sql
--
-- This migration adds:
-- 1. Enhanced cards table with numeric answer support
-- 2. User study settings (algorithm preferences)
-- 3. Algorithm configurations (fully exposed parameters)
-- 4. Card review state (per-user scheduling)
-- 5. Review logs (complete audit trail)
-- 6. Study sessions (analytics)
-- 7. User calibration stats (for numeric cards)

-- ============================================================================
-- SECTION 1: ENHANCED CARDS TABLE
-- ============================================================================

-- Add answer type support to cards
ALTER TABLE cards ADD COLUMN IF NOT EXISTS style TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS answer_type TEXT DEFAULT 'text'
  CHECK (answer_type IN ('text', 'numeric', 'numeric_range'));

-- Numeric answer fields
ALTER TABLE cards ADD COLUMN IF NOT EXISTS numeric_answer DECIMAL;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS numeric_lower DECIMAL;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS numeric_upper DECIMAL;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS numeric_unit TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS numeric_precision INTEGER DEFAULT 0;

-- Tags for topic-based interleaving
ALTER TABLE cards ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_cards_answer_type ON cards(answer_type);
CREATE INDEX IF NOT EXISTS idx_cards_tags ON cards USING GIN(tags);

-- ============================================================================
-- SECTION 2: USER STUDY SETTINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_study_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  -- Rating System
  rating_system TEXT DEFAULT '4-button'
    CHECK (rating_system IN ('4-button', '3-button', '2-button')),
  -- 4-button: again/hard/good/easy (default, most data)
  -- 3-button: forgot/hard/easy (simpler)
  -- 2-button: forgot/remembered (simplest)

  -- Scheduling Limits
  target_retention DECIMAL DEFAULT 0.90
    CHECK (target_retention >= 0.70 AND target_retention <= 0.99),
  new_cards_per_day INTEGER DEFAULT 20,
  max_reviews_per_day INTEGER, -- null = unlimited

  -- Presentation Options
  interleave_topics BOOLEAN DEFAULT true,
  interleave_card_types BOOLEAN DEFAULT true,
  show_answer_time BOOLEAN DEFAULT false,
  show_next_review_date BOOLEAN DEFAULT true,

  -- Algorithm Selection
  algorithm_type TEXT DEFAULT 'sm2'
    CHECK (algorithm_type IN ('sm2', 'fsrs', 'custom')),
  algorithm_config_id UUID, -- FK added after algorithm_configs table created

  -- Numeric Card Settings
  confidence_level DECIMAL DEFAULT 0.95
    CHECK (confidence_level IN (0.50, 0.80, 0.90, 0.95, 0.99)),
  numeric_scoring_mode TEXT DEFAULT 'width_adjusted'
    CHECK (numeric_scoring_mode IN ('binary', 'width_adjusted', 'log_score')),
  -- binary: just right/wrong (answer in interval or not)
  -- width_adjusted: reward tighter correct intervals
  -- log_score: proper scoring rule for calibration training

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- SECTION 3: ALGORITHM CONFIGURATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS algorithm_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- null = system default
  name TEXT NOT NULL,
  description TEXT,
  algorithm_type TEXT NOT NULL
    CHECK (algorithm_type IN ('sm2', 'fsrs', 'custom')),
  is_active BOOLEAN DEFAULT true,
  is_system_default BOOLEAN DEFAULT false, -- only one per algorithm_type

  -- ==========================================================================
  -- SM-2 Parameters (Classic Anki-style)
  -- ==========================================================================

  -- Initial values
  initial_ease DECIMAL DEFAULT 2.5
    CHECK (initial_ease >= 1.0 AND initial_ease <= 5.0),
  minimum_ease DECIMAL DEFAULT 1.3
    CHECK (minimum_ease >= 1.0 AND minimum_ease <= 3.0),

  -- Ease adjustments per rating
  ease_bonus_easy DECIMAL DEFAULT 0.15,     -- added to ease on "easy"
  ease_penalty_again DECIMAL DEFAULT 0.20,   -- subtracted on "again"
  ease_penalty_hard DECIMAL DEFAULT 0.15,    -- subtracted on "hard"

  -- Interval multipliers per rating
  hard_interval_multiplier DECIMAL DEFAULT 1.2,
  easy_interval_multiplier DECIMAL DEFAULT 1.3,

  -- Learning phase (before graduating to review)
  -- Values in days: 0.000694 = 1 min, 0.00694 = 10 min, 1 = 1 day
  learning_steps DECIMAL[] DEFAULT ARRAY[0.000694, 0.00694, 0.0625],
  -- Default: 1 min, 10 min, 90 min

  graduating_interval DECIMAL DEFAULT 1.0,   -- first interval after learning
  easy_graduating_interval DECIMAL DEFAULT 4.0, -- if "easy" during learning

  -- Relearning phase (after lapsing)
  relearning_steps DECIMAL[] DEFAULT ARRAY[0.00694],  -- 10 min
  minimum_interval_after_lapse DECIMAL DEFAULT 1.0,

  -- Lapse handling
  lapse_ease_penalty DECIMAL DEFAULT 0.20,   -- ease reduction on lapse
  lapse_interval_percentage DECIMAL DEFAULT 0.0, -- % of interval kept (0 = reset)
  leech_threshold INTEGER DEFAULT 8,          -- lapses before flagging

  -- Global modifiers
  interval_modifier DECIMAL DEFAULT 1.0,      -- multiplies all intervals
  max_interval_days INTEGER DEFAULT 365,      -- hard cap

  -- ==========================================================================
  -- FSRS Parameters (Free Spaced Repetition Scheduler)
  -- ==========================================================================

  -- FSRS uses 17 optimized weights instead of manual parameters
  fsrs_weights DECIMAL[] DEFAULT ARRAY[
    0.4, 0.6, 2.4, 5.8,      -- w0-w3: initial stability
    4.93, 0.94, 0.86, 0.01,  -- w4-w7: difficulty
    1.49, 0.14, 0.94,        -- w8-w10: stability after success
    2.18, 0.05, 0.34,        -- w11-w13: stability after failure
    1.26, 0.29, 2.61         -- w14-w16: short-term stability
  ],

  -- FSRS target retention (algorithm optimizes for this)
  fsrs_desired_retention DECIMAL DEFAULT 0.90
    CHECK (fsrs_desired_retention >= 0.70 AND fsrs_desired_retention <= 0.99),

  -- ==========================================================================
  -- Numeric Card Parameters
  -- ==========================================================================

  -- How to convert numeric results to ratings
  numeric_wide_interval_threshold DECIMAL DEFAULT 2.0,   -- relative width
  numeric_tight_interval_threshold DECIMAL DEFAULT 0.3,  -- relative width
  -- relative_width = (upper - lower) / |answer|

  -- Penalty for missing the interval
  numeric_miss_rating TEXT DEFAULT 'again'
    CHECK (numeric_miss_rating IN ('again', 'hard')),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add FK from user_study_settings to algorithm_configs
ALTER TABLE user_study_settings
  ADD CONSTRAINT fk_algorithm_config
  FOREIGN KEY (algorithm_config_id)
  REFERENCES algorithm_configs(id) ON DELETE SET NULL;

-- Index for finding system defaults
CREATE INDEX IF NOT EXISTS idx_algorithm_configs_system_default
  ON algorithm_configs(algorithm_type, is_system_default)
  WHERE is_system_default = true;

-- ============================================================================
-- SECTION 4: CARD REVIEW STATE
-- ============================================================================

CREATE TABLE IF NOT EXISTS card_review_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Scheduling State
  status TEXT DEFAULT 'new'
    CHECK (status IN ('new', 'learning', 'review', 'relearning', 'suspended')),
  due_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Current interval (in days, allows fractional for minutes/hours)
  -- 0.000694 = 1 minute, 0.0417 = 1 hour, 1.0 = 1 day
  interval_days DECIMAL DEFAULT 0,

  -- Ease factor (SM-2 style, typically 1.3 to 3.0)
  ease_factor DECIMAL DEFAULT 2.5,

  -- FSRS-specific state
  stability DECIMAL,     -- how long until 90% recall probability
  difficulty DECIMAL,    -- inherent card difficulty (0-1)

  -- Learning/relearning progress
  step_index INTEGER DEFAULT 0,  -- position in learning_steps array

  -- Counters
  review_count INTEGER DEFAULT 0,
  lapse_count INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,       -- consecutive correct

  -- Calibration stats (for numeric cards)
  numeric_review_count INTEGER DEFAULT 0,
  numeric_hits INTEGER DEFAULT 0,
  calibration_score DECIMAL,       -- running hit rate
  avg_interval_width DECIMAL,

  -- Flags
  is_leech BOOLEAN DEFAULT false,
  is_buried_today BOOLEAN DEFAULT false,  -- skip until tomorrow

  -- Timestamps
  last_reviewed_at TIMESTAMP WITH TIME ZONE,
  graduated_at TIMESTAMP WITH TIME ZONE,  -- first time reached 'review' status
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Each user has one review state per card
  UNIQUE(card_id, user_id)
);

-- Indexes for efficient due card queries
CREATE INDEX IF NOT EXISTS idx_card_review_state_due
  ON card_review_state(user_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_card_review_state_user
  ON card_review_state(user_id);
CREATE INDEX IF NOT EXISTS idx_card_review_state_card
  ON card_review_state(card_id);

-- ============================================================================
-- SECTION 5: REVIEW LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS review_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_review_state_id UUID NOT NULL REFERENCES card_review_state(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,

  -- Review Mode
  review_mode TEXT NOT NULL DEFAULT 'standard'
    CHECK (review_mode IN ('standard', 'numeric_interval')),

  -- ==========================================================================
  -- Standard Review Fields
  -- ==========================================================================
  rating TEXT
    CHECK (rating IN ('again', 'hard', 'good', 'easy')),
  response_time_ms INTEGER,

  -- ==========================================================================
  -- Numeric Review Fields
  -- ==========================================================================
  response_lower DECIMAL,           -- user's lower bound
  response_upper DECIMAL,           -- user's upper bound
  correct_answer DECIMAL,           -- snapshot of actual answer
  contained_answer BOOLEAN,         -- was answer in [lower, upper]?
  interval_width DECIMAL,           -- upper - lower
  relative_width DECIMAL,           -- width / |answer|
  confidence_level_used DECIMAL,    -- what CI was user targeting

  -- Derived rating (how numeric result was converted to SR rating)
  derived_rating TEXT
    CHECK (derived_rating IN ('again', 'hard', 'good', 'easy')),

  -- ==========================================================================
  -- State Before Review
  -- ==========================================================================
  previous_status TEXT,
  previous_interval DECIMAL,
  previous_ease DECIMAL,
  previous_due TIMESTAMP WITH TIME ZONE,
  previous_stability DECIMAL,       -- FSRS
  previous_difficulty DECIMAL,      -- FSRS

  -- ==========================================================================
  -- State After Review
  -- ==========================================================================
  new_status TEXT,
  new_interval DECIMAL,
  new_ease DECIMAL,
  new_due TIMESTAMP WITH TIME ZONE,
  new_stability DECIMAL,            -- FSRS
  new_difficulty DECIMAL,           -- FSRS

  -- ==========================================================================
  -- Algorithm Metadata (for debugging and analysis)
  -- ==========================================================================
  algorithm_version TEXT,           -- e.g., "sm2-v1.0", "fsrs-v4.5"
  algorithm_params JSONB,           -- snapshot of config used
  scoring_details JSONB,            -- intermediate calculations
  -- Example scoring_details for numeric:
  -- {
  --   "width_category": "tight",
  --   "relative_width": 0.25,
  --   "hit": true,
  --   "derived_rating_reason": "tight_interval_hit"
  -- }

  reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_review_logs_user_date
  ON review_logs(user_id, reviewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_logs_card
  ON review_logs(card_id, reviewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_logs_review_mode
  ON review_logs(review_mode);

-- ============================================================================
-- SECTION 6: STUDY SESSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Timing
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,

  -- Review counts by card status
  cards_new INTEGER DEFAULT 0,
  cards_learning INTEGER DEFAULT 0,
  cards_review INTEGER DEFAULT 0,
  cards_relearning INTEGER DEFAULT 0,

  -- Rating counts
  again_count INTEGER DEFAULT 0,
  hard_count INTEGER DEFAULT 0,
  good_count INTEGER DEFAULT 0,
  easy_count INTEGER DEFAULT 0,

  -- Numeric review stats
  numeric_reviews INTEGER DEFAULT 0,
  numeric_hits INTEGER DEFAULT 0,

  -- Time tracking
  total_time_ms INTEGER DEFAULT 0,
  avg_time_per_card_ms INTEGER,

  -- Algorithm used
  algorithm_config_id UUID REFERENCES algorithm_configs(id),
  algorithm_type TEXT,

  -- Session metadata
  platform TEXT,  -- 'webapp', 'extension', 'mobile'

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_sessions_user_date
  ON study_sessions(user_id, started_at DESC);

-- ============================================================================
-- SECTION 7: USER CALIBRATION STATS
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_calibration_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  -- Overall calibration
  total_numeric_reviews INTEGER DEFAULT 0,
  total_hits INTEGER DEFAULT 0,
  overall_hit_rate DECIMAL,  -- should approach confidence_level

  -- Stats broken down by confidence level
  -- { "0.95": { "reviews": 100, "hits": 92, "rate": 0.92 }, ... }
  stats_by_confidence JSONB DEFAULT '{}',

  -- Stats by answer magnitude (are they calibrated differently for small vs large?)
  -- { "0-10": { "reviews": 30, "hits": 28 }, "10-100": {...}, ... }
  stats_by_magnitude JSONB DEFAULT '{}',

  -- Stats by topic/tag
  stats_by_tag JSONB DEFAULT '{}',

  -- Weekly trend data for charts
  -- [{ "week": "2024-01", "reviews": 50, "hits": 47, "rate": 0.94 }, ...]
  calibration_trend JSONB DEFAULT '[]',

  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- SECTION 8: ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE user_study_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE algorithm_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_review_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_calibration_stats ENABLE ROW LEVEL SECURITY;

-- user_study_settings: users can only access their own
CREATE POLICY "Users can view own study settings" ON user_study_settings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own study settings" ON user_study_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own study settings" ON user_study_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- algorithm_configs: users can see system defaults + their own
CREATE POLICY "Users can view algorithm configs" ON algorithm_configs
  FOR SELECT USING (user_id IS NULL OR auth.uid() = user_id);
CREATE POLICY "Users can insert own algorithm configs" ON algorithm_configs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own algorithm configs" ON algorithm_configs
  FOR UPDATE USING (auth.uid() = user_id);

-- card_review_state: users can only access their own
CREATE POLICY "Users can view own card review state" ON card_review_state
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own card review state" ON card_review_state
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own card review state" ON card_review_state
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own card review state" ON card_review_state
  FOR DELETE USING (auth.uid() = user_id);

-- review_logs: users can only access their own
CREATE POLICY "Users can view own review logs" ON review_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own review logs" ON review_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- study_sessions: users can only access their own
CREATE POLICY "Users can view own study sessions" ON study_sessions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own study sessions" ON study_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own study sessions" ON study_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- user_calibration_stats: users can only access their own
CREATE POLICY "Users can view own calibration stats" ON user_calibration_stats
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own calibration stats" ON user_calibration_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own calibration stats" ON user_calibration_stats
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================================
-- SECTION 9: HELPER FUNCTIONS
-- ============================================================================

-- Auto-create study settings when a user starts studying
CREATE OR REPLACE FUNCTION ensure_user_study_settings(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_settings_id UUID;
BEGIN
  SELECT id INTO v_settings_id FROM user_study_settings WHERE user_id = p_user_id;

  IF v_settings_id IS NULL THEN
    INSERT INTO user_study_settings (user_id)
    VALUES (p_user_id)
    RETURNING id INTO v_settings_id;
  END IF;

  RETURN v_settings_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Initialize card review state for a user
CREATE OR REPLACE FUNCTION initialize_card_review_state(
  p_user_id UUID,
  p_card_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_state_id UUID;
BEGIN
  -- Check if state already exists
  SELECT id INTO v_state_id
  FROM card_review_state
  WHERE user_id = p_user_id AND card_id = p_card_id;

  IF v_state_id IS NULL THEN
    INSERT INTO card_review_state (user_id, card_id, status, due_at)
    VALUES (p_user_id, p_card_id, 'new', NOW())
    RETURNING id INTO v_state_id;
  END IF;

  RETURN v_state_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get due cards for a user
CREATE OR REPLACE FUNCTION get_due_cards(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 100,
  p_include_new BOOLEAN DEFAULT true,
  p_new_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  card_id UUID,
  status TEXT,
  due_at TIMESTAMP WITH TIME ZONE,
  interval_days DECIMAL,
  ease_factor DECIMAL,
  review_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH new_cards AS (
    SELECT crs.card_id, crs.status, crs.due_at, crs.interval_days,
           crs.ease_factor, crs.review_count
    FROM card_review_state crs
    WHERE crs.user_id = p_user_id
      AND crs.status = 'new'
      AND p_include_new = true
    ORDER BY crs.created_at
    LIMIT p_new_limit
  ),
  due_cards AS (
    SELECT crs.card_id, crs.status, crs.due_at, crs.interval_days,
           crs.ease_factor, crs.review_count
    FROM card_review_state crs
    WHERE crs.user_id = p_user_id
      AND crs.status IN ('learning', 'review', 'relearning')
      AND crs.due_at <= NOW()
      AND crs.is_buried_today = false
    ORDER BY
      CASE crs.status
        WHEN 'learning' THEN 1
        WHEN 'relearning' THEN 2
        ELSE 3
      END,
      crs.due_at
    LIMIT p_limit
  )
  SELECT * FROM new_cards
  UNION ALL
  SELECT * FROM due_cards;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update calibration stats after a numeric review
CREATE OR REPLACE FUNCTION update_calibration_stats(
  p_user_id UUID,
  p_was_hit BOOLEAN,
  p_confidence_level DECIMAL,
  p_answer_magnitude DECIMAL
)
RETURNS void AS $$
DECLARE
  v_magnitude_bucket TEXT;
BEGIN
  -- Determine magnitude bucket
  v_magnitude_bucket := CASE
    WHEN p_answer_magnitude < 10 THEN '0-10'
    WHEN p_answer_magnitude < 100 THEN '10-100'
    WHEN p_answer_magnitude < 1000 THEN '100-1000'
    WHEN p_answer_magnitude < 10000 THEN '1000-10000'
    ELSE '10000+'
  END;

  -- Upsert calibration stats
  INSERT INTO user_calibration_stats (user_id, total_numeric_reviews, total_hits)
  VALUES (p_user_id, 1, CASE WHEN p_was_hit THEN 1 ELSE 0 END)
  ON CONFLICT (user_id) DO UPDATE SET
    total_numeric_reviews = user_calibration_stats.total_numeric_reviews + 1,
    total_hits = user_calibration_stats.total_hits + CASE WHEN p_was_hit THEN 1 ELSE 0 END,
    overall_hit_rate = (user_calibration_stats.total_hits + CASE WHEN p_was_hit THEN 1 ELSE 0 END)::DECIMAL
                       / (user_calibration_stats.total_numeric_reviews + 1),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECTION 10: SEED DATA - DEFAULT ALGORITHM CONFIGS
-- ============================================================================

-- Insert system default SM-2 config
INSERT INTO algorithm_configs (
  id, user_id, name, description, algorithm_type, is_system_default
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  NULL,
  'SM-2 Default',
  'Classic SuperMemo 2 algorithm with Anki-style modifications. Well-tested, predictable behavior.',
  'sm2',
  true
) ON CONFLICT DO NOTHING;

-- Insert system default FSRS config
INSERT INTO algorithm_configs (
  id, user_id, name, description, algorithm_type, is_system_default,
  fsrs_weights, fsrs_desired_retention
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  NULL,
  'FSRS Default',
  'Free Spaced Repetition Scheduler v4. Machine-learning optimized weights, adaptive to individual learning patterns.',
  'fsrs',
  true,
  ARRAY[0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61],
  0.90
) ON CONFLICT DO NOTHING;

-- Insert aggressive retention config
INSERT INTO algorithm_configs (
  id, user_id, name, description, algorithm_type,
  initial_ease, graduating_interval, max_interval_days
) VALUES (
  '00000000-0000-0000-0000-000000000003',
  NULL,
  'High Retention',
  'More frequent reviews for higher retention. Good for critical material.',
  'sm2',
  2.3,
  0.5,
  180
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- SECTION 11: VIEWS FOR ANALYTICS
-- ============================================================================

-- View: User's review summary by day
CREATE OR REPLACE VIEW user_daily_review_summary AS
SELECT
  user_id,
  DATE(reviewed_at) as review_date,
  COUNT(*) as total_reviews,
  COUNT(*) FILTER (WHERE rating = 'again') as again_count,
  COUNT(*) FILTER (WHERE rating = 'hard') as hard_count,
  COUNT(*) FILTER (WHERE rating = 'good') as good_count,
  COUNT(*) FILTER (WHERE rating = 'easy') as easy_count,
  COUNT(*) FILTER (WHERE review_mode = 'numeric_interval') as numeric_reviews,
  COUNT(*) FILTER (WHERE review_mode = 'numeric_interval' AND contained_answer = true) as numeric_hits,
  AVG(response_time_ms) as avg_response_time_ms,
  AVG(new_interval) as avg_new_interval
FROM review_logs
GROUP BY user_id, DATE(reviewed_at);

-- View: Card difficulty ranking
CREATE OR REPLACE VIEW card_difficulty_ranking AS
SELECT
  crs.card_id,
  crs.user_id,
  c.question,
  crs.ease_factor,
  crs.lapse_count,
  crs.review_count,
  CASE
    WHEN crs.review_count = 0 THEN NULL
    ELSE crs.lapse_count::DECIMAL / crs.review_count
  END as lapse_rate,
  crs.is_leech
FROM card_review_state crs
JOIN cards c ON c.id = crs.card_id
WHERE crs.review_count > 0
ORDER BY crs.lapse_count DESC, crs.ease_factor ASC;
