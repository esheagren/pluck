import { useState, useEffect, useCallback } from 'react';
import { api } from '@pluckk/shared/api';
import type { ActivityDataMap, UseActivityStatsReturn } from '../types';

export function useActivityStats(userId: string | undefined): UseActivityStatsReturn {
  const [activityData, setActivityData] = useState<ActivityDataMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | unknown | null>(null);

  const fetchActivityStats = useCallback(async (): Promise<void> => {
    if (!userId) {
      setActivityData({});
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Server aggregates the last 365 days of review_logs and cards by day.
      const { reviews, cards } = await api.activity.get();
      const dataMap: ActivityDataMap = {};
      for (const row of reviews) dataMap[row.review_date] = { reviews: row.total_reviews, cardsCreated: 0 };
      for (const row of cards) {
        if (dataMap[row.created_date]) dataMap[row.created_date].cardsCreated = row.cards_created;
        else dataMap[row.created_date] = { reviews: 0, cardsCreated: row.cards_created };
      }
      setActivityData(dataMap);
    } catch (err) {
      console.error('Error fetching activity stats:', err);
      setError(err);
      setActivityData({});
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchActivityStats(); }, [fetchActivityStats]);

  return { activityData, loading, error, refetch: fetchActivityStats };
}
