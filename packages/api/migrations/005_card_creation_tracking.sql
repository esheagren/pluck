-- Migration: Card Creation Tracking
-- Run this in Supabase SQL Editor after 004_user_profiles.sql

-- Index to optimize the view query (if not already exists)
CREATE INDEX IF NOT EXISTS idx_cards_user_created
  ON cards(user_id, created_at DESC);

-- View: Daily card creation summary per user
-- Mirrors the structure of user_daily_review_summary for consistency
-- Note: Only counts cards with explicit user ownership
-- Legacy cards (user_id IS NULL) are excluded from activity tracking
CREATE OR REPLACE VIEW user_daily_card_summary AS
SELECT
  user_id,
  DATE(created_at) as created_date,
  COUNT(*) as cards_created
FROM cards
WHERE user_id IS NOT NULL
GROUP BY user_id, DATE(created_at);

-- Grant access to authenticated users
GRANT SELECT ON user_daily_card_summary TO authenticated;
