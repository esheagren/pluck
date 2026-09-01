-- Migration: Fix Review Summary View Permissions
-- Run this in Supabase SQL Editor after 007_source_context.sql
--
-- Bug: The user_daily_review_summary view was created without GRANT permissions,
-- making it inaccessible to authenticated users via the REST API.
-- This caused the activity grid in the extension to show all gray squares
-- (no review data being fetched).

-- Grant access to authenticated users (matching user_daily_card_summary)
GRANT SELECT ON user_daily_review_summary TO authenticated;
