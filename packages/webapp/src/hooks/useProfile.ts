import { useState, useEffect, useCallback } from 'react';
import { BACKEND_URL } from '@pluckk/shared/constants';
import { getAccessToken } from '@pluckk/shared/supabase';
import type {
  Profile,
  Subscription,
  Usage,
  Settings,
  ProfileUpdates,
  UsernameCheckResult,
  UseProfileReturn,
} from '../types';

export function useProfile(): UseProfileReturn {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setLoading(false);
        return;
      }

      const response = await fetch(`${BACKEND_URL}/api/user/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data.user);
        setSubscription(data.subscription);
        setUsage(data.usage);
        setSettings(data.settings);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch profile');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch profile';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProfile = useCallback(
    async (updates: ProfileUpdates): Promise<{ success?: boolean; error?: string }> => {
      setSaving(true);
      setError(null);

      try {
        const accessToken = await getAccessToken();
        if (!accessToken) {
          throw new Error('Not authenticated');
        }

        const response = await fetch(`${BACKEND_URL}/api/user/me`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to update profile');
        }

        // Refresh profile data
        await fetchProfile();
        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update profile';
        setError(message);
        return { error: message };
      } finally {
        setSaving(false);
      }
    },
    [fetchProfile]
  );

  const checkUsername = useCallback(async (username: string): Promise<UsernameCheckResult> => {
    if (!username || username.length < 3) {
      return { available: false, reason: 'too_short' };
    }

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/user/check-username?username=${encodeURIComponent(username)}`
      );

      // Handle non-JSON responses (e.g., 404 pages)
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return { available: false, reason: 'error', message: 'Service unavailable' };
      }

      return await response.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { available: false, reason: 'error', message };
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    subscription,
    usage,
    settings,
    loading,
    saving,
    error,
    updateProfile,
    checkUsername,
    refetch: fetchProfile,
  };
}
