import { useMemo, type JSX } from 'react';
import ActivityGrid from '../components/ActivityGrid';
import { useActivityStats } from '../hooks/useActivityStats';
import type { ProfilePageProps } from '../types';

/** Activity: who you are (from Google) and what you've done — reviews and cards created by day. */
export default function ProfilePage({ user }: ProfilePageProps): JSX.Element {
  const { activityData, loading } = useActivityStats(user?.id);

  const earliestActivityDate = useMemo(() => {
    const dates = Object.keys(activityData).sort();
    return dates.length > 0 ? dates[0] : null;
  }, [activityData]);

  const totalReviews = useMemo(() => Object.values(activityData).reduce((s, d) => s + d.reviews, 0), [activityData]);
  const totalCreated = useMemo(() => Object.values(activityData).reduce((s, d) => s + d.cardsCreated, 0), [activityData]);

  return (
    <div className="w-full max-w-lg mx-auto space-y-6">
      <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-5">
        <div className="flex items-center gap-4">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="h-12 w-12 rounded-full bg-gray-200 dark:bg-gray-700" />
          )}
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold text-gray-800 dark:text-gray-100">{user?.display_name || user?.email}</div>
            {user?.display_name && <div className="truncate text-sm text-gray-500 dark:text-gray-400">{user.email}</div>}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/60">
            <div className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">Reviews · last year</div>
            <div className="text-lg font-semibold tabular-nums text-gray-800 dark:text-gray-100">{loading ? '…' : totalReviews}</div>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/60">
            <div className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">Cards created</div>
            <div className="text-lg font-semibold tabular-nums text-gray-800 dark:text-gray-100">{loading ? '…' : totalCreated}</div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-5">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">Reviews</h2>
        <ActivityGrid activityData={activityData} metric="reviews" startDate={earliestActivityDate ?? undefined} />
      </div>
      <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-5">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">Cards created</h2>
        <ActivityGrid activityData={activityData} metric="cardsCreated" startDate={earliestActivityDate ?? undefined} />
      </div>
    </div>
  );
}
