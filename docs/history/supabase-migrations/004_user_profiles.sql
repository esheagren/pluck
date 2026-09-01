-- Migration: User Profiles
-- Run this in Supabase SQL Editor after 003_folders.sql

-- 1. Add profile columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_is_public BOOLEAN DEFAULT true;

-- 1b. Add check constraint for avatar_url (HTTPS only to prevent XSS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'avatar_url_https_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT avatar_url_https_check
      CHECK (avatar_url IS NULL OR avatar_url ~ '^https://');
  END IF;
END
$$;

-- 2. Add Mochi columns if they don't exist (may have been added manually)
ALTER TABLE users ADD COLUMN IF NOT EXISTS mochi_api_key TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mochi_deck_id TEXT;

-- 3. Create case-insensitive unique index on username
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users(LOWER(username));

-- 4. Create reserved usernames table
CREATE TABLE IF NOT EXISTS reserved_usernames (
  username TEXT PRIMARY KEY
);

-- Insert reserved usernames (system words that shouldn't be used)
INSERT INTO reserved_usernames (username) VALUES
  ('admin'), ('administrator'), ('api'), ('app'), ('help'), ('support'),
  ('settings'), ('profile'), ('user'), ('users'), ('login'), ('logout'),
  ('signup'), ('signin'), ('register'), ('account'), ('dashboard'), ('home'),
  ('pluckk'), ('pluck'), ('about'), ('privacy'), ('terms'), ('feedback'),
  ('cards'), ('review'), ('activity'), ('info'), ('billing'), ('upgrade'),
  ('pro'), ('premium'), ('enterprise'), ('team'), ('org'), ('organization'),
  ('moderator'), ('mod'), ('staff'), ('system'), ('root'), ('null'),
  ('undefined'), ('anonymous'), ('guest'), ('public'), ('private'),
  ('test'), ('demo'), ('example'), ('sample')
ON CONFLICT DO NOTHING;

-- 5. Function to validate username format
CREATE OR REPLACE FUNCTION is_valid_username(p_username TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check length (3-30 characters)
  IF LENGTH(p_username) < 3 OR LENGTH(p_username) > 30 THEN
    RETURN false;
  END IF;

  -- Check format: lowercase letters, numbers, underscores only
  -- Must start with a letter
  IF p_username !~ '^[a-z][a-z0-9_]*$' THEN
    RETURN false;
  END IF;

  -- Check not reserved
  IF EXISTS (SELECT 1 FROM reserved_usernames WHERE username = LOWER(p_username)) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- 6. Drop existing restrictive RLS policy and create new one for public profiles
DROP POLICY IF EXISTS "Users can view own profile" ON users;

-- Users can view their own profile OR public profiles
CREATE POLICY "Users can view own or public profiles" ON users
  FOR SELECT USING (
    auth.uid() = id
    OR profile_is_public = true
  );

-- 7. Function to get public profile by username (for unauthenticated access)
CREATE OR REPLACE FUNCTION get_public_profile(p_username TEXT)
RETURNS TABLE (
  id UUID,
  username TEXT,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  -- Validate input to prevent abuse
  IF p_username IS NULL OR p_username = '' THEN
    RETURN;
  END IF;

  -- Validate format matches allowed username pattern
  IF p_username !~ '^[a-z][a-z0-9_]{2,29}$' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.username,
    u.display_name,
    u.bio,
    u.avatar_url,
    u.created_at
  FROM users u
  WHERE LOWER(u.username) = LOWER(p_username)
    AND u.profile_is_public = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Function to check username availability
CREATE OR REPLACE FUNCTION check_username_available(p_username TEXT, p_exclude_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  available BOOLEAN,
  reason TEXT
) AS $$
DECLARE
  v_normalized TEXT;
BEGIN
  v_normalized := LOWER(TRIM(p_username));

  -- Check format validity first
  IF NOT is_valid_username(v_normalized) THEN
    RETURN QUERY SELECT false, 'invalid_format'::TEXT;
    RETURN;
  END IF;

  -- Check if taken by another user
  IF EXISTS (
    SELECT 1 FROM users u
    WHERE LOWER(u.username) = v_normalized
    AND (p_exclude_user_id IS NULL OR u.id != p_exclude_user_id)
  ) THEN
    RETURN QUERY SELECT false, 'taken'::TEXT;
    RETURN;
  END IF;

  -- Username is available
  RETURN QUERY SELECT true, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. View for public user cards (cards from users with public profiles)
CREATE OR REPLACE VIEW public_user_cards AS
SELECT
  c.id,
  c.question,
  c.answer,
  c.style,
  c.tags,
  c.created_at,
  c.user_id,
  u.username,
  u.display_name,
  u.avatar_url
FROM cards c
JOIN users u ON u.id = c.user_id
WHERE c.is_public = true
  AND u.profile_is_public = true
  AND u.username IS NOT NULL;

-- 10. Grant access to the view
GRANT SELECT ON public_user_cards TO authenticated;
GRANT SELECT ON public_user_cards TO anon;
