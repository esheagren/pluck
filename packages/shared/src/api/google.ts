// Google OpenID Connect implicit flow helpers, shared by the webapp (redirect)
// and the extension (chrome.identity.launchWebAuthFlow). Produces an ID token
// that POST /api/v1/auth/google verifies and swaps for a Pluckk bearer token.

import { GOOGLE_CLIENT_ID } from '../constants/api';

export interface GoogleAuthUrlOptions {
  redirectUri: string;
  clientId?: string;
  nonce?: string;
  state?: string;
  loginHint?: string;
}

export function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function buildGoogleAuthUrl(opts: GoogleAuthUrlOptions): string {
  const clientId = opts.clientId ?? GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID is not configured');
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', opts.redirectUri);
  url.searchParams.set('response_type', 'id_token');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('nonce', opts.nonce ?? randomNonce());
  url.searchParams.set('prompt', 'select_account');
  if (opts.state) url.searchParams.set('state', opts.state);
  if (opts.loginHint) url.searchParams.set('login_hint', opts.loginHint);
  return url.toString();
}

/** Extract `id_token` from a redirect URL's fragment (or query, defensively). */
export function parseIdToken(responseUrl: string): string | null {
  try {
    const u = new URL(responseUrl);
    const hash = new URLSearchParams(u.hash.replace(/^#/, ''));
    return hash.get('id_token') ?? u.searchParams.get('id_token');
  } catch {
    return null;
  }
}
