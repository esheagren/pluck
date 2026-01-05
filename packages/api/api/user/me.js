// GET /api/user/me
// Returns current user info and usage stats

import { authenticateRequest, checkUsageLimit } from '../../lib/auth.js';

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Authenticate user
  const authResult = await authenticateRequest(req);
  if (authResult.error) {
    return res.status(authResult.status).json({ error: authResult.error });
  }

  const { user, profile } = authResult;
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
    }
  });
}
