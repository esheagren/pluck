-- Migration: Onboarding & Learning Profile (v2)
-- Run this in Supabase SQL Editor after 005_card_creation_tracking.sql

-- 1. Add onboarding completion flag
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- 2. Add learning profile columns
-- Primary category
ALTER TABLE users ADD COLUMN IF NOT EXISTS primary_category TEXT;

-- Student-specific
ALTER TABLE users ADD COLUMN IF NOT EXISTS student_level TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS student_field TEXT;

-- Worker-specific
ALTER TABLE users ADD COLUMN IF NOT EXISTS work_field TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS work_field_other TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS work_years_experience TEXT;

-- Researcher-specific
ALTER TABLE users ADD COLUMN IF NOT EXISTS research_field TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS research_years_experience TEXT;

-- Additional interests
ALTER TABLE users ADD COLUMN IF NOT EXISTS additional_interests TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS additional_interests_other TEXT;

-- 3. Add check constraints for enum fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'primary_category_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT primary_category_check
      CHECK (primary_category IS NULL OR primary_category IN ('student', 'worker', 'researcher'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'student_level_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT student_level_check
      CHECK (student_level IS NULL OR student_level IN ('high_school', 'college', 'medical_school', 'law_school', 'graduate_school', 'other'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'work_field_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT work_field_check
      CHECK (work_field IS NULL OR work_field IN ('consulting', 'engineering', 'product', 'finance', 'marketing', 'design', 'sales', 'operations', 'legal', 'healthcare', 'education', 'other'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'work_years_experience_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT work_years_experience_check
      CHECK (work_years_experience IS NULL OR work_years_experience IN ('1-2', '3-5', '6-10', '10+'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'research_years_experience_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT research_years_experience_check
      CHECK (research_years_experience IS NULL OR research_years_experience IN ('1-2', '3-5', '6-10', '10+'));
  END IF;
END
$$;

-- 4. Set existing users as onboarding_completed = true (they don't need the wizard)
UPDATE users SET onboarding_completed = true WHERE onboarding_completed IS NULL OR onboarding_completed = false;

-- 5. Drop old columns if they exist (from previous version of this migration)
ALTER TABLE users DROP COLUMN IF EXISTS role;
ALTER TABLE users DROP COLUMN IF EXISTS learning_goals;
ALTER TABLE users DROP COLUMN IF EXISTS expertise_level;
ALTER TABLE users DROP COLUMN IF EXISTS card_style;
ALTER TABLE users DROP COLUMN IF EXISTS domains;

-- Drop old constraints if they exist
ALTER TABLE users DROP CONSTRAINT IF EXISTS expertise_level_check;
ALTER TABLE users DROP CONSTRAINT IF EXISTS card_style_check;
