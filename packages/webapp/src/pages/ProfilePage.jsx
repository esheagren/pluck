import { useState, useEffect } from 'react'
import { BACKEND_URL, MOCHI_API_URL } from '@pluckk/shared/constants'
import { getAccessToken } from '@pluckk/shared/supabase'
import { useProfile } from '../hooks/useProfile'
import UserAvatar from '../components/UserAvatar'
import UsernameInput from '../components/UsernameInput'
import ActivityGrid from '../components/ActivityGrid'
import { useActivityStats } from '../hooks/useActivityStats'

const DEFAULT_NEW_CARDS_PER_DAY = 10
const NEW_CARDS_KEY = 'pluckk_new_cards_per_day'

export default function ProfilePage({ user, billingInfo, onSignOut, onUpgrade, onManage }) {
  const { profile, settings, loading: profileLoading, saving: profileSaving, updateProfile, checkUsername, refetch } = useProfile()
  const { activityData, loading: activityLoading } = useActivityStats()

  // Profile editing state
  const [isEditing, setIsEditing] = useState(false)
  const [editUsername, setEditUsername] = useState('')
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editBio, setEditBio] = useState('')
  const [editProfileIsPublic, setEditProfileIsPublic] = useState(true)
  const [profileStatus, setProfileStatus] = useState({ type: '', message: '' })

  // Mochi settings state
  const [mochiApiKey, setMochiApiKey] = useState('')
  const [mochiDeckId, setMochiDeckId] = useState('')
  const [decks, setDecks] = useState([])
  const [fetchingDecks, setFetchingDecks] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState({ type: '', message: '' })
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [newCardsPerDay, setNewCardsPerDay] = useState(DEFAULT_NEW_CARDS_PER_DAY)

  // Initialize edit state from profile
  useEffect(() => {
    if (profile) {
      setEditUsername(profile.username || '')
      setEditDisplayName(profile.displayName || '')
      setEditBio(profile.bio || '')
      setEditProfileIsPublic(profile.profileIsPublic !== false)
    }
  }, [profile])

  // Load Mochi settings
  useEffect(() => {
    if (settings) {
      setMochiApiKey(settings.mochiApiKey || '')
      setMochiDeckId(settings.mochiDeckId || '')
      if (settings.mochiApiKey) {
        fetchDecks(settings.mochiApiKey, settings.mochiDeckId)
      }
    }
  }, [settings])

  // Load new cards per day from localStorage
  useEffect(() => {
    const savedNewCards = localStorage.getItem(NEW_CARDS_KEY)
    if (savedNewCards) {
      const parsed = parseInt(savedNewCards, 10)
      if (!isNaN(parsed) && parsed >= 0) {
        setNewCardsPerDay(parsed)
      }
    }
  }, [])

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

  // Auto-clear success messages after 3 seconds
  useEffect(() => {
    if (profileStatus.type === 'success') {
      const timeoutId = setTimeout(() => setProfileStatus({ type: '', message: '' }), 3000)
      return () => clearTimeout(timeoutId)
    }
  }, [profileStatus.type])

  const fetchDecks = async (apiKey = mochiApiKey, selectedDeckId = mochiDeckId) => {
    if (!apiKey) {
      setStatus({ type: 'error', message: 'Enter your Mochi API key first' })
      return
    }

    setFetchingDecks(true)
    setStatus({ type: '', message: '' })

    try {
      const response = await fetch(`${MOCHI_API_URL}/decks`, {
        headers: {
          'Authorization': `Basic ${btoa(apiKey + ':')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        const deckList = data.docs || []
        setDecks(deckList)

        if (selectedDeckId && deckList.some(d => d.id === selectedDeckId)) {
          setMochiDeckId(selectedDeckId)
        } else if (deckList.length > 0 && !selectedDeckId) {
          setMochiDeckId(deckList[0].id)
        }
      } else if (response.status === 401) {
        setStatus({ type: 'error', message: 'Invalid Mochi API key' })
        setDecks([])
      } else {
        setStatus({ type: 'error', message: 'Failed to fetch decks' })
      }
    } catch (error) {
      console.error('Failed to fetch Mochi decks:', error)
      setStatus({ type: 'error', message: 'Failed to connect to Mochi' })
    } finally {
      setFetchingDecks(false)
    }
  }

  const handleNewCardsChange = (value) => {
    if (value === '') {
      setNewCardsPerDay('')
      return
    }
    const num = parseInt(value, 10)
    if (!isNaN(num) && num >= 0) {
      setNewCardsPerDay(num)
      localStorage.setItem(NEW_CARDS_KEY, num.toString())
    }
  }

  const handleNewCardsBlur = () => {
    if (newCardsPerDay === '' || newCardsPerDay === null) {
      setNewCardsPerDay(DEFAULT_NEW_CARDS_PER_DAY)
      localStorage.setItem(NEW_CARDS_KEY, DEFAULT_NEW_CARDS_PER_DAY.toString())
    }
  }

  const saveMochiSettings = async () => {
    setSaving(true)
    setStatus({ type: '', message: '' })

    try {
      const accessToken = await getAccessToken()
      if (!accessToken) {
        setStatus({ type: 'error', message: 'Not authenticated' })
        return
      }

      const response = await fetch(`${BACKEND_URL}/api/user/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          mochiApiKey: mochiApiKey || null,
          mochiDeckId: mochiDeckId || null
        })
      })

      if (response.ok) {
        setStatus({ type: 'success', message: 'Settings saved' })
        setTimeout(() => setStatus({ type: '', message: '' }), 3000)
      } else {
        const data = await response.json()
        setStatus({ type: 'error', message: data.error || 'Failed to save settings' })
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
      setStatus({ type: 'error', message: 'Failed to save settings' })
    } finally {
      setSaving(false)
    }
  }

  if (profileLoading) {
    return (
      <div className="flex flex-col items-center justify-center text-center gap-4">
        <div className="spinner w-8 h-8 border-3 border-gray-200 border-t-gray-800 rounded-full"></div>
        <p className="text-gray-500 text-sm">Loading profile...</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-lg mx-auto space-y-6">
      {/* Profile Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Profile</h2>
          {!isEditing && (
            <button
              onClick={handleEditStart}
              className="text-sm text-gray-500 hover:text-gray-800"
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
              <div className="text-sm text-gray-500">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                placeholder="Your display name"
                maxLength={100}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>

            {/* Bio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bio
              </label>
              <textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                placeholder="Tell others about yourself"
                maxLength={500}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">{editBio.length}/500</p>
            </div>

            {/* Public Profile Toggle */}
            <div className="flex items-center justify-between py-2">
              <div>
                <div className="text-sm font-medium text-gray-700">Make profile public</div>
                <div className="text-xs text-gray-500">
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
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-800"></div>
              </label>
            </div>

            {profile?.username && editProfileIsPublic && (
              <div className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
                Your profile will be visible at{' '}
                <span className="font-mono text-gray-700">pluckk.app/u/{profile.username}</span>
              </div>
            )}

            {/* Save/Cancel Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleEditCancel}
                className="flex-1 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleProfileSave}
                disabled={profileSaving}
                className="flex-1 py-2 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50"
              >
                {profileSaving ? 'Saving...' : 'Save'}
              </button>
            </div>

            {profileStatus.message && (
              <p className={`text-sm text-center ${profileStatus.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
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
                <h3 className="text-lg font-semibold text-gray-900 truncate">
                  {profile.displayName}
                </h3>
              )}
              {profile?.username && (
                <p className={`text-gray-500 ${profile.displayName ? 'text-sm' : 'text-base font-medium'}`}>
                  @{profile.username}
                </p>
              )}
              {!profile?.displayName && !profile?.username && (
                <p className="text-gray-500">No username set</p>
              )}
              {profile?.bio && (
                <p className="mt-2 text-sm text-gray-600">{profile.bio}</p>
              )}
              <p className="mt-2 text-xs text-gray-400">
                {profile?.profileIsPublic ? 'Public profile' : 'Private profile'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Activity Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Activity</h3>
        {activityLoading ? (
          <div className="flex justify-center py-8">
            <div className="spinner w-6 h-6 border-2 border-gray-200 border-t-gray-800 rounded-full"></div>
          </div>
        ) : (
          <ActivityGrid activityData={activityData} />
        )}
      </div>

      {/* Settings Section */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        <div className="px-5 py-4">
          <h3 className="text-lg font-semibold text-gray-800">Settings</h3>
        </div>

        {/* Email */}
        <div className="px-5 py-4">
          <label className="text-xs text-gray-400 uppercase tracking-wide block mb-1">Email</label>
          <div className="text-gray-800">{user?.email}</div>
        </div>

        {/* Subscription */}
        <div className="px-5 py-4">
          <label className="text-xs text-gray-400 uppercase tracking-wide block mb-1">Subscription</label>
          {billingInfo?.isPro ? (
            <div className="flex items-center gap-3">
              <span className="pro-badge text-white text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide">
                Pro
              </span>
              <button
                onClick={onManage}
                className="text-sm text-gray-500 underline hover:text-gray-800"
              >
                Manage subscription
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <span className="text-gray-800">Free</span>
                <span className="text-gray-400 text-sm ml-2">
                  {billingInfo?.cardsUsed || 0} / {billingInfo?.limit || 50} cards this month
                </span>
              </div>
              <button
                onClick={onUpgrade}
                className="btn-upgrade text-white text-sm font-medium px-4 py-2 rounded-lg transition-all"
              >
                Upgrade to Pro
              </button>
            </div>
          )}
        </div>

        {/* Study Settings */}
        <div className="px-5 py-4">
          <label className="text-xs text-gray-400 uppercase tracking-wide block mb-1">New Cards Per Day</label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="0"
              max="100"
              value={newCardsPerDay}
              onChange={(e) => handleNewCardsChange(e.target.value)}
              onBlur={handleNewCardsBlur}
              className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
            <span className="text-sm text-gray-500">cards</span>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            Maximum number of new cards to study each day. Set to 0 for unlimited.
          </p>
        </div>

        {/* Advanced Settings Toggle */}
        <div className="px-5 py-4">
          <button
            onClick={() => setAdvancedOpen(!advancedOpen)}
            className="flex items-center justify-between w-full text-left"
          >
            <span className="text-sm text-gray-800">Advanced Settings</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`text-gray-400 transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        </div>

        {/* Advanced Settings Content */}
        {advancedOpen && (
          <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/50">
            <h4 className="text-xs text-gray-500 uppercase tracking-wide mb-3">Mochi Integration</h4>
            <p className="text-sm text-gray-500 mb-4">
              Connect your Mochi account to send flashcards directly from the extension.
            </p>

            <div className="space-y-4">
              {/* API Key */}
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wide mb-2">
                  API Key
                </label>
                <input
                  type="password"
                  value={mochiApiKey}
                  onChange={(e) => setMochiApiKey(e.target.value)}
                  placeholder="Enter your Mochi API key"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white"
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  Get your API key from Mochi Settings → API
                </p>
              </div>

              {/* Deck Selection */}
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wide mb-2">
                  Default Deck
                </label>
                <div className="flex gap-2">
                  <select
                    value={mochiDeckId}
                    onChange={(e) => setMochiDeckId(e.target.value)}
                    disabled={decks.length === 0}
                    className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    {decks.length === 0 ? (
                      <option value="">No decks loaded</option>
                    ) : (
                      decks.map((deck) => (
                        <option key={deck.id} value={deck.id}>
                          {deck.name}
                        </option>
                      ))
                    )}
                  </select>
                  <button
                    onClick={() => fetchDecks()}
                    disabled={fetchingDecks || !mochiApiKey}
                    className="px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {fetchingDecks ? 'Loading...' : 'Fetch'}
                  </button>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={saveMochiSettings}
                disabled={saving}
                className="w-full py-2.5 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Mochi Settings'}
              </button>

              {status.message && (
                <p className={`text-sm text-center mt-3 ${status.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                  {status.message}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Sign Out */}
        <div className="px-5 py-4 border-t border-gray-100">
          <button
            onClick={onSignOut}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
