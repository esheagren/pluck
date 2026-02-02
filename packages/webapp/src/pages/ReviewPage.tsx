import { useState, useEffect, useCallback, type ReactNode, type JSX } from 'react';
import ReviewCard from '../components/ReviewCard';
import ReviewProgressBar from '../components/ReviewProgressBar';
import { useReviewState } from '../hooks/useReviewState';
import type { ReviewPageProps } from '../types';
import type { Rating } from '@pluckk/shared/scheduler';

interface CenteredWrapperProps {
  children: ReactNode;
}

// Wrapper component for centering content vertically
// IMPORTANT: Defined outside component to prevent remounting children on every render
function CenteredWrapper({ children }: CenteredWrapperProps): JSX.Element {
  return (
    <div className="min-h-[calc(100vh-120px)] flex items-center justify-center">{children}</div>
  );
}

export default function ReviewPage({
  userId,
  onUpdateCard,
  onDeleteCard,
}: ReviewPageProps): JSX.Element {
  const {
    currentCard,
    loading,
    isComplete,
    totalCards,
    reviewedCount,
    totalNewCards,
    newCardsAvailableToday,
    newCardsPerDay,
    dueCards,
    currentIndex,
    getIntervalPreviews,
    submitReview,
    skipCard,
    removeCard,
    startNewCardsSession,
    RATINGS,
  } = useReviewState(userId);

  const [isFlipped, setIsFlipped] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Reset flip state when card changes
  useEffect(() => {
    setIsFlipped(false);
  }, [currentCard?.id]);

  const flipCard = useCallback((): void => {
    setIsFlipped(true);
  }, []);

  const handleRating = useCallback(
    async (rating: Rating): Promise<void> => {
      if (!isFlipped || submitting) return;

      setSubmitting(true);
      await submitReview(rating);
      setSubmitting(false);
      setIsFlipped(false);
    },
    [isFlipped, submitting, submitReview]
  );

  const handleStartNewCards = useCallback(
    (ignoreLimit = false): void => {
      setIsFlipped(false);
      startNewCardsSession(ignoreLimit);
    },
    [startNewCardsSession]
  );

  // Wrap onDeleteCard to also remove the card from the review queue
  const handleDeleteCard = useCallback(
    async (cardId: string) => {
      if (!onDeleteCard) return { error: 'No delete handler' };
      const result = await onDeleteCard(cardId);
      if (!result.error) {
        // Card was deleted successfully - remove from review queue
        removeCard(cardId);
      }
      return result;
    },
    [onDeleteCard, removeCard]
  );

  // Get interval previews for buttons
  const intervals = getIntervalPreviews();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (submitting) return;

      // Space to reveal
      if (e.code === 'Space' && !isFlipped) {
        e.preventDefault();
        flipCard();
        return;
      }

      // Tab to skip (move to end of deck)
      if (e.code === 'Tab') {
        e.preventDefault();
        skipCard();
        return;
      }

      // Rating shortcuts (only when flipped)
      if (isFlipped) {
        if (e.code === 'Digit1' || e.code === 'Numpad1') {
          e.preventDefault();
          handleRating(RATINGS.AGAIN);
        } else if (e.code === 'Digit2' || e.code === 'Numpad2') {
          e.preventDefault();
          handleRating(RATINGS.HARD);
        } else if (e.code === 'Digit3' || e.code === 'Numpad3') {
          e.preventDefault();
          handleRating(RATINGS.GOOD);
        } else if (e.code === 'Digit4' || e.code === 'Numpad4') {
          e.preventDefault();
          handleRating(RATINGS.EASY);
        }
      }
    };

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [isFlipped, submitting, flipCard, handleRating, skipCard, RATINGS]);

  // User validation
  if (!userId) {
    return (
      <CenteredWrapper>
        <div className="flex flex-col items-center justify-center text-center gap-4">
          <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-2">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-gray-400 dark:text-gray-500"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <h2 className="text-lg font-medium text-gray-800 dark:text-gray-100">
            Sign in required
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Please sign in to review your cards.
          </p>
        </div>
      </CenteredWrapper>
    );
  }

  // Loading state
  if (loading) {
    return (
      <CenteredWrapper>
        <div className="flex flex-col items-center justify-center text-center gap-4">
          <div className="spinner w-8 h-8 border-3 border-gray-200 dark:border-gray-700 border-t-gray-800 dark:border-t-gray-200 rounded-full"></div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Loading cards...</p>
        </div>
      </CenteredWrapper>
    );
  }

  // Empty state - no cards in queue
  if (totalCards === 0) {
    const hasNewCards = newCardsAvailableToday > 0;

    return (
      <CenteredWrapper>
        <div className="flex flex-col items-center justify-center text-center gap-4">
          <div className="w-20 h-20 bg-green-50 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-2">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-green-500 dark:text-green-400"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <h2 className="text-lg font-medium text-gray-800 dark:text-gray-100">No cards due</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">All caught up on reviews!</p>
          {hasNewCards ? (
            <button
              onClick={() => handleStartNewCards(false)}
              className="mt-2 px-7 py-3.5 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-900 dark:hover:bg-white transition-colors"
            >
              Learn {newCardsAvailableToday} new card{newCardsAvailableToday !== 1 ? 's' : ''}
            </button>
          ) : totalNewCards > 0 ? (
            <>
              <p className="text-gray-400 dark:text-gray-500 text-sm">
                You've reached your new cards limit for today.
              </p>
              <button
                onClick={() => handleStartNewCards(true)}
                className="mt-2 px-5 py-2.5 bg-white dark:bg-dark-surface text-gray-600 dark:text-gray-300 text-sm font-medium rounded-lg border border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Learn {Math.min(newCardsPerDay || totalNewCards, totalNewCards)} more anyway
              </button>
            </>
          ) : (
            <p className="text-gray-400 dark:text-gray-500 text-sm">No new cards to learn.</p>
          )}
        </div>
      </CenteredWrapper>
    );
  }

  // Complete state
  if (isComplete) {
    const hasNewCards = newCardsAvailableToday > 0;
    // newCardsAvailableToday already accounts for the daily limit in the hook
    const newCardsToShow = newCardsAvailableToday;

    return (
      <CenteredWrapper>
        <div className="flex flex-col items-center justify-center text-center gap-4">
          <div className="w-20 h-20 bg-green-50 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-2">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-green-500 dark:text-green-400"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <h2 className="text-lg font-medium text-gray-800 dark:text-gray-100">All done!</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            You've reviewed {reviewedCount} card{reviewedCount !== 1 ? 's' : ''}.
          </p>
          {hasNewCards ? (
            <button
              onClick={() => handleStartNewCards(false)}
              className="mt-2 px-7 py-3.5 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-900 dark:hover:bg-white transition-colors"
            >
              Learn {newCardsToShow} new card{newCardsToShow !== 1 ? 's' : ''}
            </button>
          ) : totalNewCards > 0 ? (
            <>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
                You've reached your new cards limit for today.
              </p>
              <button
                onClick={() => handleStartNewCards(true)}
                className="mt-2 px-5 py-2.5 bg-white dark:bg-dark-surface text-gray-600 dark:text-gray-300 text-sm font-medium rounded-lg border border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Learn {Math.min(newCardsPerDay || totalNewCards, totalNewCards)} more anyway
              </button>
            </>
          ) : (
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
              No new cards available.
            </p>
          )}
        </div>
      </CenteredWrapper>
    );
  }

  // Review state
  return (
    <CenteredWrapper>
      <div className="flex flex-col items-center gap-8">
        {/* Progress indicator */}
        <ReviewProgressBar currentIndex={currentIndex} dueCards={dueCards} />

        {currentCard && (
          <ReviewCard
            card={currentCard}
            isFlipped={isFlipped}
            onFlip={flipCard}
            onUpdateCard={onUpdateCard}
            onDeleteCard={handleDeleteCard}
          />
        )}

        {/* Hint */}
        {!isFlipped && (
          <div className="text-gray-500 dark:text-gray-400 text-sm">
            <span>Press </span>
            <kbd className="inline-block px-2 py-1 text-xs bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded shadow-sm dark:text-gray-200">
              Space
            </kbd>
            <span> to reveal answer</span>
          </div>
        )}

        {/* Rating buttons */}
        {isFlipped && intervals && (
          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-2">
              <button
                onClick={() => handleRating(RATINGS.AGAIN)}
                disabled={submitting}
                className="relative flex flex-col items-center px-4 py-2 text-red-500 dark:text-red-400 text-sm font-medium rounded-md border border-red-500/30 dark:border-red-400/30 hover:bg-red-500/10 transition-colors disabled:opacity-50"
              >
                <span className={`transition-opacity ${showShortcuts ? 'opacity-0' : ''}`}>Again</span>
                <span className={`text-xs opacity-60 transition-opacity ${showShortcuts ? '!opacity-0' : ''}`}>{intervals.again}</span>
                <span className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity pointer-events-none ${showShortcuts ? 'opacity-100' : 'opacity-0'}`}><span className="text-[10px] opacity-70">Press</span><span className="text-base font-bold -mt-0.5">1</span></span>
              </button>
              <button
                onClick={() => handleRating(RATINGS.HARD)}
                disabled={submitting}
                className="relative flex flex-col items-center px-4 py-2 text-yellow-500 dark:text-yellow-400 text-sm font-medium rounded-md border border-yellow-500/30 dark:border-yellow-400/30 hover:bg-yellow-500/10 transition-colors disabled:opacity-50"
              >
                <span className={`transition-opacity ${showShortcuts ? 'opacity-0' : ''}`}>Hard</span>
                <span className={`text-xs opacity-60 transition-opacity ${showShortcuts ? '!opacity-0' : ''}`}>{intervals.hard}</span>
                <span className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity pointer-events-none ${showShortcuts ? 'opacity-100' : 'opacity-0'}`}><span className="text-[10px] opacity-70">Press</span><span className="text-base font-bold -mt-0.5">2</span></span>
              </button>
              <button
                onClick={() => handleRating(RATINGS.GOOD)}
                disabled={submitting}
                className="relative flex flex-col items-center px-4 py-2 text-green-500 dark:text-green-400 text-sm font-medium rounded-md border border-green-500/30 dark:border-green-400/30 hover:bg-green-500/10 transition-colors disabled:opacity-50"
              >
                <span className={`transition-opacity ${showShortcuts ? 'opacity-0' : ''}`}>Good</span>
                <span className={`text-xs opacity-60 transition-opacity ${showShortcuts ? '!opacity-0' : ''}`}>{intervals.good}</span>
                <span className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity pointer-events-none ${showShortcuts ? 'opacity-100' : 'opacity-0'}`}><span className="text-[10px] opacity-70">Press</span><span className="text-base font-bold -mt-0.5">3</span></span>
              </button>
              <button
                onClick={() => handleRating(RATINGS.EASY)}
                disabled={submitting}
                className="relative flex flex-col items-center px-4 py-2 text-blue-500 dark:text-blue-400 text-sm font-medium rounded-md border border-blue-500/30 dark:border-blue-400/30 hover:bg-blue-500/10 transition-colors disabled:opacity-50"
              >
                <span className={`transition-opacity ${showShortcuts ? 'opacity-0' : ''}`}>Easy</span>
                <span className={`text-xs opacity-60 transition-opacity ${showShortcuts ? '!opacity-0' : ''}`}>{intervals.easy}</span>
                <span className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity pointer-events-none ${showShortcuts ? 'opacity-100' : 'opacity-0'}`}><span className="text-[10px] opacity-70">Press</span><span className="text-base font-bold -mt-0.5">4</span></span>
              </button>
            </div>
            {/* Info icon - hover reveals shortcuts on buttons */}
            <button
              type="button"
              className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
              aria-label="Keyboard shortcuts"
              onMouseEnter={() => setShowShortcuts(true)}
              onMouseLeave={() => setShowShortcuts(false)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-4 h-4"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        )}
      </div>
    </CenteredWrapper>
  );
}
