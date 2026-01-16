// GET /api/mochi-status
// Returns whether user has Mochi configured

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, isAuthError } from '../lib/auth.js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const authResult = await authenticateRequest(req);
  if (isAuthError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const { profile } = authResult;

  res.status(200).json({
    configured: !!(profile.mochi_api_key && profile.mochi_deck_id)
  });
}
