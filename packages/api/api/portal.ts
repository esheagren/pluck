// POST /api/portal - Create Stripe Customer Portal session
import type { VercelRequest, VercelResponse } from '@vercel/node';
import stripe from '../lib/stripe.js';
import { authenticateRequest, isAuthError } from '../lib/auth.js';
import type { PortalRequest } from '../lib/types.js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(200).end();
    return;
  }

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Authenticate the request
    const authResult = await authenticateRequest(req);
    if (isAuthError(authResult)) {
      res.status(401).json({ error: authResult.error });
      return;
    }

    const { profile } = authResult;

    // Check if user has a Stripe customer ID
    if (!profile.stripe_customer_id) {
      res.status(400).json({ error: 'no_customer', message: 'No billing account found' });
      return;
    }

    // Get return URL from request or use default
    const { returnUrl } = (req.body || {}) as PortalRequest;
    const baseUrl = returnUrl || 'https://pluckk-xi.vercel.app';

    // Create Customer Portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: baseUrl
    });

    res.status(200).json({
      url: session.url
    });
  } catch (error) {
    console.error('Portal error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'portal_failed', message });
  }
}
