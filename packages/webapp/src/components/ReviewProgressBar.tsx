import { useMemo, type JSX } from 'react';
import type { ReviewProgressBarProps } from '../types';

export default function ReviewProgressBar({
  currentIndex,
  dueCards,
}: ReviewProgressBarProps): JSX.Element | null {
  const segments = useMemo(() => {
    const totalCards = dueCards.length;
    if (totalCards === 0) {
      return { completedPct: 0, reviewPct: 0, newPct: 0, againPct: 0 };
    }

    const completed = currentIndex;
    const remainingCards = dueCards.slice(currentIndex);

    // Separate "Again" cards (marked with _againCard) from other remaining cards
    const againCards = remainingCards.filter((card) => card._againCard);
    const otherRemaining = remainingCards.filter((card) => !card._againCard);
    const remainingNew = otherRemaining.filter((card) => card.is_new).length;
    const remainingReview = otherRemaining.length - remainingNew;

    return {
      completedPct: (completed / totalCards) * 100,
      reviewPct: (remainingReview / totalCards) * 100,
      newPct: (remainingNew / totalCards) * 100,
      againPct: (againCards.length / totalCards) * 100,
    };
  }, [currentIndex, dueCards]);

  if (dueCards.length === 0) return null;

  const { completedPct, reviewPct, newPct, againPct } = segments;

  // Order: Gray (review) -> Blue (new) -> Red (again) -> Green (completed)
  return (
    <div className="w-full max-w-[500px] h-1.5 bg-gray-100 rounded-full overflow-hidden flex">
      {reviewPct > 0 && (
        <div
          className="h-full bg-gray-300 transition-all duration-300 ease-out"
          style={{ width: `${reviewPct}%` }}
        />
      )}
      {newPct > 0 && (
        <div
          className="h-full bg-blue-400 transition-all duration-300 ease-out"
          style={{ width: `${newPct}%` }}
        />
      )}
      {againPct > 0 && (
        <div
          className="h-full bg-red-400 transition-all duration-300 ease-out"
          style={{ width: `${againPct}%` }}
        />
      )}
      {completedPct > 0 && (
        <div
          className="h-full bg-green-400 transition-all duration-300 ease-out"
          style={{ width: `${completedPct}%` }}
        />
      )}
    </div>
  );
}
