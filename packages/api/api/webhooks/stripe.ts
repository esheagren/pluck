// POST /api/webhooks/stripe - Handle Stripe webhook events
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { IncomingMessage } from 'http';
import Stripe from 'stripe';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { SubscriptionStatus, SubscriptionUpdate } from '../../lib/stripe-types.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16'
});
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

const supabaseAdmin: SupabaseClient = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Disable body parsing - we need the raw body for signature verification
export const config = {
  api: {
    bodyParser: false
  }
};

// Helper to get raw body
async function getRawBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const rawBody = await getRawBody(req);
    const signature = req.headers['stripe-signature'] as string;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, endpointSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Webhook signature verification failed:', message);
      res.status(400).json({ error: `Webhook Error: ${message}` });
      return;
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutComplete(session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}

/**
 * Handle successful checkout - activate subscription
 */
async function handleCheckoutComplete(session: Stripe.Checkout.Session): Promise<void> {
  const customerId = session.customer as string;
  const userId = session.metadata?.supabase_user_id;

  if (!userId) {
    // Try to find user by customer ID
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (user) {
      await updateUserSubscription((user as { id: string }).id, 'active');
    }
  } else {
    await updateUserSubscription(userId, 'active');
  }

  console.log(`Checkout completed for customer ${customerId}`);
}

/**
 * Handle subscription updates
 */
async function handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
  const customerId = subscription.customer as string;
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
  let ourStatus: SubscriptionStatus = 'free';
  if (status === 'active' || status === 'trialing') {
    ourStatus = 'active';
  } else if (status === 'past_due') {
    ourStatus = 'past_due';
  } else if (status === 'canceled' || status === 'unpaid') {
    ourStatus = 'canceled';
  }

  await updateUserSubscription(
    (user as { id: string }).id,
    ourStatus,
    subscription.current_period_start
  );
  console.log(`Subscription updated for user ${(user as { id: string }).id}: ${ourStatus}`);
}

/**
 * Handle subscription deletion
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const customerId = subscription.customer as string;

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

  await updateUserSubscription((user as { id: string }).id, 'canceled');
  console.log(`Subscription canceled for user ${(user as { id: string }).id}`);
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId = invoice.customer as string;

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

  await updateUserSubscription((user as { id: string }).id, 'past_due');
  console.log(`Payment failed for user ${(user as { id: string }).id}`);
}

/**
 * Update user subscription status in database
 */
async function updateUserSubscription(
  userId: string,
  status: SubscriptionStatus,
  periodStart: number | null = null
): Promise<void> {
  const updates: SubscriptionUpdate = {
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
