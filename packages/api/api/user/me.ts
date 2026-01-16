// GET/PATCH /api/user/me
// Returns current user info, usage stats, settings, and profile
// PATCH updates user settings (Mochi config) and profile fields

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, checkUsageLimit, isAuthError } from '../../lib/auth.js';
import { supabaseAdmin } from '../../lib/supabase-admin.js';
import type { UpdateUserSettingsRequest } from '../../lib/types.js';

// Validate username format (matches database function)
function isValidUsernameFormat(username: string | null | undefined): boolean {
  if (!username || typeof username !== 'string') return false;
  if (username.length < 3 || username.length > 30) return false;
  // Must start with letter, only lowercase letters/numbers/underscores
  return /^[a-z][a-z0-9_]*$/.test(username);
}

// Basic HTML tag sanitization to prevent XSS
function sanitizeText(text: string | null | undefined): string | null {
  if (!text) return null;
  // Remove all HTML tags
  return text.replace(/<[^>]*>/g, '').trim();
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Authenticate user
  const authResult = await authenticateRequest(req);
  if (isAuthError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const { user, profile } = authResult;

  // GET - Return user info, profile, and settings
  if (req.method === 'GET') {
    const usage = checkUsageLimit(profile);

    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        username: profile.username || null,
        displayName: profile.display_name || null,
        bio: profile.bio || null,
        avatarUrl: profile.avatar_url || null,
        profileIsPublic: profile.profile_is_public !== false,
        createdAt: profile.created_at
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
    return;
  }

  // PATCH - Update user settings and profile
  if (req.method === 'PATCH') {
    const { mochiApiKey, mochiDeckId, username, displayName, bio, profileIsPublic } = req.body as UpdateUserSettingsRequest;

    const updates: Record<string, unknown> = {};

    // Mochi settings
    if (mochiApiKey !== undefined) {
      updates.mochi_api_key = mochiApiKey || null;
    }
    if (mochiDeckId !== undefined) {
      updates.mochi_deck_id = mochiDeckId || null;
    }

    // Profile fields
    if (username !== undefined) {
      const normalizedUsername = username ? username.toLowerCase().trim() : null;

      if (normalizedUsername) {
        // Validate format
        if (!isValidUsernameFormat(normalizedUsername)) {
          res.status(400).json({
            error: 'Invalid username format',
            details: 'Username must be 3-30 characters, start with a letter, and contain only lowercase letters, numbers, and underscores'
          });
          return;
        }

        // Check if reserved
        const { data: reserved } = await supabaseAdmin
          .from('reserved_usernames')
          .select('username')
          .eq('username', normalizedUsername)
          .single();

        if (reserved) {
          res.status(400).json({ error: 'This username is reserved' });
          return;
        }

        // Check if taken by another user
        const { data: existing } = await supabaseAdmin
          .from('users')
          .select('id')
          .ilike('username', normalizedUsername)
          .neq('id', user.id)
          .single();

        if (existing) {
          res.status(409).json({ error: 'Username already taken' });
          return;
        }

        updates.username = normalizedUsername;
      } else {
        updates.username = null;
      }
    }

    if (displayName !== undefined) {
      const sanitized = sanitizeText(displayName);
      updates.display_name = sanitized ? sanitized.slice(0, 100) : null;
    }

    if (bio !== undefined) {
      const sanitized = sanitizeText(bio);
      updates.bio = sanitized ? sanitized.slice(0, 500) : null;
    }

    if (profileIsPublic !== undefined) {
      updates.profile_is_public = Boolean(profileIsPublic);
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No settings to update' });
      return;
    }

    updates.updated_at = new Date().toISOString();

    const { error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', user.id);

    if (error) {
      console.error('Error updating user settings:', error);
      if (error.code === '23505' && error.message.includes('username')) {
        res.status(409).json({ error: 'Username already taken' });
        return;
      }
      res.status(500).json({ error: 'Failed to update settings' });
      return;
    }

    res.status(200).json({ success: true, updated: Object.keys(updates) });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
