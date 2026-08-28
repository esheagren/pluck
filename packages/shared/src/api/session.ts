// Browser (webapp) session store: bearer token + user in localStorage, with a
// tiny event bus so React can react to sign-in/out. Extension uses its own
// chrome.storage-backed store (packages/extension/src/auth.ts).

import { createApiClient, type AuthUser } from './client';

const TOKEN_KEY = 'pluckk_token';
const USER_KEY = 'pluckk_user';

export type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT';
type Listener = (event: AuthEvent, user: AuthUser | null) => void;
const listeners = new Set<Listener>();

function safeGet(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }
function safeSet(key: string, v: string | null) { try { v === null ? localStorage.removeItem(key) : localStorage.setItem(key, v); } catch { /* ignore */ } }

export function getAccessToken(): string | null { return safeGet(TOKEN_KEY); }
export function getStoredUser(): AuthUser | null {
  const raw = safeGet(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as AuthUser; } catch { return null; }
}
export function setSession(token: string, user: AuthUser): void {
  safeSet(TOKEN_KEY, token); safeSet(USER_KEY, JSON.stringify(user));
  listeners.forEach((l) => l('SIGNED_IN', user));
}
export function clearSession(): void {
  safeSet(TOKEN_KEY, null); safeSet(USER_KEY, null);
  listeners.forEach((l) => l('SIGNED_OUT', null));
}
export function onAuthStateChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Shared client for the webapp: reads the token from localStorage, clears it on 401. */
export const api = createApiClient({ getToken: getAccessToken, onUnauthorized: clearSession });

/** Complete Google Sign-In: exchange the ID token, persist the session. */
export async function signInWithGoogleCredential(credential: string): Promise<AuthUser> {
  const { token, user } = await api.auth.google(credential, 'webapp');
  setSession(token, user);
  return user;
}

export async function signOut(): Promise<void> {
  try { if (getAccessToken()) await api.auth.logout(); } catch { /* token may already be dead */ }
  clearSession();
}

/** Kept for call-site compatibility (FeedbackPage/FeedbackModal). */
export async function submitFeedback(_userId: string, feedbackText: string): Promise<{ success: true }> {
  if (!feedbackText?.trim()) throw new Error('Feedback text is required');
  return api.feedback.submit(feedbackText.trim());
}
