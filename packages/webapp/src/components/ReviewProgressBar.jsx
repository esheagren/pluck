import { useMemo } from 'react'

export default function ReviewProgressBar({ currentIndex, dueCards }) {
  const { completedPct, newPct, reviewPct } = useMemo(() => {
    const totalCards = dueCards.length
    if (totalCards === 0) {
      return { completedPct: 0, newPct: 0, reviewPct: 0 }
    }

    const completedCount = currentIndex
    const remainingCards = dueCards.slice(currentIndex)
    const remainingNewCount = remainingCards.filter(card => card.is_new).length
    const remainingReviewCount = remainingCards.length - remainingNewCount

    return {
      completedPct: (completedCount / totalCards) * 100,
      newPct: (remainingNewCount / totalCards) * 100,
      reviewPct: (remainingReviewCount / totalCards) * 100,
    }
  }, [currentIndex, dueCards])

  if (dueCards.length === 0) return null

  return (
    <div className="w-full max-w-[500px] h-2 bg-gray-100 rounded-full overflow-hidden flex">
      <div
        className="h-full bg-green-500 transition-all duration-300 ease-out"
        style={{ width: `${completedPct}%` }}
      />
      <div
        className="h-full bg-gray-300 transition-all duration-300 ease-out"
        style={{ width: `${reviewPct}%` }}
      />
      <div
        className="h-full bg-blue-500 transition-all duration-300 ease-out"
        style={{ width: `${newPct}%` }}
      />
    </div>
  )
}
