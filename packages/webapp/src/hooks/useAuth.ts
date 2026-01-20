import { useState, useEffect } from 'react';
import {
  signInWithGoogle,
  signOut as supabaseSignOut,
  getSession,
  getAccessToken,
  onAuthStateChange,
} from '@pluckk/shared/supabase';
import type { User, AuthChangeEvent, Session } from '@pluckk/shared/supabase';
import { BACKEND_URL, FREE_TIER_LIMIT } from '@pluckk/shared/constants';
import type { BillingInfo, UseAuthReturn, LearningProfile } from '../types';

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null);
  const [learningProfile, setLearningProfile] = useState<LearningProfile | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Fetch user info including billing and learning profile
  const fetchUserInfo = async (isNewSignIn = false): Promise<void> => {
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) return;

      const response = await fetch(`${BACKEND_URL}/api/user/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        setBillingInfo({
          isPro: data.subscription?.isPro || false,
          cardsUsed: data.usage?.cardsThisMonth || 0,
          limit: data.usage?.limit || FREE_TIER_LIMIT,
        });

        const profile: LearningProfile = {
          onboardingCompleted: data.learningProfile?.onboardingCompleted ?? false,
          role: data.learningProfile?.role || null,
          learningGoals: data.learningProfile?.learningGoals || null,
          expertiseLevel: data.learningProfile?.expertiseLevel || null,
          cardStyle: data.learningProfile?.cardStyle || null,
          domains: data.learningProfile?.domains || [],
        };
        setLearningProfile(profile);

        // Show onboarding wizard for new sign-ins when onboarding not completed
        if (isNewSignIn && !profile.onboardingCompleted) {
          setShowOnboarding(true);
        }
      }
    } catch (error) {
      console.error('Failed to fetch user info:', error);
    }
  };

  // Initialize auth state
  useEffect(() => {
    const initAuth = async (): Promise<void> => {
      const { session } = await getSession();
      if (session?.user) {
        setUser(session.user);
        fetchUserInfo(false); // Not a new sign-in on page load
      }
      setLoading(false);
    };

    initAuth();

    // Listen for auth changes
    const unsubscribe = onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      console.log('Auth state changed:', event);

      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        fetchUserInfo(true); // This is a new sign-in
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setBillingInfo(null);
        setLearningProfile(null);
        setShowOnboarding(false);
      }
    });

    return unsubscribe;
  }, []);

  const signIn = async (): Promise<void> => {
    const { error } = await signInWithGoogle();
    if (error) {
      console.error('Sign in error:', error);
    }
  };

  const signOut = async (): Promise<void> => {
    const { error } = await supabaseSignOut();
    if (error) {
      console.error('Sign out error:', error);
    }
    setUser(null);
    setBillingInfo(null);
  };

  const handleUpgrade = async (): Promise<void> => {
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) return;

      const response = await fetch(`${BACKEND_URL}/api/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          successUrl: window.location.href,
          cancelUrl: window.location.href,
        }),
      });

      if (response.ok) {
        const { url } = await response.json();
        window.location.href = url;
      }
    } catch (error) {
      console.error('Checkout error:', error);
    }
  };

  const handleManageSubscription = async (): Promise<void> => {
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) return;

      const response = await fetch(`${BACKEND_URL}/api/portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          returnUrl: window.location.href,
        }),
      });

      if (response.ok) {
        const { url } = await response.json();
        window.location.href = url;
      }
    } catch (error) {
      console.error('Portal error:', error);
    }
  };

  const completeOnboarding = async (
    profile: Omit<LearningProfile, 'onboardingCompleted'>
  ): Promise<void> => {
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) return;

      const response = await fetch(`${BACKEND_URL}/api/user/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          onboardingCompleted: true,
          role: profile.role,
          learningGoals: profile.learningGoals,
          expertiseLevel: profile.expertiseLevel,
          cardStyle: profile.cardStyle,
          domains: profile.domains,
        }),
      });

      if (response.ok) {
        setLearningProfile({
          ...profile,
          onboardingCompleted: true,
        });
        setShowOnboarding(false);
      }
    } catch (error) {
      console.error('Failed to save onboarding:', error);
    }
  };

  const skipOnboarding = async (): Promise<void> => {
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) return;

      await fetch(`${BACKEND_URL}/api/user/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ onboardingCompleted: true }),
      });

      setLearningProfile((prev) =>
        prev ? { ...prev, onboardingCompleted: true } : null
      );
      setShowOnboarding(false);
    } catch (error) {
      console.error('Failed to skip onboarding:', error);
      setShowOnboarding(false); // Still hide wizard on error
    }
  };

  return {
    user,
    loading,
    billingInfo,
    learningProfile,
    showOnboarding,
    signIn,
    signOut,
    handleUpgrade,
    handleManageSubscription,
    completeOnboarding,
    skipOnboarding,
  };
}
