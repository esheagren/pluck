// Authentication middleware for Vercel serverless functions
import type { VercelRequest } from '@vercel/node';
import { getUserFromToken, getUserProfile } from './supabase-admin.js';
import type { AuthResult, AuthSuccess, AuthError, UsageLimitResult, UserProfile } from './types.js';

/**
 * Type guard to check if auth result is an error
 */
export function isAuthError(result: AuthResult): result is AuthError {
  return 'error' in result && result.error !== undefined;
}

/**
 * Type guard to check if auth result is successful
 */
export function isAuthSuccess(result: AuthResult): result is AuthSuccess {
  return 'user' in result && result.user !== undefined;
}

const FREE_TIER_LIMIT = 20;

/**
 * Extract Bearer token from Authorization header
 */
function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Authenticate request and check usage limits
 * Returns { user, profile } on success, or { error, status } on failure
 */
export async function authenticateRequest(req: VercelRequest): Promise<AuthResult> {
  const token = extractToken(req.headers.authorization);

  if (!token) {
    return { error: 'Missing authorization token', status: 401 };
  }

  // Verify token and get user
  const user = await getUserFromToken(token);
  if (!user) {
    return { error: 'Invalid or expired token', status: 401 };
  }

  // Get user profile with subscription info
  const profile = await getUserProfile(user.id);
  if (!profile) {
    return { error: 'User profile not found', status: 401 };
  }

  return { user, profile };
}

/**
 * Check if user has remaining card generation quota
 */
export function checkUsageLimit(profile: UserProfile): UsageLimitResult {
  // Paid users and admins have unlimited access
  if (profile.subscription_status === 'active' || profile.subscription_status === 'admin') {
    return { allowed: true, remaining: Infinity };
  }

  // Free tier check
  const used = profile.cards_generated_this_month || 0;
  const remaining = FREE_TIER_LIMIT - used;

  return {
    allowed: remaining > 0,
    remaining: Math.max(0, remaining),
    limit: FREE_TIER_LIMIT
  };
}
