-- Migration: Source Anchoring
-- Run this in Supabase SQL Editor after 008_fix_review_summary_permissions.sql
-- Adds columns to store DOM location for deep-linking back to source text

-- Add source selector (CSS selector path to the element containing the selection)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS source_selector TEXT;

-- Add source text offset (character offset of selection start within the element's text content)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS source_text_offset INTEGER;

COMMENT ON COLUMN cards.source_selector IS 'CSS selector path to the DOM element containing the selected text';
COMMENT ON COLUMN cards.source_text_offset IS 'Character offset of selection start within the element text content';
