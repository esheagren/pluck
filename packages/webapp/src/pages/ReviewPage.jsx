import { useState, useEffect, useCallback } from 'react'
import ReviewCard from '../components/ReviewCard'

export default function ReviewPage({ cards, loading, onUpdateCard, onDeleteCard }) {
  const [reviewCards, setReviewCards] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [reviewedCount, setReviewedCount] = useState(0)

  // Initialize shuffled cards when cards change
  useEffect(() => {
    if (cards.length > 0) {
      // Shuffle cards
      const shuffled = [...cards].sort(() => Math.random() - 0.5)
      setReviewCards(shuffled)
      setCurrentIndex(0)
      setReviewedCount(0)
      setIsFlipped(false)
    }
  }, [cards])

  const flipCard = useCallback(() => {
    setIsFlipped(true)
  }, [])

  const handleAnswer = useCallback((remembered) => {
    if (!isFlipped) return

    console.log(`Card ${reviewCards[currentIndex]?.id}: ${remembered ? 'remembered' : 'forgot'}`)

    setReviewedCount(prev => prev + 1)
    setCurrentIndex(prev => prev + 1)
    setIsFlipped(false)
  }, [isFlipped, currentIndex, reviewCards])

  const restartReview = useCallback(() => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5)
    setReviewCards(shuffled)
    setCurrentIndex(0)
    setReviewedCount(0)
    setIsFlipped(false)
  }, [cards])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeydown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      if (e.code === 'Space') {
        e.preventDefault()
        if (!isFlipped) {
          flipCard()
        } else {
          handleAnswer(true)
        }
      }

      if (e.code === 'KeyF' && isFlipped) {
        e.preventDefault()
        handleAnswer(false)
      }
    }

    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  }, [isFlipped, flipCard, handleAnswer])

  // Wrapper component for centering content vertically
  const CenteredWrapper = ({ children }) => (
    <div className="min-h-[calc(100vh-120px)] flex items-center justify-center">
      {children}
    </div>
  )

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

  // Empty state
  if (cards.length === 0) {
    return (
      <CenteredWrapper>
        <div className="flex flex-col items-center justify-center text-center gap-4">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-2">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="9" y1="9" x2="15" y2="15"></line>
              <line x1="15" y1="9" x2="9" y2="15"></line>
            </svg>
          </div>
          <h2 className="text-lg font-medium text-gray-800">No cards to review</h2>
          <p className="text-gray-500 text-sm">Use the Pluckk extension to create some flashcards first.</p>
        </div>
      </CenteredWrapper>
    )
  }

  // Complete state
  if (currentIndex >= reviewCards.length) {
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
          <p className="text-gray-500 text-sm">You've reviewed all your cards.</p>
          <button
            onClick={restartReview}
            className="mt-2 px-7 py-3.5 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-900 transition-colors"
          >
            Review Again
          </button>
        </div>
      </CenteredWrapper>
    )
  }

  // Review state
  const currentCard = reviewCards[currentIndex]

  return (
    <CenteredWrapper>
      <div className="flex flex-col items-center gap-8">
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

      {/* Actions */}
      {isFlipped && (
        <div className="flex gap-4">
          <button
            onClick={() => handleAnswer(false)}
            className="flex items-center gap-2.5 px-7 py-3.5 bg-red-50 text-red-500 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors min-w-[140px] justify-center"
          >
            <span>Forgot</span>
            <kbd className="px-1.5 py-0.5 text-xs bg-red-100 rounded">F</kbd>
          </button>
          <button
            onClick={() => handleAnswer(true)}
            className="flex items-center gap-2.5 px-7 py-3.5 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-900 transition-colors min-w-[140px] justify-center"
          >
            <span>Got it</span>
            <kbd className="px-1.5 py-0.5 text-xs bg-white/20 rounded">Space</kbd>
          </button>
        </div>
      )}
      </div>
    </CenteredWrapper>
  )
}
