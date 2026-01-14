import { useState, useEffect, useCallback } from 'react'
import { getSupabaseClient } from '@pluckk/shared/supabase'
import {
  calculateNextReview,
  previewIntervals,
  getInitialState,
  RATINGS,
  STATUS,
  ALGORITHM_VERSION,
} from '@pluckk/shared/scheduler'

const supabase = getSupabaseClient()

const DEFAULT_NEW_CARDS_PER_DAY = 10
const NEW_CARDS_KEY = 'pluckk_new_cards_per_day'

/**
 * Get the new cards per day setting from localStorage.
 */
function getNewCardsPerDay() {
  try {
    const saved = localStorage.getItem(NEW_CARDS_KEY)
    if (saved) {
      const parsed = parseInt(saved, 10)
      if (!isNaN(parsed) && parsed >= 0) {
        return parsed
      }
    }
  } catch (e) {
    // localStorage may not be available
  }
  return DEFAULT_NEW_CARDS_PER_DAY
}

/**
 * Hook for managing spaced repetition review state.
 * Fetches due cards, handles rating submissions, and logs reviews.
 */
export function useReviewState(userId) {
  const [dueCards, setDueCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)

  /**
   * Fetch cards that are due for review.
   * Includes new cards (no review state) and cards with due_at <= now.
   *
   * Note: We don't use the database get_due_cards() RPC function because it only
   * returns cards that already have a card_review_state row. Cards that have never
   * been reviewed need to be included as "new" cards. For better performance with
   * large card counts, consider auto-creating review_state rows on card creation.
   */
  const fetchDueCards = useCallback(async () => {
    if (!userId) {
      setDueCards([])
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      // Fetch all user's cards - required to include cards without review state
      const { data: cards, error: cardsError } = await supabase
        .from('cards')
        .select('*, folder:folders(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (cardsError) {
        console.error('Error fetching cards:', cardsError)
        setDueCards([])
        setLoading(false)
        return
      }

      // Get review states for these cards (skip if no cards to avoid empty IN clause)
      const cardIds = cards.map(c => c.id)
      let reviewStates = []

      if (cardIds.length > 0) {
        const { data, error: statesError } = await supabase
          .from('card_review_state')
          .select('*')
          .eq('user_id', userId)
          .in('card_id', cardIds)

        if (statesError) {
          console.error('Error fetching review states:', statesError)
          // Continue without states - treat all as new
        } else {
          reviewStates = data || []
        }
      }

      // Create a map of card_id -> review_state
      const stateMap = new Map()
      reviewStates.forEach(state => {
        stateMap.set(state.card_id, state)
      })

      // Merge cards with their state and categorize
      const now = new Date()
      const cardsWithState = cards.map(card => {
        const state = stateMap.get(card.id) || null
        return {
          ...card,
          review_state: state,
          is_new: !state,
          is_due: !state || new Date(state.due_at) <= now,
        }
      })

      // Separate into review cards (due, have state) and new cards (no state)
      const reviewCards = cardsWithState.filter(c => c.is_due && !c.is_new)
      const newCards = cardsWithState.filter(c => c.is_new)

      // Apply new cards per day limit
      const newCardsLimit = getNewCardsPerDay()
      let limitedNewCards = newCards

      // If limit is 0, that means unlimited; otherwise apply the limit
      if (newCardsLimit > 0) {
        // Check how many new cards have already been reviewed today
        // Use local midnight for consistent day boundaries
        const todayStart = new Date(new Date().toDateString())

        const { data: todayLogs, error: logsError } = await supabase
          .from('review_logs')
          .select('card_id')
          .eq('user_id', userId)
          .gte('reviewed_at', todayStart.toISOString())
          .eq('previous_status', STATUS.NEW)

        if (logsError) {
          console.error('Error fetching review logs:', logsError)
          // Fail safe: if we can't count, show no new cards to prevent exceeding limit
          limitedNewCards = []
        } else {
          // Deduplicate by card_id in case same card was reviewed multiple times
          const uniqueCardIds = new Set(todayLogs?.map(log => log.card_id) || [])
          const newCardsReviewedToday = uniqueCardIds.size
          const remainingNewCards = Math.max(0, newCardsLimit - newCardsReviewedToday)

          // Limit new cards to the remaining allowance
          limitedNewCards = newCards.slice(0, remainingNewCards)
        }
      }

      // Combine review cards and limited new cards, then shuffle
      const allDue = [...reviewCards, ...limitedNewCards]
      const shuffled = allDue.sort(() => Math.random() - 0.5)

      setDueCards(shuffled)
      setCurrentIndex(0)
    } catch (error) {
      console.error('Error fetching due cards:', error)
      setDueCards([])
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchDueCards()
  }, [fetchDueCards])

  /**
   * Get interval previews for the current card.
   */
  const getIntervalPreviews = useCallback(() => {
    const currentCard = dueCards[currentIndex]
    if (!currentCard) return null

    const state = currentCard.review_state || getInitialState()
    return previewIntervals(state)
  }, [dueCards, currentIndex])

  /**
   * Submit a review rating for the current card.
   */
  const submitReview = useCallback(async (rating) => {
    const currentCard = dueCards[currentIndex]
    if (!currentCard) return { error: 'No current card' }

    try {
      const previousState = currentCard.review_state || getInitialState()
      const newState = calculateNextReview(previousState, rating)

      // Upsert the review state
      let stateId = previousState.id
      if (!stateId) {
        // Create new review state
        const { data: insertedState, error: insertError } = await supabase
          .from('card_review_state')
          .insert({
            card_id: currentCard.id,
            user_id: userId,
            status: newState.status,
            due_at: newState.due_at,
            interval_days: newState.interval_days,
            ease_factor: newState.ease_factor,
            review_count: 1,
            lapse_count: rating === RATINGS.AGAIN ? 1 : 0,
            streak: rating === RATINGS.AGAIN ? 0 : 1,
            last_reviewed_at: new Date().toISOString(),
          })
          .select()
          .single()

        if (insertError) {
          console.error('Error creating review state:', insertError)
          return { error: insertError }
        }
        stateId = insertedState.id
      } else {
        // Update existing review state
        const { error: updateError } = await supabase
          .from('card_review_state')
          .update({
            status: newState.status,
            due_at: newState.due_at,
            interval_days: newState.interval_days,
            ease_factor: newState.ease_factor,
            review_count: (previousState.review_count || 0) + 1,
            lapse_count: (previousState.lapse_count || 0) + (rating === RATINGS.AGAIN ? 1 : 0),
            streak: rating === RATINGS.AGAIN ? 0 : (previousState.streak || 0) + 1,
            last_reviewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', stateId)

        if (updateError) {
          console.error('Error updating review state:', updateError)
          return { error: updateError }
        }
      }

      // Log the review
      const { error: logError } = await supabase
        .from('review_logs')
        .insert({
          card_review_state_id: stateId,
          user_id: userId,
          card_id: currentCard.id,
          review_mode: 'standard',
          rating: rating,
          previous_status: previousState.status || STATUS.NEW,
          previous_interval: previousState.interval_days || 0,
          previous_ease: previousState.ease_factor || 2.5,
          previous_due: previousState.due_at || null,
          new_status: newState.status,
          new_interval: newState.interval_days,
          new_ease: newState.ease_factor,
          new_due: newState.due_at,
          algorithm_version: ALGORITHM_VERSION,
          reviewed_at: new Date().toISOString(),
        })

      if (logError) {
        console.error('Error logging review:', logError)
        // Don't fail the whole operation for logging errors
      }

      // Move to next card
      setCurrentIndex(prev => prev + 1)

      return { success: true, newState }
    } catch (error) {
      console.error('Error submitting review:', error)
      return { error }
    }
  }, [dueCards, currentIndex, userId])

  /**
   * Get the current card being reviewed.
   */
  const currentCard = dueCards[currentIndex] || null

  /**
   * Check if review session is complete.
   */
  const isComplete = currentIndex >= dueCards.length

  /**
   * Restart the review session.
   */
  const restart = useCallback(() => {
    fetchDueCards()
  }, [fetchDueCards])

  return {
    dueCards,
    currentCard,
    currentIndex,
    loading,
    isComplete,
    totalCards: dueCards.length,
    reviewedCount: currentIndex,
    getIntervalPreviews,
    submitReview,
    restart,
    refetch: fetchDueCards,
    RATINGS, // Export for convenience
  }
}
