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

      // Fetch both reviews and cards created in parallel
      const [reviewsResult, cardsResult] = await Promise.all([
        supabase
          .from('user_daily_review_summary')
          .select('review_date, total_reviews')
          .eq('user_id', userId)
          .gte('review_date', startDateStr)
          .order('review_date', { ascending: true }),
        supabase
          .from('user_daily_card_summary')
          .select('created_date, cards_created')
          .eq('user_id', userId)
          .gte('created_date', startDateStr)
          .order('created_date', { ascending: true })
      ])

      if (reviewsResult.error) {
        console.error('Error fetching review stats:', reviewsResult.error)
        setError(reviewsResult.error)
        setActivityData({})
        return
      }

      // Note: card summary view might not exist yet, so we handle that gracefully
      // PostgreSQL error code 42P01 = relation does not exist
      if (cardsResult.error && cardsResult.error.code !== '42P01') {
        console.error('Error fetching card stats:', cardsResult.error)
      }

      // Combine both datasets into a single map
      // { 'YYYY-MM-DD': { reviews: N, cardsCreated: M } }
      const dataMap = {}

      // Add review data
      if (reviewsResult.data) {
        reviewsResult.data.forEach(row => {
          dataMap[row.review_date] = {
            reviews: row.total_reviews,
            cardsCreated: 0
          }
        })
      }

      // Add card creation data
      if (cardsResult.data) {
        cardsResult.data.forEach(row => {
          if (dataMap[row.created_date]) {
            dataMap[row.created_date].cardsCreated = row.cards_created
          } else {
            dataMap[row.created_date] = {
              reviews: 0,
              cardsCreated: row.cards_created
            }
          }
        })
      }

      setActivityData(dataMap)
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
