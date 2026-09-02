import { useState, useEffect, useCallback } from 'react';
import { api } from '@pluckk/shared/api';
import type { ReviewItem } from '@pluckk/shared/api';
import { RATINGS } from '@pluckk/shared/scheduler';
import type { Rating, CardReviewState, IntervalPreviews, RatingsMap } from '@pluckk/shared/scheduler';
import type {
  CardWithReviewState,
  SavedSession,
  RestoredSession,
  ReviewSubmitResult,
  UseReviewStateReturn,
  SessionConfig,
  SessionMeta,
} from '../types';

// core-engine (step 4): a review session is a queue of COMPONENTS — one direction of a
// bidirectional card, one prompt of a list — each with its own schedule. The server
// deals them (mixer), renders them, schedules them and previews them; this hook only
// keeps the queue, the cursor, and the saved session.

const DEFAULT_CONFIG: SessionConfig = { mode: 'scheduled' };

const DEFAULT_NEW_CARDS_PER_DAY = 10;
const NEW_CARDS_KEY = 'pluckk_new_cards_per_day';
const SESSION_KEY = 'pluckk_review_session';

// Stamped onto saved sessions so a Mix session never resumes inside a Focus/Backlog one.
let activeConfigKey = '';

const itemKey = (c: Pick<CardWithReviewState, 'id' | 'component_id'>) => `${c.id}|${c.component_id}`;
const parseKey = (k: string) => { const [card_id, component_id = 'main'] = k.split('|'); return { card_id, component_id }; };

function saveSession(items: string[], currentIndex: number): void {
  try {
    const session: SavedSession = { items, currentIndex, timestamp: Date.now(), configKey: activeConfigKey };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (_e) {
    // sessionStorage may not be available
  }
}

function loadSession(): SavedSession | null {
  try {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (!saved) return null;
    const session = JSON.parse(saved) as SavedSession;
    if (!Array.isArray(session.items)) { sessionStorage.removeItem(SESSION_KEY); return null; }  // pre-component sessions
    // Invalidate sessions from a previous day (midnight boundary)
    const todayStart = new Date(new Date().toDateString()).getTime();
    if (session.timestamp < todayStart) { sessionStorage.removeItem(SESSION_KEY); return null; }
    return session;
  } catch (_e) {
    return null;
  }
}

function clearSession(): void {
  try { sessionStorage.removeItem(SESSION_KEY); } catch (_e) { /* unavailable */ }
}

function getNewCardsPerDay(): number {
  try {
    const saved = localStorage.getItem(NEW_CARDS_KEY);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 0) return parsed;
    }
  } catch (_e) { /* unavailable */ }
  return DEFAULT_NEW_CARDS_PER_DAY;
}

/** A server review item → the queue entry the pages render. */
function toQueueEntry(item: ReviewItem): CardWithReviewState {
  return {
    ...(item as unknown as CardWithReviewState),
    id: item.card_id,
    component_id: item.component_id,
    review_state: (item.review_state as unknown as CardReviewState) ?? null,
    is_new: item.is_new,
    is_due: true,
    previews: item.previews,
  };
}

/**
 * Hook for managing a spaced-repetition review session.
 */
export function useReviewState(userId: string | undefined, config: SessionConfig = DEFAULT_CONFIG): UseReviewStateReturn {
  const configKey = JSON.stringify([config.mode, config.folderId ?? '*', config.size ?? 0, config.mix ?? null]);
  activeConfigKey = configKey;
  const [dueCards, setDueCards] = useState<CardWithReviewState[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalNewCards, setTotalNewCards] = useState(0);
  const [newCardsAvailableToday, setNewCardsAvailableToday] = useState(0);
  const [sessionMeta, setSessionMeta] = useState<SessionMeta | null>(null);

  /** Re-fetch the saved (card, component) pairs; drops items that no longer exist. */
  const tryRestoreSession = useCallback(
    async (session: SavedSession): Promise<RestoredSession | null> => {
      if (!userId || !session?.items?.length) return null;
      try {
        const { items } = await api.review.items(session.items.map(parseKey));
        const byKey = new Map(items.map((i) => [`${i.card_id}|${i.component_id}`, toQueueEntry(i)]));
        const restored: CardWithReviewState[] = [];
        for (const k of session.items) { const e = byKey.get(k); if (e) restored.push(e); }
        if (restored.length === 0) return null;
        const removedBefore = session.items.slice(0, session.currentIndex).filter((k) => !byKey.has(k)).length;
        const index = Math.max(0, session.currentIndex - removedBefore);
        if (index >= restored.length) return null;
        return { cards: restored, index };
      } catch (e) {
        console.error('Error restoring session:', e);
        return null;
      }
    },
    [userId]
  );

  /**
   * Deal a session (or resume the saved one for this config).
   */
  const fetchDueCards = useCallback(
    async (forceRefresh = false): Promise<void> => {
      if (!userId) { setDueCards([]); setLoading(false); return; }
      setLoading(true);
      try {
        if (!forceRefresh) {
          const session = loadSession();
          if (session && (session.configKey ?? '') === configKey) {
            const restored = await tryRestoreSession(session);
            if (restored) {
              setDueCards(restored.cards);
              setCurrentIndex(restored.index);
              const newInQueue = restored.cards.filter((c) => c.is_new).length;
              setTotalNewCards(newInQueue);
              setNewCardsAvailableToday(newInQueue);
              setLoading(false);
              return;
            }
          }
        }
        clearSession();
        const session = await api.review.session({
          mode: config.mode,
          size: config.size,
          folder_id: config.mode === 'focus' || config.mode === 'backlog' ? config.folderId ?? null : undefined,
          mix: config.mix,
        });
        setSessionMeta(session.meta);
        const dealt = (session.items ?? []).map(toQueueEntry);
        const folderTotals = Object.values(session.meta.per_folder);
        setTotalNewCards(folderTotals.reduce((s, f) => s + f.new, 0));
        setNewCardsAvailableToday(dealt.filter((c) => c.is_new).length);
        setDueCards(dealt);
        setCurrentIndex(0);
        if (dealt.length > 0) saveSession(dealt.map(itemKey), 0);
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
   * A session of new cards only (optionally ignoring the daily limit).
   */
  const startNewCardsSession = useCallback(
    async (ignoreLimit = false): Promise<void> => {
      if (!userId) { setDueCards([]); setLoading(false); return; }
      setLoading(true);
      try {
        const queue = await api.review.queue();
        const reviewed = new Set(queue.states.map((s) => s.card_id));
        const fresh = queue.cards.filter((c) => !reviewed.has(c.id));
        setTotalNewCards(fresh.length);

        const limit = getNewCardsPerDay();
        let take = fresh;
        let availableToday = fresh.length;
        if (ignoreLimit) {
          take = fresh.slice(0, limit > 0 ? limit : fresh.length);
        } else if (limit > 0) {
          const introducedToday = new Set(queue.new_reviewed_today).size;
          const remaining = Math.max(0, limit - introducedToday);
          availableToday = Math.min(remaining, fresh.length);
          take = fresh.slice(0, remaining);
        }
        setNewCardsAvailableToday(availableToday);
        clearSession();

        const shuffled = [...take].sort(() => Math.random() - 0.5);
        // Render each card's first component with server previews.
        const { items } = await api.review.items(shuffled.map((c) => ({ card_id: c.id, component_id: 'main' })));
        const entries = items.map(toQueueEntry);
        setDueCards(entries);
        setCurrentIndex(0);
        if (entries.length > 0) saveSession(entries.map(itemKey), 0);
      } catch (error) {
        console.error('Error fetching new cards:', error);
        setDueCards([]);
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  useEffect(() => { fetchDueCards(); }, [fetchDueCards]);

  /** Interval previews for the current item (computed by the server). */
  const getIntervalPreviews = useCallback((): IntervalPreviews | null => {
    return dueCards[currentIndex]?.previews ?? null;
  }, [dueCards, currentIndex]);

  /**
   * Rate the current item. The server schedules and returns the new state.
   */
  const submitReview = useCallback(
    async (rating: Rating): Promise<ReviewSubmitResult> => {
      const current = dueCards[currentIndex];
      if (!current) return { error: 'No current card' };
      try {
        const res = await api.review.submit({ card_id: current.id, component_id: current.component_id, rating });
        const savedState = res.state as unknown as CardReviewState;

        if (current.is_new) setNewCardsAvailableToday((prev) => Math.max(0, prev - 1));

        if (rating === RATINGS.AGAIN) {
          // Re-queue at the end of the session with its fresh state and previews.
          const updated: CardWithReviewState = { ...current, _againCard: true, is_new: false, review_state: savedState, previews: res.previews };
          const next = [...dueCards.slice(0, currentIndex), ...dueCards.slice(currentIndex + 1), updated];
          setDueCards(next);
          saveSession(next.map(itemKey), currentIndex);
        } else {
          const newIndex = currentIndex + 1;
          setCurrentIndex(newIndex);
          if (newIndex >= dueCards.length) clearSession();
          else saveSession(dueCards.map(itemKey), newIndex);
        }
        return { success: true, state: savedState };
      } catch (error) {
        console.error('Error submitting review:', error);
        return { error };
      }
    },
    [dueCards, currentIndex]
  );

  /** Skip the current item, moving it to the end of the queue. */
  const skipCard = useCallback((): void => {
    if (currentIndex >= dueCards.length) return;
    const current = dueCards[currentIndex];
    const next = [...dueCards.slice(0, currentIndex), ...dueCards.slice(currentIndex + 1), current];
    setDueCards(next);
    saveSession(next.map(itemKey), currentIndex);
  }, [dueCards, currentIndex]);

  /** Remove every component of a card from the queue (e.g. after deletion). */
  const removeCard = useCallback((cardId: string): void => {
    const removedIdx = dueCards.map((c, i) => (c.id === cardId ? i : -1)).filter((i) => i >= 0);
    if (removedIdx.length === 0) return;
    const next = dueCards.filter((c) => c.id !== cardId);
    const removedBefore = removedIdx.filter((i) => i < currentIndex).length;
    let newIndex = currentIndex - removedBefore;
    if (next.length === 0) { setDueCards([]); setCurrentIndex(0); clearSession(); return; }
    if (newIndex >= next.length) newIndex = next.length - 1;
    setDueCards(next);
    setCurrentIndex(newIndex);
    saveSession(next.map(itemKey), newIndex);
  }, [dueCards, currentIndex]);

  const currentCard = dueCards[currentIndex] || null;
  const isComplete = currentIndex >= dueCards.length;

  const restart = useCallback((): void => {
    clearSession();
    fetchDueCards(true);
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
    RATINGS: RATINGS as RatingsMap,
  };
}
