import { useMemo, type JSX } from 'react';
import type { ReviewProgressBarProps } from '../types';

export default function ReviewProgressBar({
  currentIndex,
  dueCards,
}: ReviewProgressBarProps): JSX.Element | null {
  const segments = useMemo(() => {
    const totalCards = dueCards.length;
    if (totalCards === 0) {
      return { completedPct: 0, completedCount: 0, reviewPct: 0, reviewCount: 0, newPct: 0, newCount: 0, againPct: 0, againCount: 0 };
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
      completedCount: completed,
      reviewPct: (remainingReview / totalCards) * 100,
      reviewCount: remainingReview,
      newPct: (remainingNew / totalCards) * 100,
      newCount: remainingNew,
      againPct: (againCards.length / totalCards) * 100,
      againCount: againCards.length,
    };
  }, [currentIndex, dueCards]);

  if (dueCards.length === 0) return null;

  const { completedPct, completedCount, reviewPct, reviewCount, newPct, newCount, againPct, againCount } = segments;

  // Use absolute positioning for perfect alignment
  // Calculate cumulative positions for each segment
  const reviewEnd = reviewPct;
  const newEnd = reviewEnd + newPct;
  const againEnd = newEnd + againPct;

  return (
    <div className="w-full max-w-[500px] h-1.5 bg-gray-100 rounded-full overflow-hidden relative">
      {reviewPct > 0 && (
        <div
          className="absolute top-0 bottom-0 left-0 bg-gray-300 transition-all duration-300 ease-out"
          style={{ width: `${reviewPct}%` }}
          title={`Review: ${reviewCount}`}
        />
      )}
      {newPct > 0 && (
        <div
          className="absolute top-0 bottom-0 bg-blue-400 transition-all duration-300 ease-out"
          style={{ left: `${reviewEnd}%`, width: `${newPct}%` }}
          title={`New: ${newCount}`}
        />
      )}
      {againPct > 0 && (
        <div
          className="absolute top-0 bottom-0 bg-red-400 transition-all duration-300 ease-out"
          style={{ left: `${newEnd}%`, width: `${againPct}%` }}
          title={`Again: ${againCount}`}
        />
      )}
      {completedPct > 0 && (
        <div
          className="absolute top-0 bottom-0 bg-green-400 transition-all duration-300 ease-out"
          style={{ left: `${againEnd}%`, width: `${completedPct}%` }}
          title={`Done: ${completedCount}`}
        />
      )}
    </div>
  );
}
