-- Migration: Onboarding & Learning Profile
-- Run this in Supabase SQL Editor after 005_card_creation_tracking.sql

-- 1. Add onboarding completion flag
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- 2. Add learning profile columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS learning_goals TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS expertise_level TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS card_style TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS domains TEXT[];

-- 3. Add check constraints for enum fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'expertise_level_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT expertise_level_check
      CHECK (expertise_level IS NULL OR expertise_level IN ('beginner', 'intermediate', 'expert'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'card_style_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT card_style_check
      CHECK (card_style IS NULL OR card_style IN ('concise', 'balanced', 'detailed'));
  END IF;
END
$$;

-- 4. Set existing users as onboarding_completed = true (they don't need the wizard)
UPDATE users SET onboarding_completed = true WHERE onboarding_completed IS NULL OR onboarding_completed = false;

-- 5. Update get_public_profile to include new fields (optional, for future public profile expansion)
-- Not needed for now since learning profile is private
