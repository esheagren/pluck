// POST /api/portal - Create Stripe Customer Portal session
import stripe from '../lib/stripe.js';
import { authenticateRequest } from '../lib/auth.js';

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authenticate the request
    const { user, profile, error: authError } = await authenticateRequest(req);
    if (authError) {
      return res.status(401).json({ error: authError });
    }

    // Check if user has a Stripe customer ID
    if (!profile.stripe_customer_id) {
      return res.status(400).json({ error: 'no_customer', message: 'No billing account found' });
    }

    // Get return URL from request or use default
    const { returnUrl } = req.body;
    const baseUrl = returnUrl || 'https://pluckk-xi.vercel.app';

    // Create Customer Portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: baseUrl
    });

    return res.status(200).json({
      url: session.url
    });
  } catch (error) {
    console.error('Portal error:', error);
    return res.status(500).json({ error: 'portal_failed', message: error.message });
  }
}
