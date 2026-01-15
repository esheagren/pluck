import { useMemo } from 'react'

export default function ReviewProgressBar({ currentIndex, dueCards }) {
  const segments = useMemo(() => {
    const totalCards = dueCards.length
    if (totalCards === 0) {
      return { completedPct: 0, completedCount: 0, newPct: 0, newCount: 0, reviewPct: 0, reviewCount: 0, againPct: 0, againCount: 0 }
    }

    const completed = currentIndex
    const remainingCards = dueCards.slice(currentIndex)

    // Separate "Again" cards (marked with _againCard) from other remaining cards
    const againCards = remainingCards.filter(card => card._againCard)
    const otherRemaining = remainingCards.filter(card => !card._againCard)
    const remainingNew = otherRemaining.filter(card => card.is_new).length
    const remainingReview = otherRemaining.length - remainingNew

    return {
      completedPct: (completed / totalCards) * 100,
      completedCount: completed,
      reviewPct: (remainingReview / totalCards) * 100,
      reviewCount: remainingReview,
      newPct: (remainingNew / totalCards) * 100,
      newCount: remainingNew,
      againPct: (againCards.length / totalCards) * 100,
      againCount: againCards.length,
    }
  }, [currentIndex, dueCards])

  if (dueCards.length === 0) return null

  const { completedPct, completedCount, reviewPct, reviewCount, newPct, newCount, againPct, againCount } = segments

  // Minimum width threshold for showing numbers (roughly 24px at 500px max width)
  const minPctForLabel = 5

  return (
    <div className="w-full max-w-[500px] h-6 bg-gray-100 rounded-full overflow-hidden flex text-xs font-medium">
      {completedPct > 0 && (
        <div
          className="h-full bg-green-500 transition-all duration-300 ease-out flex items-center justify-center text-white"
          style={{ width: `${completedPct}%` }}
        >
          {completedPct >= minPctForLabel && completedCount}
        </div>
      )}
      {reviewPct > 0 && (
        <div
          className="h-full bg-gray-300 transition-all duration-300 ease-out flex items-center justify-center text-gray-600"
          style={{ width: `${reviewPct}%` }}
        >
          {reviewPct >= minPctForLabel && reviewCount}
        </div>
      )}
      {newPct > 0 && (
        <div
          className="h-full bg-blue-500 transition-all duration-300 ease-out flex items-center justify-center text-white"
          style={{ width: `${newPct}%` }}
        >
          {newPct >= minPctForLabel && newCount}
        </div>
      )}
      {againPct > 0 && (
        <div
          className="h-full bg-red-500 transition-all duration-300 ease-out flex items-center justify-center text-white"
          style={{ width: `${againPct}%` }}
        >
          {againPct >= minPctForLabel && againCount}
        </div>
      )}
    </div>
  )
}
