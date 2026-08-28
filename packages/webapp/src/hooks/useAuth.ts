import { useState, useEffect } from 'react';
import {
  api,
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
import type { UseAuthReturn, LearningProfile } from '../types';

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
  let returnTo = '/';
  try { returnTo = sessionStorage.getItem('pluckk_return_to') || '/'; sessionStorage.removeItem('pluckk_return_to'); } catch { /* ignore */ }
  window.history.replaceState(null, '', returnTo);
  return user;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(() => (getAccessToken() ? getStoredUser() : null));
  const [loading, setLoading] = useState(true);
  const [learningProfile, setLearningProfile] = useState<LearningProfile | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const fetchUserInfo = async (): Promise<void> => {
    try {
      const data = await api.user.me();
      const lp = data.learningProfile as Partial<LearningProfile>;
      const profile: LearningProfile = {
        onboardingCompleted: lp.onboardingCompleted ?? false,
        primaryCategory: lp.primaryCategory || null,
        studentLevel: lp.studentLevel || null,
        studentField: lp.studentField || null,
        workFields: lp.workFields || [],
        workFieldOther: lp.workFieldOther || null,
        workYearsExperience: lp.workYearsExperience || null,
        researchField: lp.researchField || null,
        researchYearsExperience: lp.researchYearsExperience || null,
        additionalInterests: lp.additionalInterests || [],
        additionalInterestsOther: lp.additionalInterestsOther || null,
        spacedRepExperience: lp.spacedRepExperience || null,
        technicalityPreference: lp.technicalityPreference || null,
        breadthPreference: lp.breadthPreference || null,
      };
      setLearningProfile(profile);
      if (!profile.onboardingCompleted) setShowOnboarding(true);
    } catch (error) {
      console.error('Failed to fetch user info:', error);
    }
  };

  useEffect(() => {
    const init = async (): Promise<void> => {
      if (window.location.pathname === AUTH_CALLBACK_PATH) {
        try {
          const u = await completeGoogleSignIn();
          if (u) { setUser(u); await fetchUserInfo(); }
        } catch (error) {
          console.error('Sign in failed:', error);
          clearSession();
          window.history.replaceState(null, '', '/');
        }
      } else if (getAccessToken()) {
        setUser(getStoredUser());
        await fetchUserInfo();
      }
      setLoading(false);
    };
    init();

    return onAuthStateChange((event, u) => {
      if (event === 'SIGNED_IN' && u) {
        setUser(u);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setLearningProfile(null);
        setShowOnboarding(false);
      }
    });
  }, []);

  const signIn = async (): Promise<void> => { startGoogleSignIn(); };

  const signOut = async (): Promise<void> => {
    await apiSignOut();
    setUser(null);
  };

  const completeOnboarding = async (profile: Omit<LearningProfile, 'onboardingCompleted'>): Promise<void> => {
    try {
      await api.user.update({ onboardingCompleted: true, ...profile });
      setLearningProfile({ ...profile, onboardingCompleted: true });
    } catch (error) {
      console.error('Failed to save onboarding:', error);
    } finally {
      setShowOnboarding(false);
    }
  };

  const skipOnboarding = async (): Promise<void> => {
    try {
      await api.user.update({ onboardingCompleted: true });
      setLearningProfile((prev) => (prev ? { ...prev, onboardingCompleted: true } : null));
    } catch (error) {
      console.error('Failed to skip onboarding:', error);
    } finally {
      setShowOnboarding(false);
    }
  };

  return { user, loading, learningProfile, showOnboarding, signIn, signOut, completeOnboarding, skipOnboarding };
}
