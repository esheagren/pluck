import { useState, useEffect, useCallback } from 'react';
import { BACKEND_URL } from '@pluckk/shared/constants';
import type {
  PublicProfile,
  ProfileStats,
  ActivityDataPoint,
  PublicCard,
  ProfileError,
  UsePublicProfileReturn,
} from '../types';

export function usePublicProfile(username: string | undefined): UsePublicProfileReturn {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [activity, setActivity] = useState<ActivityDataPoint[]>([]);
  const [publicCards, setPublicCards] = useState<PublicCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ProfileError | null>(null);

  const fetchProfile = useCallback(async (): Promise<void> => {
    if (!username) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/profile/${encodeURIComponent(username)}`
      );

      if (response.status === 404) {
        setError({ status: 404, message: 'Profile not found' });
        setProfile(null);
        setStats(null);
        setActivity([]);
        setPublicCards([]);
      } else if (response.ok) {
        const data = await response.json();
        setProfile(data.profile);
        setStats(data.stats);
        setActivity(data.activity || []);
        setPublicCards(data.publicCards || []);
      } else {
        const errorData = await response.json();
        setError({ message: errorData.error || 'Failed to load profile' });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load profile';
      setError({ message });
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    stats,
    activity,
    publicCards,
    loading,
    error,
    refetch: fetchProfile,
  };
}
