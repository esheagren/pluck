// Stripe client initialization
import Stripe from 'stripe';

// Initialize Stripe with secret key from environment
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Price ID for Pluckk Pro subscription (set this after creating in Stripe dashboard)
export const PLUCKK_PRO_PRICE_ID = process.env.STRIPE_PRICE_ID;

export default stripe;
