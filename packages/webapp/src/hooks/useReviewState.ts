import { useState, useEffect, useCallback } from 'react';
import { api } from '@pluckk/shared/api';
import {
  calculateNextReview,
  previewIntervals,
  getInitialState,
  RATINGS,
  STATUS,
  ALGORITHM_VERSION,
} from '@pluckk/shared/scheduler';
import type {
  Rating,
  CardReviewState,
  IntervalPreviews,
  RatingsMap,
} from '@pluckk/shared/scheduler';
import type {
  CardWithReviewState,
  SavedSession,
  RestoredSession,
  ReviewSubmitResult,
  UseReviewStateReturn,
  SessionConfig,
  SessionMeta,
} from '../types';

const DEFAULT_CONFIG: SessionConfig = { mode: 'scheduled' };

const DEFAULT_NEW_CARDS_PER_DAY = 10;
const NEW_CARDS_KEY = 'pluckk_new_cards_per_day';
const SESSION_KEY = 'pluckk_review_session';

/**
 * Save the current review session to sessionStorage.
 */
function saveSession(cardIds: string[], currentIndex: number): void {
  try {
    const session: SavedSession = {
      cardIds,
      currentIndex,
      timestamp: Date.now(),
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (_e) {
    // sessionStorage may not be available
  }
}

/**
 * Load a saved review session from sessionStorage.
 * Returns null if no valid session exists.
 */
function loadSession(): SavedSession | null {
  try {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (!saved) return null;

    const session: SavedSession = JSON.parse(saved);

    // Invalidate sessions from a previous day (midnight boundary)
    const todayStart = new Date(new Date().toDateString()).getTime();
    if (session.timestamp < todayStart) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }

    return session;
  } catch (_e) {
    return null;
  }
}

/**
 * Clear the saved review session.
 */
function clearSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch (_e) {
    // sessionStorage may not be available
  }
}

/**
 * Get the new cards per day setting from localStorage.
 */
function getNewCardsPerDay(): number {
  try {
    const saved = localStorage.getItem(NEW_CARDS_KEY);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        return parsed;
      }
    }
  } catch (_e) {
    // localStorage may not be available
  }
  return DEFAULT_NEW_CARDS_PER_DAY;
}

/**
 * Hook for managing spaced repetition review state.
 * Fetches due cards, handles rating submissions, and logs reviews.
 */
export function useReviewState(userId: string | undefined, config: SessionConfig = DEFAULT_CONFIG): UseReviewStateReturn {
  const configKey = JSON.stringify([config.mode, config.folderId ?? '*', config.size ?? 0, config.mix ?? null]);
  const [dueCards, setDueCards] = useState<CardWithReviewState[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalNewCards, setTotalNewCards] = useState(0);
  const [newCardsAvailableToday, setNewCardsAvailableToday] = useState(0);
  const [sessionMeta, setSessionMeta] = useState<SessionMeta | null>(null);

  /**
   * Try to restore a saved session by fetching fresh data for saved card IDs.
   * Returns the restored cards and index, or null if restoration failed.
   */
  const tryRestoreSession = useCallback(
    async (session: SavedSession): Promise<RestoredSession | null> => {
      if (!userId || !session || !session.cardIds || session.cardIds.length === 0) {
        return null;
      }

      try {
        // Fetch fresh data for the saved IDs (one round trip: cards + states)
        const wanted = new Set(session.cardIds);
        const queue = await api.review.queue();
        const cards = queue.cards.filter((c) => wanted.has(c.id)) as unknown as CardWithReviewState[];

        const stateMap = new Map<string, CardReviewState>();
        queue.states.forEach((state) => {
          if (wanted.has(state.card_id)) stateMap.set(state.card_id, state as unknown as CardReviewState);
        });

        // Create a map for quick lookup
        const cardMap = new Map<string, CardWithReviewState>();
        cards.forEach((card: CardWithReviewState) => {
          const state = stateMap.get(card.id) || null;
          cardMap.set(card.id, {
            ...card,
            review_state: state,
            is_new: !state,
          });
        });

        // Restore cards in original order, filtering out deleted ones
        const restoredCards: CardWithReviewState[] = [];
        for (const id of session.cardIds) {
          const card = cardMap.get(id);
          if (card) {
            restoredCards.push(card);
          }
        }

        // If no cards remain, return null to start fresh
        if (restoredCards.length === 0) {
          return null;
        }

        // Adjust index if cards before current position were removed
        const removedBeforeIndex = session.cardIds
          .slice(0, session.currentIndex)
          .filter((id) => !cardMap.has(id)).length;
        const adjustedIndex = Math.max(0, session.currentIndex - removedBeforeIndex);

        // If adjusted index is past the end, session is complete
        if (adjustedIndex >= restoredCards.length) {
          return null;
        }

        return {
          cards: restoredCards,
          index: adjustedIndex,
        };
      } catch (_e) {
        console.error('Error restoring session:', _e);
        return null;
      }
    },
    [userId]
  );

  /**
   * Fetch cards that are due for review.
   * Includes new cards (no review state) and cards with due_at <= now.
   * Will restore from a saved session if one exists.
   */
  const fetchDueCards = useCallback(
    async (forceRefresh = false): Promise<void> => {
      if (!userId) {
        setDueCards([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        // Try to restore from saved session (unless forcing refresh)
        if (!forceRefresh) {
          const session = loadSession();
          if (session) {
            const restored = await tryRestoreSession(session);
            if (restored) {
              setDueCards(restored.cards);
              setCurrentIndex(restored.index);
              // Update new cards counts
              const newCardsInQueue = restored.cards.filter((c) => c.is_new).length;
              setTotalNewCards(newCardsInQueue);
              setNewCardsAvailableToday(newCardsInQueue);
              setLoading(false);
              return;
            }
          }
        }

        // Clear any stale session since we're fetching fresh
        clearSession();
        // The server-side mixer selects and orders the session (quotas, per-folder
        // new-card caps, pauses); we only annotate the dealt cards.
        const session = await api.review.session({
          mode: config.mode,
          size: config.size,
          folder_id: config.mode === 'focus' || config.mode === 'backlog' ? config.folderId ?? null : undefined,
          mix: config.mix,
        });
        setSessionMeta(session.meta);
        const stateMap = new Map(session.states.map((st) => [st.card_id, st as unknown as CardReviewState]));
        const dealt: CardWithReviewState[] = (session.cards as unknown as CardWithReviewState[]).map((card) => ({
          ...card,
          review_state: stateMap.get(card.id) ?? null,
          is_new: !stateMap.has(card.id),
          is_due: true,
        }));

        const folderTotals = Object.values(session.meta.per_folder);
        setTotalNewCards(folderTotals.reduce((s, f) => s + f.new, 0));
        setNewCardsAvailableToday(dealt.filter((c) => c.is_new).length);

        setDueCards(dealt);
        setCurrentIndex(0);
        if (dealt.length > 0) {
          saveSession(dealt.map((c) => c.id), 0);
        }
      } catch (error) {
        console.error('Error fetching due cards:', error);
        setDueCards([]);
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, tryRestoreSession, configKey]
  );

  /**
   * Start a session with only new cards (no review cards).
   * @param ignoreLimit - If true, bypasses the daily new cards limit
   */
  const startNewCardsSession = useCallback(
    async (ignoreLimit = false): Promise<void> => {
      if (!userId) {
        setDueCards([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const queue = await api.review.queue();
        const cards = queue.cards as unknown as CardWithReviewState[];
        const reviewStates: Array<{ card_id: string }> = queue.states;

        // Find cards without review state (new cards)
        const reviewedCardIds = new Set(reviewStates.map((s) => s.card_id));
        const newCards: CardWithReviewState[] = (cards as CardWithReviewState[])
          .filter((c) => !reviewedCardIds.has(c.id))
          .map((c): CardWithReviewState => ({ ...c, review_state: null, is_new: true }));

        // Update total new cards count
        setTotalNewCards(newCards.length);

        // Apply daily limit (unless ignoreLimit is true)
        const newCardsLimit = getNewCardsPerDay();
        let limitedNewCards = newCards;
        let availableToday = newCards.length;

        if (ignoreLimit) {
          // When ignoring the daily limit, still batch by user's preference
          const batchSize = newCardsLimit > 0 ? newCardsLimit : newCards.length;
          limitedNewCards = newCards.slice(0, batchSize);
          availableToday = newCards.length;
        } else if (newCardsLimit > 0) {
          const todayStart = new Date(new Date().toDateString());

          void todayStart;
          const newCardsReviewedToday = new Set(queue.new_reviewed_today).size;
          const remainingNewCards = Math.max(0, newCardsLimit - newCardsReviewedToday);

          availableToday = Math.min(remainingNewCards, newCards.length);
          limitedNewCards = newCards.slice(0, remainingNewCards);
        }

        setNewCardsAvailableToday(availableToday);

        // Clear any existing session and start fresh
        clearSession();

        // Shuffle and set
        const shuffled = limitedNewCards.sort(() => Math.random() - 0.5);
        setDueCards(shuffled);
        setCurrentIndex(0);

        // Save the new session
        if (shuffled.length > 0) {
          saveSession(
            shuffled.map((c) => c.id),
            0
          );
        }
      } catch (error) {
        console.error('Error fetching new cards:', error);
        setDueCards([]);
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    fetchDueCards();
  }, [fetchDueCards]);

  /**
   * Get interval previews for the current card.
   */
  const getIntervalPreviews = useCallback((): IntervalPreviews | null => {
    const currentCard = dueCards[currentIndex];
    if (!currentCard) return null;

    const state = currentCard.review_state || getInitialState();
    return previewIntervals(state);
  }, [dueCards, currentIndex]);

  /**
   * Submit a review rating for the current card.
   */
  const submitReview = useCallback(
    async (rating: Rating): Promise<ReviewSubmitResult> => {
      const currentCard = dueCards[currentIndex];
      if (!currentCard) return { error: 'No current card' };

      try {
        const previousState = currentCard.review_state || getInitialState();
        const newState = calculateNextReview(previousState, rating);

        // Server upserts card_review_state (counts, streak, lapses) and writes the review log.
        void userId; void STATUS;
        const { state: savedState } = await api.review.submit({
          card_id: currentCard.id,
          rating,
          new_state: {
            status: newState.status,
            due_at: newState.due_at,
            interval_days: newState.interval_days,
            ease_factor: newState.ease_factor,
          },
          algorithm_version: ALGORITHM_VERSION,
        });
        const stateId = savedState.id;

        // If this was a new card, decrement today's available count
        if (currentCard.is_new) {
          setNewCardsAvailableToday((prev) => Math.max(0, prev - 1));
        }

        // Handle card progression
        if (rating === RATINGS.AGAIN) {
          // Re-queue "Again" cards at the end of the session
          // Update the card's local state so it shows correct intervals when it comes back
          // Mark as _againCard so progress bar can show it in red
          const updatedCard: CardWithReviewState = {
            ...currentCard,
            _againCard: true,
            review_state: {
              ...currentCard.review_state,
              ...newState,
              id: stateId,
            } as CardReviewState,
          };
          const newDueCards = [
            ...dueCards.slice(0, currentIndex),
            ...dueCards.slice(currentIndex + 1),
            updatedCard,
          ];
          setDueCards(newDueCards);
          // Index stays the same (next card slides into current position)
          saveSession(
            newDueCards.map((c) => c.id),
            currentIndex
          );
        } else {
          // Move to next card
          const newIndex = currentIndex + 1;
          setCurrentIndex(newIndex);

          // Update session - clear if complete, otherwise save progress
          if (newIndex >= dueCards.length) {
            clearSession();
          } else {
            saveSession(
              dueCards.map((c) => c.id),
              newIndex
            );
          }
        }

        return { success: true, newState };
      } catch (error) {
        console.error('Error submitting review:', error);
        return { error };
      }
    },
    [dueCards, currentIndex, userId]
  );

  /**
   * Skip the current card, moving it to the end of the queue.
   */
  const skipCard = useCallback((): void => {
    if (currentIndex >= dueCards.length) return;

    const currentCard = dueCards[currentIndex];
    const newDueCards = [
      ...dueCards.slice(0, currentIndex),
      ...dueCards.slice(currentIndex + 1),
      currentCard,
    ];

    setDueCards(newDueCards);
    // Save updated session (index stays the same, but card order changed)
    saveSession(
      newDueCards.map((c) => c.id),
      currentIndex
    );
  }, [dueCards, currentIndex]);

  /**
   * Remove a card from the review queue (e.g., after deletion).
   * Handles edge cases like removing the current card or the last card.
   */
  const removeCard = useCallback((cardId: string): void => {
    const cardIndex = dueCards.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) return;

    const newDueCards = dueCards.filter((c) => c.id !== cardId);
    setDueCards(newDueCards);

    // Adjust current index if needed
    if (newDueCards.length === 0) {
      // No cards left - session is complete
      setCurrentIndex(0);
      clearSession();
    } else if (cardIndex < currentIndex) {
      // Removed card was before current position - shift index back
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      saveSession(
        newDueCards.map((c) => c.id),
        newIndex
      );
    } else if (cardIndex === currentIndex && currentIndex >= newDueCards.length) {
      // Removed current card and it was the last one - go to previous (now last)
      const newIndex = newDueCards.length - 1;
      setCurrentIndex(newIndex);
      saveSession(
        newDueCards.map((c) => c.id),
        newIndex
      );
    } else {
      // Removed card was after current or current card removed but more cards remain
      // Index stays the same (next card slides into position)
      saveSession(
        newDueCards.map((c) => c.id),
        currentIndex
      );
    }
  }, [dueCards, currentIndex]);

  /**
   * Get the current card being reviewed.
   */
  const currentCard = dueCards[currentIndex] || null;

  /**
   * Check if review session is complete.
   */
  const isComplete = currentIndex >= dueCards.length;

  /**
   * Restart the review session (clears saved progress).
   */
  const restart = useCallback((): void => {
    clearSession();
    fetchDueCards(true); // Force refresh
  }, [fetchDueCards]);

  return {
    sessionMeta,
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
    removeCard,
    restart,
    startNewCardsSession,
    refetch: fetchDueCards,
    RATINGS: RATINGS as RatingsMap, // Export for convenience
  };
}
