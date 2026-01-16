/**
 * Type definitions for API request/response types
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { User as SupabaseUser } from '@supabase/supabase-js';

// Re-export Card types from shared package
export type { Card, CardStyle, QACard, BidirectionalCard, ClozeCard, ClozeListCard } from '@pluckk/shared';

/**
 * Vercel API handler type
 */
export type ApiHandler = (
  req: VercelRequest,
  res: VercelResponse
) => Promise<void> | void;

/**
 * User profile from database
 */
export interface UserProfile {
  id: string;
  email?: string;
  username?: string | null;
  display_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  profile_is_public?: boolean;
  created_at?: string;
  updated_at?: string;
  subscription_status: 'free' | 'active' | 'past_due' | 'canceled' | 'admin';
  stripe_customer_id?: string | null;
  cards_generated_this_month?: number;
  current_period_start?: string | null;
  mochi_api_key?: string | null;
  mochi_deck_id?: string | null;
}

/**
 * Authentication result - success case
 */
export interface AuthSuccess {
  user: SupabaseUser;
  profile: UserProfile;
  error?: undefined;
  status?: undefined;
}

/**
 * Authentication result - error case
 */
export interface AuthError {
  error: string;
  status: number;
  user?: undefined;
  profile?: undefined;
}

/**
 * Combined authentication result type
 */
export type AuthResult = AuthSuccess | AuthError;

/**
 * Usage limit check result
 */
export interface UsageLimitResult {
  allowed: boolean;
  remaining: number;
  limit?: number;
}

/**
 * Generate cards request body
 */
export interface GenerateCardsRequest {
  selection: string;
  context?: string;
  url?: string;
  title?: string;
  focusText?: string;
  customPrompt?: string;
}

/**
 * Generate cards from image request body
 */
export interface GenerateCardsFromImageRequest {
  imageData: string;
  mimeType: string;
  focusText?: string;
}

/**
 * Generate image request body
 */
export interface GenerateImageRequest {
  question: string;
  answer: string;
  sourceUrl?: string;
  diagramPrompt?: string;
}

/**
 * Answer question request body
 */
export interface AnswerQuestionRequest {
  question: string;
  url?: string;
  title?: string;
}

/**
 * Send to Mochi request body
 */
export interface SendToMochiRequest {
  question: string;
  answer: string;
  sourceUrl?: string;
  imageData?: string;
  imageMimeType?: string;
}

/**
 * Attach Mochi image request body
 */
export interface AttachMochiImageRequest {
  cardId: string;
  imageData: string;
  imageMimeType: string;
  originalContent?: string;
}

/**
 * Checkout request body
 */
export interface CheckoutRequest {
  successUrl?: string;
  cancelUrl?: string;
}

/**
 * Portal request body
 */
export interface PortalRequest {
  returnUrl?: string;
}

/**
 * User settings update request body
 */
export interface UpdateUserSettingsRequest {
  mochiApiKey?: string | null;
  mochiDeckId?: string | null;
  username?: string | null;
  displayName?: string | null;
  bio?: string | null;
  profileIsPublic?: boolean;
}

/**
 * Standard API success response
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data?: T;
}

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
  error: string;
  message?: string;
  code?: string;
  details?: string;
}

/**
 * Usage info included in responses
 */
export interface UsageInfo {
  remaining: number | 'unlimited';
  limit?: number;
  subscription: string;
}

/**
 * Cards generation response
 */
export interface GenerateCardsSuccessResponse {
  cards: GeneratedCard[];
  isPro?: boolean;
  usage: UsageInfo;
}

/**
 * Generated card from Claude (raw format before normalization)
 */
export interface GeneratedCard {
  style: string;
  question?: string;
  answer?: string;
  forward?: { question: string; answer: string };
  reverse?: { question: string; answer: string };
  text?: string;
  cloze_deletions?: string[];
  list_name?: string;
  items?: string[];
  prompts?: Array<{ question: string; answer: string }>;
  diagram_prompt?: string;
  rationale?: string;
  originalQuestion?: string;
  wasImproved?: boolean;
  tags?: {
    content_type?: string;
    domain?: string;
    [key: string]: string | undefined;
  };
}

/**
 * Image generation response
 */
export interface GenerateImageResponse {
  imageData: string;
  mimeType: string;
}

/**
 * Mochi card creation response
 */
export interface MochiCardResponse {
  id: string;
  content?: string;
  [key: string]: unknown;
}

/**
 * Public profile data
 */
export interface PublicProfile {
  id: string;
  username: string;
  display_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  created_at: string;
}

/**
 * Public card data
 */
export interface PublicCard {
  id: string;
  question: string;
  answer: string;
  style?: string;
  tags?: Record<string, string>;
  created_at: string;
}

/**
 * Activity day data
 */
export interface ActivityDay {
  review_date: string;
  total_reviews: number;
}

/**
 * Username availability check response
 */
export interface UsernameCheckResponse {
  available: boolean;
  reason?: 'invalid_format' | 'reserved' | 'taken';
  message?: string;
  username?: string;
}
