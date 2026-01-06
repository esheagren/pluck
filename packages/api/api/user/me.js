// GET/PATCH /api/user/me
// Returns current user info, usage stats, and settings
// PATCH updates user settings (Mochi config)

import { authenticateRequest, checkUsageLimit } from '../../lib/auth.js';
import { supabaseAdmin } from '../../lib/supabase-admin.js';

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Authenticate user
  const authResult = await authenticateRequest(req);
  if (authResult.error) {
    return res.status(authResult.status).json({ error: authResult.error });
  }

  const { user, profile } = authResult;

  // GET - Return user info and settings
  if (req.method === 'GET') {
    const usage = checkUsageLimit(profile);

    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email
      },
      subscription: {
        status: profile.subscription_status,
        isPro: profile.subscription_status === 'active'
      },
      usage: {
        cardsThisMonth: profile.cards_generated_this_month || 0,
        limit: usage.limit,
        remaining: usage.remaining === Infinity ? 'unlimited' : usage.remaining
      },
      settings: {
        mochiApiKey: profile.mochi_api_key || null,
        mochiDeckId: profile.mochi_deck_id || null
      }
    });
  }

  // PATCH - Update user settings
  if (req.method === 'PATCH') {
    const { mochiApiKey, mochiDeckId } = req.body;

    const updates = {};
    if (mochiApiKey !== undefined) {
      updates.mochi_api_key = mochiApiKey || null;
    }
    if (mochiDeckId !== undefined) {
      updates.mochi_deck_id = mochiDeckId || null;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No settings to update' });
    }

    const { error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', user.id);

    if (error) {
      console.error('Error updating user settings:', error);
      return res.status(500).json({ error: 'Failed to update settings' });
    }

    return res.status(200).json({ success: true, updated: updates });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
