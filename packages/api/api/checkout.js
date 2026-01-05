// POST /api/checkout - Create Stripe Checkout session for subscription
import stripe, { PLUCKK_PRO_PRICE_ID } from '../lib/stripe.js';
import { authenticateRequest } from '../lib/auth.js';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

    // Check if user already has an active subscription
    if (profile.subscription_status === 'active') {
      return res.status(400).json({ error: 'already_subscribed' });
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
    const { successUrl, cancelUrl } = req.body;
    const baseUrl = successUrl?.split('?')[0] || 'https://pluckk-xi.vercel.app';

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

    return res.status(200).json({
      sessionId: session.id,
      url: session.url
    });
  } catch (error) {
    console.error('Checkout error:', error);
    return res.status(500).json({ error: 'checkout_failed', message: error.message });
  }
}
