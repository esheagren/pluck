import type { JSX } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usePublicProfile } from '../hooks/usePublicProfile';
import UserAvatar from '../components/UserAvatar';
import ActivityGrid from '../components/ActivityGrid';
import PublicCardsGrid from '../components/PublicCardsGrid';
import type { ActivityDataMap, PublicCardDisplay } from '../types';

export default function PublicProfilePage(): JSX.Element {
  const { username } = useParams<{ username: string }>();
  const { profile, stats, activity, publicCards, loading, error } = usePublicProfile(username);

  // Convert activity array to object format for ActivityGrid
  const activityData: ActivityDataMap = (activity || []).reduce((acc, day) => {
    acc[day.date] = { reviews: day.reviews, cardsCreated: day.cardsCreated };
    return acc;
  }, {} as ActivityDataMap);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="Pluckk" className="w-7 h-7" />
              <span className="text-lg font-semibold text-gray-800 tracking-tight">Pluckk</span>
            </Link>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="spinner w-8 h-8 border-3 border-gray-200 border-t-gray-800 rounded-full"></div>
            <p className="text-gray-500 text-sm">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error?.status === 404) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="Pluckk" className="w-7 h-7" />
              <span className="text-lg font-semibold text-gray-800 tracking-tight">Pluckk</span>
            </Link>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-gray-800 mb-2">Profile not found</h1>
            <p className="text-gray-500 mb-6">
              The user @{username} doesn't exist or their profile is private.
            </p>
            <Link
              to="/"
              className="inline-block px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-900 transition-colors"
            >
              Go to Pluckk
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="Pluckk" className="w-7 h-7" />
              <span className="text-lg font-semibold text-gray-800 tracking-tight">Pluckk</span>
            </Link>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-gray-800 mb-2">Something went wrong</h1>
            <p className="text-gray-500 mb-6">{error.message || 'Failed to load profile'}</p>
            <Link
              to="/"
              className="inline-block px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-900 transition-colors"
            >
              Go to Pluckk
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const formattedJoinDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : null;

  // Convert publicCards to the display format expected by PublicCardsGrid
  const displayCards: PublicCardDisplay[] = (publicCards || []).map((card) => ({
    id: card.id,
    question: card.question,
    answer: card.answer,
    createdAt: card.created_at,
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="Pluckk" className="w-7 h-7" />
            <span className="text-lg font-semibold text-gray-800 tracking-tight">Pluckk</span>
          </Link>
          <Link to="/" className="text-sm text-gray-500 hover:text-gray-800">
            Start learning
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Profile Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start gap-5">
            <UserAvatar
              avatarUrl={profile?.avatar_url}
              displayName={profile?.display_name}
              username={profile?.username}
              size="xl"
            />
            <div className="flex-1 min-w-0">
              {profile?.display_name && (
                <h1 className="text-2xl font-semibold text-gray-900 truncate">
                  {profile.display_name}
                </h1>
              )}
              <p
                className={`text-gray-500 ${
                  profile?.display_name ? 'text-base' : 'text-xl font-medium'
                }`}
              >
                @{profile?.username}
              </p>
              {profile?.bio && <p className="mt-3 text-gray-600">{profile.bio}</p>}
              {formattedJoinDate && (
                <p className="mt-3 text-sm text-gray-400">Member since {formattedJoinDate}</p>
              )}
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div className="mt-6 pt-6 border-t border-gray-100 flex gap-8">
              <div>
                <div className="text-2xl font-semibold text-gray-900">
                  {stats.totalReviews?.toLocaleString() || 0}
                </div>
                <div className="text-sm text-gray-500">Reviews</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-gray-900">
                  {stats.currentStreak?.toLocaleString() || 0}
                </div>
                <div className="text-sm text-gray-500">Current streak</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-gray-900">
                  {stats.totalCards?.toLocaleString() || 0}
                </div>
                <div className="text-sm text-gray-500">Total cards</div>
              </div>
            </div>
          )}
        </div>

        {/* Activity */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Activity</h2>
          <ActivityGrid activityData={activityData} />
        </div>

        {/* Public Cards */}
        {displayCards && displayCards.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Public Cards ({stats?.totalCards || displayCards.length})
            </h2>
            <PublicCardsGrid cards={displayCards} />
          </div>
        )}
      </div>
    </div>
  );
}
