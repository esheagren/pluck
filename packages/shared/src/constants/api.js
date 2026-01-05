// API URLs and configuration constants

// Backend API (proxies Claude/Gemini calls)
export const BACKEND_URL = 'https://pluckk-api.vercel.app';

// Direct API URLs (deprecated - use BACKEND_URL for Claude/Gemini)
export const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
export const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
export const GEMINI_IMAGE_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

// Mochi API (still called directly with user's own key)
export const MOCHI_API_URL = 'https://app.mochi.cards/api';

// Supabase configuration
export const SUPABASE_URL = 'https://grjkoedivfrjlbtfskif.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_E1Is2auN23lNbPWDPzbgYw_RxERFa0W';

// Stripe configuration
export const STRIPE_PUBLISHABLE_KEY = 'pk_live_51Q1X4IAiykuoRvR46SWYJHWLh6m5CdMxFDcuC5u72Sn35Jj8HBrdiyygYYmoKxaOtLu6OAgw1iib7f9xXYGwdR6G00trIh6TA9';

// Usage limits
export const FREE_TIER_LIMIT = 20;
