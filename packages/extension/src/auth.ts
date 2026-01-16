// Pluckk Extension - Auth Module
// Handles Google OAuth via Supabase for Chrome extension

import { SUPABASE_URL, SUPABASE_KEY, BACKEND_URL } from '@pluckk/shared/constants';
import type { PluckkSession, SessionUser, UserProfile } from './types';

const SESSION_KEY = 'pluckk_session';

// Auth state change event types
export type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT';

// Auth state change callback
export type AuthStateCallback = (event: AuthEvent, session: PluckkSession | null) => void;

// Sign-in result
export interface SignInResult {
  session: PluckkSession;
  user: SessionUser;
}

// Session result
export interface SessionResult {
  session: PluckkSession | null;
  user: SessionUser | null;
}

// Sign out result
export interface SignOutResult {
  error: Error | null;
}

/**
 * Get the Chrome extension redirect URL
 */
export function getRedirectUrl(): string {
  return chrome.identity.getRedirectURL();
}

/**
 * Sign in with Google using Chrome identity API
 */
export async function signInWithGoogle(): Promise<SignInResult> {
  const redirectUrl = getRedirectUrl();

  // Build the Supabase OAuth URL
  const authUrl = new URL(`${SUPABASE_URL}/auth/v1/authorize`);
  authUrl.searchParams.set('provider', 'google');
  authUrl.searchParams.set('redirect_to', redirectUrl);

  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      {
        url: authUrl.toString(),
        interactive: true
      },
      async (responseUrl?: string) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!responseUrl) {
          reject(new Error('No response URL'));
          return;
        }

        try {
          // Parse tokens from URL fragment
          const url = new URL(responseUrl);
          const hashParams = new URLSearchParams(url.hash.substring(1));

          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          const expiresIn = hashParams.get('expires_in');
          const expiresAt = hashParams.get('expires_at');

          if (!accessToken) {
            reject(new Error('No access token in response'));
            return;
          }

          // Get user info from Supabase
          const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'apikey': SUPABASE_KEY
            }
          });

          if (!userResponse.ok) {
            reject(new Error('Failed to get user info'));
            return;
          }

          const user = await userResponse.json();

          // Build session object
          const session: PluckkSession = {
            access_token: accessToken,
            refresh_token: refreshToken || '',
            expires_in: parseInt(expiresIn || '0', 10),
            expires_at: parseInt(expiresAt || '0', 10),
            user: {
              id: user.id,
              email: user.email,
              user_metadata: user.user_metadata
            }
          };

          // Store session
          await chrome.storage.local.set({ [SESSION_KEY]: session });

          resolve({ session, user: session.user });
        } catch (error) {
          reject(error);
        }
      }
    );
  });
}

/**
 * Get the current session from storage
 */
export async function getSession(): Promise<SessionResult> {
  const result = await chrome.storage.local.get(SESSION_KEY);
  const session = result[SESSION_KEY] as PluckkSession | undefined;

  if (!session) {
    return { session: null, user: null };
  }

  // Check if session is expired
  const now = Math.floor(Date.now() / 1000);
  if (session.expires_at && session.expires_at < now) {
    // Try to refresh the token
    const refreshed = await refreshSession(session.refresh_token);
    if (refreshed) {
      return { session: refreshed, user: refreshed.user };
    }
    // Clear expired session
    await signOut();
    return { session: null, user: null };
  }

  return { session, user: session.user };
}

/**
 * Refresh the access token
 */
async function refreshSession(refreshToken: string): Promise<PluckkSession | null> {
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY
      },
      body: JSON.stringify({ refresh_token: refreshToken })
    });

    if (!response.ok) return null;

    const data = await response.json();

    const session: PluckkSession = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
      user: data.user
    };

    await chrome.storage.local.set({ [SESSION_KEY]: session });
    return session;
  } catch (error) {
    console.error('Failed to refresh session:', error);
    return null;
  }
}

/**
 * Sign out and clear session
 */
export async function signOut(): Promise<SignOutResult> {
  const { session } = await getSession();

  if (session?.access_token) {
    // Revoke token on Supabase
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': SUPABASE_KEY
        }
      });
    } catch (error) {
      console.error('Error revoking token:', error);
    }
  }

  await chrome.storage.local.remove(SESSION_KEY);
  return { error: null };
}

/**
 * Get access token for API calls
 */
export async function getAccessToken(): Promise<string | null> {
  const { session } = await getSession();
  return session?.access_token || null;
}

/**
 * Get user profile from backend (includes usage stats)
 */
export async function getUserProfile(): Promise<UserProfile | null> {
  const token = await getAccessToken();
  if (!token) return null;

  try {
    const response = await fetch(`${BACKEND_URL}/api/user/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Failed to get user profile:', error);
    return null;
  }
}

/**
 * Listen for auth state changes (session updates)
 */
export function onAuthStateChange(callback: AuthStateCallback): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[SESSION_KEY]) {
      const newSession = changes[SESSION_KEY].newValue as PluckkSession | undefined;
      if (newSession) {
        callback('SIGNED_IN', newSession);
      } else {
        callback('SIGNED_OUT', null);
      }
    }
  });
}
