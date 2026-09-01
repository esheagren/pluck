-- Migration: Users table, cards updates, and RLS policies
-- Run this in Supabase SQL Editor

-- 1. Create users table (links to Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  stripe_customer_id TEXT,
  subscription_status TEXT DEFAULT 'free'
    CHECK (subscription_status IN ('free', 'active', 'canceled', 'past_due')),
  cards_generated_this_month INTEGER DEFAULT 0,
  current_period_start TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add user_id and is_public columns to cards table
ALTER TABLE cards ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;

-- 3. Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_cards_user_id ON cards(user_id);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);

-- 4. Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 5. Users can only see/edit their own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- 6. Enable RLS on cards table
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

-- 7. Cards policies: see own + public, edit only own
CREATE POLICY "Users can view own or public cards" ON cards
  FOR SELECT USING (
    user_id = auth.uid() OR
    is_public = true OR
    user_id IS NULL  -- Legacy cards without user_id
  );

CREATE POLICY "Users can insert own cards" ON cards
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own cards" ON cards
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own cards" ON cards
  FOR DELETE USING (user_id = auth.uid());

-- 8. Auto-create user profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END
$$;

-- 9. Function to reset monthly usage (call via cron or manually)
CREATE OR REPLACE FUNCTION reset_monthly_usage()
RETURNS void AS $$
BEGIN
  UPDATE users
  SET cards_generated_this_month = 0,
      current_period_start = NOW(),
      updated_at = NOW()
  WHERE current_period_start IS NULL
     OR current_period_start < NOW() - INTERVAL '1 month';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Helper function to increment card count (used by API)
CREATE OR REPLACE FUNCTION increment_card_count(p_user_id UUID, p_count INTEGER DEFAULT 1)
RETURNS void AS $$
BEGIN
  UPDATE users
  SET cards_generated_this_month = COALESCE(cards_generated_this_month, 0) + p_count,
      updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
