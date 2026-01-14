import { useState, useEffect } from 'react'
import { BACKEND_URL, MOCHI_API_URL } from '@pluckk/shared/constants'
import { getAccessToken } from '@pluckk/shared/supabase'

const DEFAULT_NEW_CARDS_PER_DAY = 10
const NEW_CARDS_KEY = 'pluckk_new_cards_per_day'

export default function SettingsPage({ user, billingInfo, onSignOut, onUpgrade, onManage }) {
  const [mochiApiKey, setMochiApiKey] = useState('')
  const [mochiDeckId, setMochiDeckId] = useState('')
  const [decks, setDecks] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fetchingDecks, setFetchingDecks] = useState(false)
  const [status, setStatus] = useState({ type: '', message: '' })
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [newCardsPerDay, setNewCardsPerDay] = useState(DEFAULT_NEW_CARDS_PER_DAY)

  // Load settings on mount
  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      // Load new cards per day from localStorage
      const savedNewCards = localStorage.getItem(NEW_CARDS_KEY)
      if (savedNewCards) {
        const parsed = parseInt(savedNewCards, 10)
        if (!isNaN(parsed) && parsed >= 0) {
          setNewCardsPerDay(parsed)
        }
      }

      const accessToken = await getAccessToken()
      if (!accessToken) return

      const response = await fetch(`${BACKEND_URL}/api/user/me`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })

      if (response.ok) {
        const data = await response.json()
        setMochiApiKey(data.settings?.mochiApiKey || '')
        setMochiDeckId(data.settings?.mochiDeckId || '')

        // If we have an API key, fetch decks
        if (data.settings?.mochiApiKey) {
          fetchDecks(data.settings.mochiApiKey, data.settings.mochiDeckId)
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setLoading(false)
    }
  }

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

        // If we had a selected deck, keep it selected
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
    // Allow empty string for editing, but don't save until valid
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

  // Handle blur to reset empty input to default
  const handleNewCardsBlur = () => {
    if (newCardsPerDay === '' || newCardsPerDay === null) {
      setNewCardsPerDay(DEFAULT_NEW_CARDS_PER_DAY)
      localStorage.setItem(NEW_CARDS_KEY, DEFAULT_NEW_CARDS_PER_DAY.toString())
    }
  }

  const saveSettings = async () => {
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center text-center gap-4">
        <div className="spinner w-8 h-8 border-3 border-gray-200 border-t-gray-800 rounded-full"></div>
        <p className="text-gray-500 text-sm">Loading settings...</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">Settings</h2>

      {/* Account Section */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 mb-6">
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
                onClick={saveSettings}
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
