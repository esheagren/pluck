// GET /api/user/check-username?username=xxx
// Check if username is available (no auth required)
// NOTE: Consider adding rate limiting in production to prevent enumeration attacks

import { supabaseAdmin } from '../../lib/supabase-admin.js';

// Validate username format (matches database function)
function isValidUsernameFormat(username) {
  if (!username || typeof username !== 'string') return false;
  if (username.length < 3 || username.length > 30) return false;
  return /^[a-z][a-z0-9_]*$/.test(username);
}

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username } = req.query;

  if (!username) {
    return res.status(400).json({ error: 'Username required' });
  }

  const normalizedUsername = username.toLowerCase().trim();

  // Check format validity
  if (!isValidUsernameFormat(normalizedUsername)) {
    return res.status(200).json({
      available: false,
      reason: 'invalid_format',
      message: 'Username must be 3-30 characters, start with a letter, and contain only lowercase letters, numbers, and underscores'
    });
  }

  // Check if reserved
  const { data: reserved } = await supabaseAdmin
    .from('reserved_usernames')
    .select('username')
    .eq('username', normalizedUsername)
    .single();

  if (reserved) {
    return res.status(200).json({
      available: false,
      reason: 'reserved',
      message: 'This username is reserved'
    });
  }

  // Check if taken
  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('id')
    .ilike('username', normalizedUsername)
    .single();

  if (existing) {
    return res.status(200).json({
      available: false,
      reason: 'taken',
      message: 'This username is already taken'
    });
  }

  return res.status(200).json({
    available: true,
    username: normalizedUsername
  });
}
