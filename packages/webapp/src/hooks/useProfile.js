import { useState, useEffect, useCallback } from 'react'
import { BACKEND_URL } from '@pluckk/shared/constants'
import { getAccessToken } from '@pluckk/shared/supabase'

export function useProfile() {
  const [profile, setProfile] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [usage, setUsage] = useState(null)
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const fetchProfile = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const accessToken = await getAccessToken()
      if (!accessToken) {
        setLoading(false)
        return
      }

      const response = await fetch(`${BACKEND_URL}/api/user/me`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })

      if (response.ok) {
        const data = await response.json()
        setProfile(data.user)
        setSubscription(data.subscription)
        setUsage(data.usage)
        setSettings(data.settings)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to fetch profile')
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch profile')
    } finally {
      setLoading(false)
    }
  }, [])

  const updateProfile = useCallback(async (updates) => {
    setSaving(true)
    setError(null)

    try {
      const accessToken = await getAccessToken()
      if (!accessToken) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(`${BACKEND_URL}/api/user/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update profile')
      }

      // Refresh profile data
      await fetchProfile()
      return { success: true }
    } catch (err) {
      setError(err.message)
      return { error: err.message }
    } finally {
      setSaving(false)
    }
  }, [fetchProfile])

  const checkUsername = useCallback(async (username) => {
    if (!username || username.length < 3) {
      return { available: false, reason: 'too_short' }
    }

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/user/check-username?username=${encodeURIComponent(username)}`
      )
      return await response.json()
    } catch (err) {
      return { available: false, reason: 'error', message: err.message }
    }
  }, [])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

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
    refetch: fetchProfile
  }
}
