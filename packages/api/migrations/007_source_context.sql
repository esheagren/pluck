-- Migration: Source Context Storage
-- Run this in Supabase SQL Editor after 006_onboarding_profile.sql
-- Adds columns to store the original selection and context used to generate cards

-- Add source selection (the exact highlighted text)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS source_selection TEXT;

-- Add source context (surrounding ~500 chars with [[SELECTED]] markers)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS source_context TEXT;

-- Add source title (page title where card was created)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS source_title TEXT;

-- Optional: Add comment documenting the columns
COMMENT ON COLUMN cards.source_selection IS 'The exact text that was highlighted when generating this card';
COMMENT ON COLUMN cards.source_context IS 'Surrounding context with [[SELECTED]]..[[/SELECTED]] markers around the selection';
COMMENT ON COLUMN cards.source_title IS 'Title of the page where the card was created';
