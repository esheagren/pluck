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
const SESSION_KEY = 'pluckk_review_session'

/**
 * Save the current review session to sessionStorage.
 */
function saveSession(cardIds, currentIndex) {
  try {
    const session = {
      cardIds,
      currentIndex,
      timestamp: Date.now(),
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch (e) {
    // sessionStorage may not be available
  }
}

/**
 * Load a saved review session from sessionStorage.
 * Returns null if no valid session exists.
 */
function loadSession() {
  try {
    const saved = sessionStorage.getItem(SESSION_KEY)
    if (!saved) return null

    const session = JSON.parse(saved)

    // Invalidate sessions older than 24 hours
    const maxAge = 24 * 60 * 60 * 1000
    if (Date.now() - session.timestamp > maxAge) {
      sessionStorage.removeItem(SESSION_KEY)
      return null
    }

    return session
  } catch (e) {
    return null
  }
}

/**
 * Clear the saved review session.
 */
function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch (e) {
    // sessionStorage may not be available
  }
}

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
  const [totalNewCards, setTotalNewCards] = useState(0)
  const [newCardsAvailableToday, setNewCardsAvailableToday] = useState(0)

  /**
   * Try to restore a saved session by fetching fresh data for saved card IDs.
   * Returns the restored cards and index, or null if restoration failed.
   */
  const tryRestoreSession = useCallback(async (session) => {
    if (!session || !session.cardIds || session.cardIds.length === 0) {
      return null
    }

    try {
      // Fetch fresh card data for the saved IDs
      const { data: cards, error: cardsError } = await supabase
        .from('cards')
        .select('*, folder:folders(*)')
        .eq('user_id', userId)
        .in('id', session.cardIds)

      if (cardsError || !cards) {
        return null
      }

      // Get review states for these cards
      const { data: reviewStates } = await supabase
        .from('card_review_state')
        .select('*')
        .eq('user_id', userId)
        .in('card_id', session.cardIds)

      const stateMap = new Map()
      ;(reviewStates || []).forEach(state => {
        stateMap.set(state.card_id, state)
      })

      // Create a map for quick lookup
      const cardMap = new Map()
      cards.forEach(card => {
        const state = stateMap.get(card.id) || null
        cardMap.set(card.id, {
          ...card,
          review_state: state,
          is_new: !state,
        })
      })

      // Restore cards in original order, filtering out deleted ones
      const restoredCards = []
      for (const id of session.cardIds) {
        const card = cardMap.get(id)
        if (card) {
          restoredCards.push(card)
        }
      }

      // If no cards remain, return null to start fresh
      if (restoredCards.length === 0) {
        return null
      }

      // Adjust index if cards before current position were removed
      const removedBeforeIndex = session.cardIds
        .slice(0, session.currentIndex)
        .filter(id => !cardMap.has(id)).length
      const adjustedIndex = Math.max(0, session.currentIndex - removedBeforeIndex)

      // If adjusted index is past the end, session is complete
      if (adjustedIndex >= restoredCards.length) {
        return null
      }

      return {
        cards: restoredCards,
        index: adjustedIndex,
      }
    } catch (e) {
      console.error('Error restoring session:', e)
      return null
    }
  }, [userId])

  /**
   * Fetch cards that are due for review.
   * Includes new cards (no review state) and cards with due_at <= now.
   * Will restore from a saved session if one exists.
   *
   * Note: We don't use the database get_due_cards() RPC function because it only
   * returns cards that already have a card_review_state row. Cards that have never
   * been reviewed need to be included as "new" cards. For better performance with
   * large card counts, consider auto-creating review_state rows on card creation.
   */
  const fetchDueCards = useCallback(async (forceRefresh = false) => {
    if (!userId) {
      setDueCards([])
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      // Try to restore from saved session (unless forcing refresh)
      if (!forceRefresh) {
        const session = loadSession()
        if (session) {
          const restored = await tryRestoreSession(session)
          if (restored) {
            setDueCards(restored.cards)
            setCurrentIndex(restored.index)
            // Update new cards counts
            const newCardsInQueue = restored.cards.filter(c => c.is_new).length
            setTotalNewCards(newCardsInQueue)
            setNewCardsAvailableToday(newCardsInQueue)
            setLoading(false)
            return
          }
        }
      }

      // Clear any stale session since we're fetching fresh
      clearSession()
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

      // Store total new cards count
      setTotalNewCards(newCards.length)

      // Apply new cards per day limit
      const newCardsLimit = getNewCardsPerDay()
      let limitedNewCards = newCards
      let availableToday = newCards.length // Default to all new cards if unlimited

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
          availableToday = 0
        } else {
          // Deduplicate by card_id in case same card was reviewed multiple times
          const uniqueCardIds = new Set(todayLogs?.map(log => log.card_id) || [])
          const newCardsReviewedToday = uniqueCardIds.size
          const remainingNewCards = Math.max(0, newCardsLimit - newCardsReviewedToday)

          // Track how many new cards are available today (min of remaining allowance and available cards)
          availableToday = Math.min(remainingNewCards, newCards.length)

          // Limit new cards to the remaining allowance
          limitedNewCards = newCards.slice(0, remainingNewCards)
        }
      }

      // Store available new cards for today
      setNewCardsAvailableToday(availableToday)

      // Combine review cards and limited new cards, then shuffle
      const allDue = [...reviewCards, ...limitedNewCards]
      const shuffled = allDue.sort(() => Math.random() - 0.5)

      setDueCards(shuffled)
      setCurrentIndex(0)

      // Save the new session
      if (shuffled.length > 0) {
        saveSession(shuffled.map(c => c.id), 0)
      }
    } catch (error) {
      console.error('Error fetching due cards:', error)
      setDueCards([])
    } finally {
      setLoading(false)
    }
  }, [userId, tryRestoreSession])

  /**
   * Start a session with only new cards (no review cards).
   * @param {boolean} ignoreLimit - If true, bypasses the daily new cards limit
   */
  const startNewCardsSession = useCallback(async (ignoreLimit = false) => {
    if (!userId) {
      setDueCards([])
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      // Fetch all user's cards
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

      // Get review states to identify new cards
      const cardIds = cards.map(c => c.id)
      let reviewStates = []

      if (cardIds.length > 0) {
        const { data, error: statesError } = await supabase
          .from('card_review_state')
          .select('card_id')
          .eq('user_id', userId)
          .in('card_id', cardIds)

        if (!statesError) {
          reviewStates = data || []
        }
      }

      // Find cards without review state (new cards)
      const reviewedCardIds = new Set(reviewStates.map(s => s.card_id))
      const newCards = cards
        .filter(c => !reviewedCardIds.has(c.id))
        .map(c => ({ ...c, review_state: null, is_new: true }))

      // Update total new cards count
      setTotalNewCards(newCards.length)

      // Apply daily limit (unless ignoreLimit is true)
      const newCardsLimit = getNewCardsPerDay()
      let limitedNewCards = newCards
      let availableToday = newCards.length

      if (ignoreLimit) {
        // When ignoring the daily limit, still batch by user's preference
        const batchSize = newCardsLimit > 0 ? newCardsLimit : newCards.length
        limitedNewCards = newCards.slice(0, batchSize)
        availableToday = newCards.length
      } else if (newCardsLimit > 0) {
        const todayStart = new Date(new Date().toDateString())

        const { data: todayLogs, error: logsError } = await supabase
          .from('review_logs')
          .select('card_id')
          .eq('user_id', userId)
          .gte('reviewed_at', todayStart.toISOString())
          .eq('previous_status', STATUS.NEW)

        if (logsError) {
          limitedNewCards = []
          availableToday = 0
        } else {
          const uniqueCardIds = new Set(todayLogs?.map(log => log.card_id) || [])
          const newCardsReviewedToday = uniqueCardIds.size
          const remainingNewCards = Math.max(0, newCardsLimit - newCardsReviewedToday)

          availableToday = Math.min(remainingNewCards, newCards.length)
          limitedNewCards = newCards.slice(0, remainingNewCards)
        }
      }

      setNewCardsAvailableToday(availableToday)

      // Clear any existing session and start fresh
      clearSession()

      // Shuffle and set
      const shuffled = limitedNewCards.sort(() => Math.random() - 0.5)
      setDueCards(shuffled)
      setCurrentIndex(0)

      // Save the new session
      if (shuffled.length > 0) {
        saveSession(shuffled.map(c => c.id), 0)
      }
    } catch (error) {
      console.error('Error fetching new cards:', error)
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
      const newIndex = currentIndex + 1
      setCurrentIndex(newIndex)

      // Update session - clear if complete, otherwise save progress
      if (newIndex >= dueCards.length) {
        clearSession()
      } else {
        saveSession(dueCards.map(c => c.id), newIndex)
      }

      return { success: true, newState }
    } catch (error) {
      console.error('Error submitting review:', error)
      return { error }
    }
  }, [dueCards, currentIndex, userId])

  /**
   * Skip the current card, moving it to the end of the queue.
   */
  const skipCard = useCallback(() => {
    if (currentIndex >= dueCards.length) return

    const currentCard = dueCards[currentIndex]
    const newDueCards = [
      ...dueCards.slice(0, currentIndex),
      ...dueCards.slice(currentIndex + 1),
      currentCard,
    ]

    setDueCards(newDueCards)
    // Save updated session (index stays the same, but card order changed)
    saveSession(newDueCards.map(c => c.id), currentIndex)
  }, [dueCards, currentIndex])

  /**
   * Get the current card being reviewed.
   */
  const currentCard = dueCards[currentIndex] || null

  /**
   * Check if review session is complete.
   */
  const isComplete = currentIndex >= dueCards.length

  /**
   * Restart the review session (clears saved progress).
   */
  const restart = useCallback(() => {
    clearSession()
    fetchDueCards(true) // Force refresh
  }, [fetchDueCards])

  return {
    dueCards,
    currentCard,
    currentIndex,
    loading,
    isComplete,
    totalCards: dueCards.length,
    reviewedCount: currentIndex,
    totalNewCards,
    newCardsAvailableToday,
    newCardsPerDay: getNewCardsPerDay(),
    getIntervalPreviews,
    submitReview,
    skipCard,
    restart,
    startNewCardsSession,
    refetch: fetchDueCards,
    RATINGS, // Export for convenience
  }
}
