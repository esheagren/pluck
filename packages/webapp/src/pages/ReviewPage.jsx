import { useState, useEffect, useCallback } from 'react'
import ReviewCard from '../components/ReviewCard'
import { useReviewState } from '../hooks/useReviewState'

export default function ReviewPage({ userId, onUpdateCard, onDeleteCard }) {
  const {
    currentCard,
    loading,
    isComplete,
    totalCards,
    reviewedCount,
    totalNewCards,
    newCardsAvailableToday,
    getIntervalPreviews,
    submitReview,
    startNewCardsSession,
    RATINGS,
  } = useReviewState(userId)

  const [isFlipped, setIsFlipped] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Reset flip state when card changes
  useEffect(() => {
    setIsFlipped(false)
  }, [currentCard?.id])

  const flipCard = useCallback(() => {
    setIsFlipped(true)
  }, [])

  const handleRating = useCallback(async (rating) => {
    if (!isFlipped || submitting) return

    setSubmitting(true)
    await submitReview(rating)
    setSubmitting(false)
    setIsFlipped(false)
  }, [isFlipped, submitting, submitReview])

  const handleStartNewCards = useCallback((ignoreLimit = false) => {
    setIsFlipped(false)
    startNewCardsSession(ignoreLimit)
  }, [startNewCardsSession])

  // Get interval previews for buttons
  const intervals = getIntervalPreviews()

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeydown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (submitting) return

      // Space to reveal
      if (e.code === 'Space' && !isFlipped) {
        e.preventDefault()
        flipCard()
        return
      }

      // Rating shortcuts (only when flipped)
      if (isFlipped) {
        if (e.code === 'Digit1' || e.code === 'Numpad1') {
          e.preventDefault()
          handleRating(RATINGS.AGAIN)
        } else if (e.code === 'Digit2' || e.code === 'Numpad2') {
          e.preventDefault()
          handleRating(RATINGS.HARD)
        } else if (e.code === 'Digit3' || e.code === 'Numpad3') {
          e.preventDefault()
          handleRating(RATINGS.GOOD)
        } else if (e.code === 'Digit4' || e.code === 'Numpad4') {
          e.preventDefault()
          handleRating(RATINGS.EASY)
        }
      }
    }

    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  }, [isFlipped, submitting, flipCard, handleRating, RATINGS])

  // Wrapper component for centering content vertically
  const CenteredWrapper = ({ children }) => (
    <div className="min-h-[calc(100vh-120px)] flex items-center justify-center">
      {children}
    </div>
  )

  // User validation
  if (!userId) {
    return (
      <CenteredWrapper>
        <div className="flex flex-col items-center justify-center text-center gap-4">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-2">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <h2 className="text-lg font-medium text-gray-800">Sign in required</h2>
          <p className="text-gray-500 text-sm">Please sign in to review your cards.</p>
        </div>
      </CenteredWrapper>
    )
  }

  // Loading state
  if (loading) {
    return (
      <CenteredWrapper>
        <div className="flex flex-col items-center justify-center text-center gap-4">
          <div className="spinner w-8 h-8 border-3 border-gray-200 border-t-gray-800 rounded-full"></div>
          <p className="text-gray-500 text-sm">Loading cards...</p>
        </div>
      </CenteredWrapper>
    )
  }

  // Empty state - no cards in queue
  if (totalCards === 0) {
    const hasNewCards = newCardsAvailableToday > 0

    return (
      <CenteredWrapper>
        <div className="flex flex-col items-center justify-center text-center gap-4">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-2">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-green-500">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <h2 className="text-lg font-medium text-gray-800">No cards due</h2>
          <p className="text-gray-500 text-sm">All caught up on reviews!</p>
          {hasNewCards ? (
            <button
              onClick={() => handleStartNewCards(false)}
              className="mt-2 px-7 py-3.5 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-900 transition-colors"
            >
              Learn {newCardsAvailableToday} new card{newCardsAvailableToday !== 1 ? 's' : ''}
            </button>
          ) : totalNewCards > 0 ? (
            <>
              <p className="text-gray-400 text-sm">You've reached your new cards limit for today.</p>
              <button
                onClick={() => handleStartNewCards(true)}
                className="mt-2 px-5 py-2.5 bg-white text-gray-600 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Learn {totalNewCards} more anyway
              </button>
            </>
          ) : (
            <p className="text-gray-400 text-sm">No new cards to learn.</p>
          )}
        </div>
      </CenteredWrapper>
    )
  }

  // Complete state
  if (isComplete) {
    const hasNewCards = newCardsAvailableToday > 0
    // newCardsAvailableToday already accounts for the daily limit in the hook
    const newCardsToShow = newCardsAvailableToday

    return (
      <CenteredWrapper>
        <div className="flex flex-col items-center justify-center text-center gap-4">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-2">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-green-500">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <h2 className="text-lg font-medium text-gray-800">All done!</h2>
          <p className="text-gray-500 text-sm">You've reviewed {reviewedCount} card{reviewedCount !== 1 ? 's' : ''}.</p>
          {hasNewCards ? (
            <button
              onClick={() => handleStartNewCards(false)}
              className="mt-2 px-7 py-3.5 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-900 transition-colors"
            >
              Learn {newCardsToShow} new card{newCardsToShow !== 1 ? 's' : ''}
            </button>
          ) : totalNewCards > 0 ? (
            <>
              <p className="text-gray-400 text-sm mt-2">You've reached your new cards limit for today.</p>
              <button
                onClick={() => handleStartNewCards(true)}
                className="mt-2 px-5 py-2.5 bg-white text-gray-600 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Learn {totalNewCards} more anyway
              </button>
            </>
          ) : (
            <p className="text-gray-400 text-sm mt-2">No new cards available.</p>
          )}
        </div>
      </CenteredWrapper>
    )
  }

  // Review state
  return (
    <CenteredWrapper>
      <div className="flex flex-col items-center gap-8">
        {/* Progress indicator */}
        <div className="text-sm text-gray-400">
          {reviewedCount + 1} / {totalCards}
        </div>

        <ReviewCard
          card={currentCard}
          isFlipped={isFlipped}
          onFlip={flipCard}
          onUpdateCard={onUpdateCard}
          onDeleteCard={onDeleteCard}
        />

        {/* Hint */}
        {!isFlipped && (
          <div className="text-gray-500 text-sm">
            <span>Press </span>
            <kbd className="inline-block px-2 py-1 text-xs bg-white border border-gray-200 rounded shadow-sm">Space</kbd>
            <span> to reveal answer</span>
          </div>
        )}

        {/* Rating buttons */}
        {isFlipped && intervals && (
          <div className="flex gap-3">
            <button
              onClick={() => handleRating(RATINGS.AGAIN)}
              disabled={submitting}
              className="flex flex-col items-center px-5 py-3 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors min-w-[90px] disabled:opacity-50"
            >
              <span className="flex items-center gap-1.5">
                Again
                <kbd className="px-1.5 py-0.5 text-xs bg-red-100 rounded">1</kbd>
              </span>
              <span className="text-xs text-red-400 mt-1">{intervals.again}</span>
            </button>
            <button
              onClick={() => handleRating(RATINGS.HARD)}
              disabled={submitting}
              className="flex flex-col items-center px-5 py-3 bg-orange-50 text-orange-600 text-sm font-medium rounded-lg hover:bg-orange-100 transition-colors min-w-[90px] disabled:opacity-50"
            >
              <span className="flex items-center gap-1.5">
                Hard
                <kbd className="px-1.5 py-0.5 text-xs bg-orange-100 rounded">2</kbd>
              </span>
              <span className="text-xs text-orange-400 mt-1">{intervals.hard}</span>
            </button>
            <button
              onClick={() => handleRating(RATINGS.GOOD)}
              disabled={submitting}
              className="flex flex-col items-center px-5 py-3 bg-green-50 text-green-600 text-sm font-medium rounded-lg hover:bg-green-100 transition-colors min-w-[90px] disabled:opacity-50"
            >
              <span className="flex items-center gap-1.5">
                Good
                <kbd className="px-1.5 py-0.5 text-xs bg-green-100 rounded">3</kbd>
              </span>
              <span className="text-xs text-green-400 mt-1">{intervals.good}</span>
            </button>
            <button
              onClick={() => handleRating(RATINGS.EASY)}
              disabled={submitting}
              className="flex flex-col items-center px-5 py-3 bg-blue-50 text-blue-600 text-sm font-medium rounded-lg hover:bg-blue-100 transition-colors min-w-[90px] disabled:opacity-50"
            >
              <span className="flex items-center gap-1.5">
                Easy
                <kbd className="px-1.5 py-0.5 text-xs bg-blue-100 rounded">4</kbd>
              </span>
              <span className="text-xs text-blue-400 mt-1">{intervals.easy}</span>
            </button>
          </div>
        )}
      </div>
    </CenteredWrapper>
  )
}
