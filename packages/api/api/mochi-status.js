// GET /api/mochi-status
// Returns whether user has Mochi configured

import { authenticateRequest } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authResult = await authenticateRequest(req);
  if (authResult.error) {
    return res.status(authResult.status).json({ error: authResult.error });
  }

  const { profile } = authResult;

  return res.status(200).json({
    configured: !!(profile.mochi_api_key && profile.mochi_deck_id)
  });
}
