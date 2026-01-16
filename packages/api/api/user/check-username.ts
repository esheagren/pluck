// GET /api/user/check-username?username=xxx
// Check if username is available (no auth required)
// NOTE: Consider adding rate limiting in production to prevent enumeration attacks

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../lib/supabase-admin.js';

// Validate username format (matches database function)
function isValidUsernameFormat(username: string): boolean {
  if (!username || typeof username !== 'string') return false;
  if (username.length < 3 || username.length > 30) return false;
  return /^[a-z][a-z0-9_]*$/.test(username);
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

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { username } = req.query;

  if (!username || typeof username !== 'string') {
    res.status(400).json({ error: 'Username required' });
    return;
  }

  const normalizedUsername = username.toLowerCase().trim();

  // Check format validity
  if (!isValidUsernameFormat(normalizedUsername)) {
    res.status(200).json({
      available: false,
      reason: 'invalid_format',
      message: 'Username must be 3-30 characters, start with a letter, and contain only lowercase letters, numbers, and underscores'
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
    res.status(200).json({
      available: false,
      reason: 'reserved',
      message: 'This username is reserved'
    });
    return;
  }

  // Check if taken
  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('id')
    .ilike('username', normalizedUsername)
    .single();

  if (existing) {
    res.status(200).json({
      available: false,
      reason: 'taken',
      message: 'This username is already taken'
    });
    return;
  }

  res.status(200).json({
    available: true,
    username: normalizedUsername
  });
}
