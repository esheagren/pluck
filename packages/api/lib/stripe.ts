// Stripe client initialization
import Stripe from 'stripe';

// Initialize Stripe with secret key from environment
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16'
});

// Price ID for Pluckk Pro subscription (set this after creating in Stripe dashboard)
export const PLUCKK_PRO_PRICE_ID: string | undefined = process.env.STRIPE_PRICE_ID;

export default stripe;
