// Pluckk Extension - Auth Module
// Google sign-in via chrome.identity → Google OIDC (id_token) → POST /api/v1/auth/google
// → Pluckk bearer token stored in chrome.storage.local. Replaces the Supabase flow.

import { BACKEND_URL } from '@pluckk/shared/constants';
import { createApiClient, buildGoogleAuthUrl, parseIdToken } from '@pluckk/shared/api';
import type { AuthUser } from '@pluckk/shared/api';
import type { PluckkSession, SessionUser, UserProfile } from './types';

const SESSION_KEY = 'pluckk_session';

export type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT';
export type AuthStateCallback = (event: AuthEvent, session: PluckkSession | null) => void;

export interface SignInResult { session: PluckkSession; user: SessionUser }
export interface SessionResult { session: PluckkSession | null; user: SessionUser | null }
export interface SignOutResult { error: Error | null }

/** Shared API client for the extension (token from chrome.storage.local). */
export const api = createApiClient({
  baseUrl: BACKEND_URL,
  getToken: getAccessToken,
  onUnauthorized: () => { chrome.storage.local.remove(SESSION_KEY); },
});

/** Chrome extension redirect URL (stable thanks to the fixed `key` in manifest.json). */
export function getRedirectUrl(): string {
  return chrome.identity.getRedirectURL();
}

function toSessionUser(u: AuthUser): SessionUser {
  return { id: u.id, email: u.email ?? '', user_metadata: { display_name: u.display_name, avatar_url: u.avatar_url, username: u.username } };
}

/**
 * Sign in with Google using Chrome identity API.
 * Google returns an id_token in the fragment; the API swaps it for a bearer token.
 */
export async function signInWithGoogle(): Promise<SignInResult> {
  const authUrl = buildGoogleAuthUrl({ redirectUri: getRedirectUrl() });

  const responseUrl = await new Promise<string>((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (url?: string) => {
      if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
      if (!url) { reject(new Error('No response URL')); return; }
      resolve(url);
    });
  });

  const idToken = parseIdToken(responseUrl);
  if (!idToken) throw new Error('No id_token in Google response');

  const { token, user } = await api.auth.google(idToken, 'extension');
  const session: PluckkSession = { access_token: token, user: toSessionUser(user) };
  await chrome.storage.local.set({ [SESSION_KEY]: session });
  return { session, user: session.user };
}

/** Get the current session from storage. Tokens don't expire client-side; the API returns 401 if revoked. */
export async function getSession(): Promise<SessionResult> {
  const result = await chrome.storage.local.get(SESSION_KEY);
  const session = result[SESSION_KEY] as PluckkSession | undefined;
  if (!session?.access_token) return { session: null, user: null };
  return { session, user: session.user };
}

/** Sign out: revoke the token server-side, clear local session. */
export async function signOut(): Promise<SignOutResult> {
  try { await api.auth.logout(); } catch (error) { console.error('Error revoking token:', error); }
  await chrome.storage.local.remove(SESSION_KEY);
  return { error: null };
}

/** Bearer token for API calls. */
export async function getAccessToken(): Promise<string | null> {
  const { session } = await getSession();
  return session?.access_token || null;
}

/** User profile from backend (/api/user/me). */
export async function getUserProfile(): Promise<UserProfile | null> {
  const token = await getAccessToken();
  if (!token) return null;
  try {
    return (await api.user.me()) as unknown as UserProfile;
  } catch (error) {
    console.error('Failed to get user profile:', error);
    return null;
  }
}

/** Listen for auth state changes (session updates in chrome.storage.local). */
export function onAuthStateChange(callback: AuthStateCallback): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[SESSION_KEY]) {
      const newSession = changes[SESSION_KEY].newValue as PluckkSession | undefined;
      if (newSession) callback('SIGNED_IN', newSession);
      else callback('SIGNED_OUT', null);
    }
  });
}
