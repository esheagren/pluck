-- Migration: Folders feature for organizing cards
-- Run this in Supabase SQL Editor after 002_spaced_repetition.sql

-- ============================================================================
-- SECTION 1: FOLDERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280', -- gray-500 default
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Each user's folder names should be unique
  UNIQUE(user_id, name)
);

-- Index for efficient user folder queries
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_sort_order ON folders(user_id, sort_order);

-- ============================================================================
-- SECTION 2: ADD folder_id TO CARDS
-- ============================================================================

-- Add folder reference to cards (nullable - unfiled cards have NULL)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;

-- Index for filtering cards by folder
CREATE INDEX IF NOT EXISTS idx_cards_folder_id ON cards(folder_id);
CREATE INDEX IF NOT EXISTS idx_cards_user_folder ON cards(user_id, folder_id);

-- ============================================================================
-- SECTION 3: ROW LEVEL SECURITY FOR FOLDERS
-- ============================================================================

ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

-- Users can only see their own folders
CREATE POLICY "Users can view own folders" ON folders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own folders" ON folders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own folders" ON folders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own folders" ON folders
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- SECTION 4: UPDATED_AT TRIGGER
-- ============================================================================

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_folders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER folders_updated_at
  BEFORE UPDATE ON folders
  FOR EACH ROW
  EXECUTE FUNCTION update_folders_updated_at();
