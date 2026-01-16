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
import type { BillingInfo, UseAuthReturn } from '../types';

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null);

  // Fetch billing info for user
  const fetchBillingInfo = async (): Promise<void> => {
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
      }
    } catch (error) {
      console.error('Failed to fetch billing info:', error);
    }
  };

  // Initialize auth state
  useEffect(() => {
    const initAuth = async (): Promise<void> => {
      const { session } = await getSession();
      if (session?.user) {
        setUser(session.user);
        fetchBillingInfo();
      }
      setLoading(false);
    };

    initAuth();

    // Listen for auth changes
    const unsubscribe = onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      console.log('Auth state changed:', event);

      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        fetchBillingInfo();
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setBillingInfo(null);
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

  return {
    user,
    loading,
    billingInfo,
    signIn,
    signOut,
    handleUpgrade,
    handleManageSubscription,
  };
}
