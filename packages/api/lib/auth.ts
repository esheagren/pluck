// Authentication for Vercel serverless functions.
//
// One credential type for every client (webapp, extension, macOS): an opaque
// bearer token issued by POST /api/auth/google and stored hashed in api_tokens.
// Replaces the Supabase JWT + RLS model (2026-08-28).

import { createHash, randomBytes } from 'node:crypto';
import type { VercelRequest } from '@vercel/node';
import { eq } from 'drizzle-orm';
import { getDb, schema } from './db.js';
import type { AuthResult, AuthSuccess, AuthError } from './types.js';

export function isAuthError(result: AuthResult): result is AuthError {
  return 'error' in result && result.error !== undefined;
}
export function isAuthSuccess(result: AuthResult): result is AuthSuccess {
  return 'user' in result && result.user !== undefined;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Mint a new bearer token for a user. Returns the plaintext once. */
export async function issueToken(userId: string, label: string): Promise<string> {
  const token = 'pk_' + randomBytes(32).toString('base64url');
  await getDb().insert(schema.apiTokens).values({ userId, tokenHash: hashToken(token), label });
  return token;
}

export async function revokeToken(token: string): Promise<void> {
  await getDb().delete(schema.apiTokens).where(eq(schema.apiTokens.tokenHash, hashToken(token)));
}

function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.substring(7).trim();
}

/** Resolve a bearer token to its user row, or null. */
export async function getUserFromToken(token: string): Promise<schema.User | null> {
  if (!token) return null;
  const db = getDb();
  const rows = await db
    .select({ user: schema.users, tokenId: schema.apiTokens.id, expiresAt: schema.apiTokens.expiresAt })
    .from(schema.apiTokens)
    .innerJoin(schema.users, eq(schema.apiTokens.userId, schema.users.id))
    .where(eq(schema.apiTokens.tokenHash, hashToken(token)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt && new Date(row.expiresAt) < new Date()) return null;
  // Best-effort last-used stamp; never block the request on it.
  db.update(schema.apiTokens).set({ lastUsedAt: new Date().toISOString() })
    .where(eq(schema.apiTokens.id, row.tokenId)).catch(() => {});
  return row.user;
}

/**
 * Authenticate request. Returns { user, profile } (both the same users row —
 * `profile` kept for call-site compatibility) or { error, status }.
 */
export async function authenticateRequest(req: VercelRequest): Promise<AuthResult> {
  const token = extractToken(req.headers.authorization);
  if (!token) return { error: 'Missing authorization token', status: 401 };
  const user = await getUserFromToken(token);
  if (!user) return { error: 'Invalid or expired token', status: 401 };
  return { user, profile: user };
}
