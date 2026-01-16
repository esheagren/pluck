/**
 * Type definitions for Stripe webhook handling
 */

import type Stripe from 'stripe';

/**
 * Subscription status values we use internally
 */
export type SubscriptionStatus = 'free' | 'active' | 'past_due' | 'canceled' | 'admin';

/**
 * Webhook event types we handle
 */
export type HandledWebhookEvent =
  | 'checkout.session.completed'
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'invoice.payment_failed';

/**
 * Webhook handler function type
 */
export type WebhookHandler<T> = (data: T) => Promise<void>;

/**
 * Map of webhook handlers
 */
export interface WebhookHandlers {
  'checkout.session.completed': WebhookHandler<Stripe.Checkout.Session>;
  'customer.subscription.created': WebhookHandler<Stripe.Subscription>;
  'customer.subscription.updated': WebhookHandler<Stripe.Subscription>;
  'customer.subscription.deleted': WebhookHandler<Stripe.Subscription>;
  'invoice.payment_failed': WebhookHandler<Stripe.Invoice>;
}

/**
 * User subscription updates
 */
export interface SubscriptionUpdate {
  subscription_status: SubscriptionStatus;
  cards_generated_this_month?: number;
  current_period_start?: string;
}

/**
 * Vercel API route config for disabling body parser
 */
export interface VercelApiConfig {
  api: {
    bodyParser: boolean;
  };
}
