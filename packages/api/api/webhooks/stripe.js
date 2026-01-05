// POST /api/webhooks/stripe - Handle Stripe webhook events
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Disable body parsing - we need the raw body for signature verification
export const config = {
  api: {
    bodyParser: false
  }
};

// Helper to get raw body
async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawBody = await getRawBody(req);
    const signature = req.headers['stripe-signature'];

    let event;

    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, endpointSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        await handleCheckoutComplete(session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
}

/**
 * Handle successful checkout - activate subscription
 */
async function handleCheckoutComplete(session) {
  const customerId = session.customer;
  const userId = session.metadata?.supabase_user_id;

  if (!userId) {
    // Try to find user by customer ID
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (user) {
      await updateUserSubscription(user.id, 'active');
    }
  } else {
    await updateUserSubscription(userId, 'active');
  }

  console.log(`Checkout completed for customer ${customerId}`);
}

/**
 * Handle subscription updates
 */
async function handleSubscriptionUpdate(subscription) {
  const customerId = subscription.customer;
  const status = subscription.status;

  // Find user by customer ID
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!user) {
    console.error(`No user found for customer ${customerId}`);
    return;
  }

  // Map Stripe status to our status
  let ourStatus = 'free';
  if (status === 'active' || status === 'trialing') {
    ourStatus = 'active';
  } else if (status === 'past_due') {
    ourStatus = 'past_due';
  } else if (status === 'canceled' || status === 'unpaid') {
    ourStatus = 'canceled';
  }

  await updateUserSubscription(user.id, ourStatus, subscription.current_period_start);
  console.log(`Subscription updated for user ${user.id}: ${ourStatus}`);
}

/**
 * Handle subscription deletion
 */
async function handleSubscriptionDeleted(subscription) {
  const customerId = subscription.customer;

  // Find user by customer ID
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!user) {
    console.error(`No user found for customer ${customerId}`);
    return;
  }

  await updateUserSubscription(user.id, 'canceled');
  console.log(`Subscription canceled for user ${user.id}`);
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice) {
  const customerId = invoice.customer;

  // Find user by customer ID
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!user) {
    console.error(`No user found for customer ${customerId}`);
    return;
  }

  await updateUserSubscription(user.id, 'past_due');
  console.log(`Payment failed for user ${user.id}`);
}

/**
 * Update user subscription status in database
 */
async function updateUserSubscription(userId, status, periodStart = null) {
  const updates = {
    subscription_status: status
  };

  // If activating, reset the monthly counter and set period start
  if (status === 'active') {
    updates.cards_generated_this_month = 0;
    if (periodStart) {
      updates.current_period_start = new Date(periodStart * 1000).toISOString();
    }
  }

  const { error } = await supabaseAdmin
    .from('users')
    .update(updates)
    .eq('id', userId);

  if (error) {
    console.error(`Failed to update user ${userId}:`, error);
  }
}
