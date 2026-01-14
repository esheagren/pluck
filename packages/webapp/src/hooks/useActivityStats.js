import { useState, useEffect, useCallback } from 'react'
import { getSupabaseClient } from '@pluckk/shared/supabase'

const supabase = getSupabaseClient()

function formatDateLocal(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function useActivityStats(userId) {
  const [activityData, setActivityData] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchActivityStats = useCallback(async () => {
    if (!userId) {
      setActivityData({})
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Get date 365 days ago in local timezone
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 365)
      const startDateStr = formatDateLocal(startDate)

      const { data, error } = await supabase
        .from('user_daily_review_summary')
        .select('review_date, total_reviews')
        .eq('user_id', userId)
        .gte('review_date', startDateStr)
        .order('review_date', { ascending: true })

      if (error) {
        console.error('Error fetching activity stats:', error)
        setError(error)
        setActivityData({})
      } else {
        // Convert to a map of { 'YYYY-MM-DD': count }
        const dataMap = {}
        if (data) {
          data.forEach(row => {
            dataMap[row.review_date] = row.total_reviews
          })
        }
        setActivityData(dataMap)
      }
    } catch (err) {
      console.error('Error fetching activity stats:', err)
      setError(err)
      setActivityData({})
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchActivityStats()
  }, [fetchActivityStats])

  return {
    activityData,
    loading,
    error,
    refetch: fetchActivityStats
  }
}
