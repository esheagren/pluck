import { useState, useEffect, useMemo } from 'react'
import { useProfile } from '../hooks/useProfile'
import UserAvatar from '../components/UserAvatar'
import UsernameInput from '../components/UsernameInput'
import ActivityGrid from '../components/ActivityGrid'
import { useActivityStats } from '../hooks/useActivityStats'

export default function ProfilePage({ user }) {
  const { profile, loading: profileLoading, saving: profileSaving, updateProfile, checkUsername } = useProfile()
  const { activityData, loading: activityLoading } = useActivityStats(user?.id)

  // Calculate earliest activity date across both metrics for aligned grids
  const earliestActivityDate = useMemo(() => {
    const dates = Object.keys(activityData).sort()
    return dates.length > 0 ? dates[0] : null
  }, [activityData])

  // Profile editing state
  const [isEditing, setIsEditing] = useState(false)
  const [editUsername, setEditUsername] = useState('')
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editBio, setEditBio] = useState('')
  const [editProfileIsPublic, setEditProfileIsPublic] = useState(true)
  const [profileStatus, setProfileStatus] = useState({ type: '', message: '' })

  // Initialize edit state from profile
  useEffect(() => {
    if (profile) {
      setEditUsername(profile.username || '')
      setEditDisplayName(profile.displayName || '')
      setEditBio(profile.bio || '')
      setEditProfileIsPublic(profile.profileIsPublic !== false)
    }
  }, [profile])

  // Auto-clear success messages after 3 seconds
  useEffect(() => {
    if (profileStatus.type === 'success') {
      const timeoutId = setTimeout(() => setProfileStatus({ type: '', message: '' }), 3000)
      return () => clearTimeout(timeoutId)
    }
  }, [profileStatus.type])

  const handleEditStart = () => {
    setEditUsername(profile?.username || '')
    setEditDisplayName(profile?.displayName || '')
    setEditBio(profile?.bio || '')
    setEditProfileIsPublic(profile?.profileIsPublic !== false)
    setIsEditing(true)
    setProfileStatus({ type: '', message: '' })
  }

  const handleEditCancel = () => {
    setIsEditing(false)
    setProfileStatus({ type: '', message: '' })
  }

  const handleProfileSave = async () => {
    setProfileStatus({ type: '', message: '' })

    const updates = {}

    if (editUsername !== (profile?.username || '')) {
      updates.username = editUsername || null
    }
    if (editDisplayName !== (profile?.displayName || '')) {
      updates.displayName = editDisplayName || null
    }
    if (editBio !== (profile?.bio || '')) {
      updates.bio = editBio || null
    }
    if (editProfileIsPublic !== (profile?.profileIsPublic !== false)) {
      updates.profileIsPublic = editProfileIsPublic
    }

    if (Object.keys(updates).length === 0) {
      setIsEditing(false)
      return
    }

    const result = await updateProfile(updates)
    if (result.error) {
      setProfileStatus({ type: 'error', message: result.error })
    } else {
      setProfileStatus({ type: 'success', message: 'Profile updated' })
      setIsEditing(false)
    }
  }

  if (profileLoading) {
    return (
      <div className="flex flex-col items-center justify-center text-center gap-4">
        <div className="spinner w-8 h-8 border-3 border-gray-200 dark:border-gray-700 border-t-gray-800 dark:border-t-gray-200 rounded-full"></div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Loading profile...</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-lg mx-auto space-y-6">
      {/* Profile Section */}
      <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-5">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Profile</h2>
          {!isEditing && (
            <button
              onClick={handleEditStart}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Edit
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-4">
            {/* Avatar (read-only for now) */}
            <div className="flex items-center gap-4">
              <UserAvatar
                avatarUrl={profile?.avatarUrl}
                displayName={editDisplayName || profile?.displayName}
                username={editUsername || profile?.username}
                email={user?.email}
                size="lg"
              />
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Avatar customization coming soon
              </div>
            </div>

            {/* Username */}
            <UsernameInput
              value={editUsername}
              onChange={setEditUsername}
              onCheckAvailability={checkUsername}
              currentUsername={profile?.username}
            />

            {/* Display Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                placeholder="Your display name"
                maxLength={100}
                className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-600 bg-white dark:bg-dark-bg dark:text-gray-200"
              />
            </div>

            {/* Bio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Bio
              </label>
              <textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                placeholder="Tell others about yourself"
                maxLength={500}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-600 resize-none bg-white dark:bg-dark-bg dark:text-gray-200"
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{editBio.length}/500</p>
            </div>

            {/* Public Profile Toggle */}
            <div className="flex items-center justify-between py-2">
              <div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Make profile public</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Allow others to see your activity and public cards
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={editProfileIsPublic}
                  onChange={(e) => setEditProfileIsPublic(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-gray-300 dark:peer-focus:ring-gray-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-800 dark:peer-checked:bg-gray-200"></div>
              </label>
            </div>

            {profile?.username && editProfileIsPublic && (
              <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-dark-bg px-3 py-2 rounded-lg">
                Your profile will be visible at{' '}
                <span className="font-mono text-gray-700 dark:text-gray-300">pluckk.app/u/{profile.username}</span>
              </div>
            )}

            {/* Save/Cancel Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleEditCancel}
                className="flex-1 py-2 border border-gray-300 dark:border-dark-border text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleProfileSave}
                disabled={profileSaving}
                className="flex-1 py-2 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-900 dark:hover:bg-white transition-colors disabled:opacity-50"
              >
                {profileSaving ? 'Saving...' : 'Save'}
              </button>
            </div>

            {profileStatus.message && (
              <p className={`text-sm text-center ${profileStatus.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {profileStatus.message}
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-start gap-4">
            <UserAvatar
              avatarUrl={profile?.avatarUrl}
              displayName={profile?.displayName}
              username={profile?.username}
              email={user?.email}
              size="lg"
            />
            <div className="flex-1 min-w-0">
              {profile?.displayName && (
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {profile.displayName}
                </h3>
              )}
              {profile?.username && (
                <p className={`text-gray-500 dark:text-gray-400 ${profile.displayName ? 'text-sm' : 'text-base font-medium'}`}>
                  @{profile.username}
                </p>
              )}
              {!profile?.displayName && !profile?.username && (
                <p className="text-gray-500 dark:text-gray-400">No username set</p>
              )}
              {profile?.bio && (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{profile.bio}</p>
              )}
              <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                {profile?.profileIsPublic ? 'Public profile' : 'Private profile'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Activity Section */}
      <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Activity</h3>
          {/* Legend */}
          <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
            <span>Less</span>
            <div className="w-[10px] h-[10px] rounded-sm bg-gray-100 dark:bg-gray-800" />
            <div className="w-[10px] h-[10px] rounded-sm bg-gray-300 dark:bg-gray-600" />
            <div className="w-[10px] h-[10px] rounded-sm bg-gray-500 dark:bg-gray-500" />
            <div className="w-[10px] h-[10px] rounded-sm bg-gray-700 dark:bg-gray-400" />
            <div className="w-[10px] h-[10px] rounded-sm bg-gray-900 dark:bg-gray-200" />
            <span>More</span>
          </div>
        </div>
        {activityLoading ? (
          <div className="flex justify-center py-8">
            <div className="spinner w-6 h-6 border-2 border-gray-200 dark:border-gray-700 border-t-gray-800 dark:border-t-gray-200 rounded-full"></div>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Reviews</h4>
              <ActivityGrid activityData={activityData} metric="reviews" showLegend={false} startDate={earliestActivityDate} />
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Cards Added</h4>
              <ActivityGrid activityData={activityData} metric="cardsCreated" showLegend={false} startDate={earliestActivityDate} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
