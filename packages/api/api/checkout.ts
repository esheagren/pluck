// POST /api/checkout - Create Stripe Checkout session for subscription
import type { VercelRequest, VercelResponse } from '@vercel/node';
import stripe, { PLUCKK_PRO_PRICE_ID } from '../lib/stripe.js';
import { authenticateRequest, isAuthError } from '../lib/auth.js';
import { createClient } from '@supabase/supabase-js';
import type { CheckoutRequest } from '../lib/types.js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

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

    const { user, profile } = authResult;

    // Check if user already has an active subscription
    if (profile.subscription_status === 'active') {
      res.status(400).json({ error: 'already_subscribed' });
      return;
    }

    // Get or create Stripe customer
    let customerId = profile.stripe_customer_id;

    if (!customerId) {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id
        }
      });
      customerId = customer.id;

      // Save customer ID to user profile
      await supabaseAdmin
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    // Get success/cancel URLs from request or use defaults
    const { successUrl, cancelUrl } = (req.body || {}) as CheckoutRequest;
    const baseUrl = successUrl?.split('?')[0] || 'https://pluckk-xi.vercel.app';

    if (!PLUCKK_PRO_PRICE_ID) {
      res.status(500).json({ error: 'Stripe price not configured' });
      return;
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: PLUCKK_PRO_PRICE_ID,
          quantity: 1
        }
      ],
      mode: 'subscription',
      success_url: `${baseUrl}?checkout=success`,
      cancel_url: cancelUrl || `${baseUrl}?checkout=canceled`,
      metadata: {
        supabase_user_id: user.id
      }
    });

    res.status(200).json({
      sessionId: session.id,
      url: session.url
    });
  } catch (error) {
    console.error('Checkout error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'checkout_failed', message });
  }
}
