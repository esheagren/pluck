import { useState, useEffect } from 'react';
import {
  getAccessToken,
  getStoredUser,
  onAuthStateChange,
  signOut as apiSignOut,
  signInWithGoogleCredential,
  buildGoogleAuthUrl,
  parseIdToken,
  clearSession,
} from '@pluckk/shared/api';
import type { AuthUser } from '@pluckk/shared/api';
import type { UseAuthReturn } from '../types';

export const AUTH_CALLBACK_PATH = '/auth/callback';

/** Kick off Google sign-in: full-page redirect to Google, back to /auth/callback. */
export function startGoogleSignIn(): void {
  const returnTo = window.location.pathname === AUTH_CALLBACK_PATH ? '/' : window.location.pathname;
  try { sessionStorage.setItem('pluckk_return_to', returnTo); } catch { /* ignore */ }
  window.location.href = buildGoogleAuthUrl({ redirectUri: `${window.location.origin}${AUTH_CALLBACK_PATH}` });
}

/**
 * Finish sign-in on /auth/callback: parse id_token from the fragment, exchange
 * it for a bearer token, then send the user back where they were.
 */
export async function completeGoogleSignIn(): Promise<AuthUser | null> {
  const idToken = parseIdToken(window.location.href);
  if (!idToken) return null;
  const user = await signInWithGoogleCredential(idToken);
  // Strip the id_token fragment; App.tsx performs the actual route change with
  // <Navigate>, since history.replaceState is invisible to React Router.
  window.history.replaceState(null, '', window.location.pathname);
  return user;
}

/** Where to send the user after the callback (set by startGoogleSignIn). */
export function consumeReturnTo(): string {
  try {
    const v = sessionStorage.getItem('pluckk_return_to') || '/';
    sessionStorage.removeItem('pluckk_return_to');
    return v === AUTH_CALLBACK_PATH ? '/' : v;
  } catch { return '/'; }
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(() => (getAccessToken() ? getStoredUser() : null));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async (): Promise<void> => {
      if (window.location.pathname === AUTH_CALLBACK_PATH) {
        try {
          const u = await completeGoogleSignIn();
          if (u) setUser(u);
        } catch (error) {
          console.error('Sign in failed:', error);
          clearSession();
        }
      } else if (getAccessToken()) {
        setUser(getStoredUser());
      }
      setLoading(false);
    };
    init();

    return onAuthStateChange((event, u) => {
      if (event === 'SIGNED_IN' && u) {
        setUser(u);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });
  }, []);

  const signIn = async (): Promise<void> => { startGoogleSignIn(); };

  const signOut = async (): Promise<void> => {
    await apiSignOut();
    setUser(null);
  };

  return { user, loading, signIn, signOut };
}
