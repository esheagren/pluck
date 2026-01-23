import { useMemo, useState, useRef, useEffect, type JSX } from 'react';
import type { ReviewProgressBarProps } from '../types';

interface SegmentTooltip {
  label: string;
  count: number;
  x: number;
  y: number;
}

export default function ReviewProgressBar({
  currentIndex,
  dueCards,
}: ReviewProgressBarProps): JSX.Element | null {
  const [tooltip, setTooltip] = useState<SegmentTooltip | null>(null);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const fadeTimeoutRef = useRef<number | null>(null);

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

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
      }
    };
  }, []);

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>, label: string, count: number) => {
    // Cancel any pending fade-out
    if (fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = null;
    }

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setTooltip({
      label,
      count,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
    setIsTooltipVisible(true);
  };

  const handleMouseLeave = () => {
    // Start fade-out, then remove tooltip after transition
    setIsTooltipVisible(false);
    fadeTimeoutRef.current = window.setTimeout(() => {
      setTooltip(null);
      fadeTimeoutRef.current = null;
    }, 200); // Match the CSS transition duration
  };

  return (
    <>
      <div className="w-full max-w-[500px] h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden relative">
        {reviewPct > 0 && (
          <div
            className="absolute top-0 bottom-0 left-0 bg-gray-300 dark:bg-gray-600 transition-all duration-300 ease-out cursor-pointer"
            style={{ width: `${reviewPct}%` }}
            onMouseEnter={(e) => handleMouseEnter(e, 'Review', reviewCount)}
            onMouseLeave={handleMouseLeave}
          />
        )}
        {newPct > 0 && (
          <div
            className="absolute top-0 bottom-0 bg-blue-400 dark:bg-blue-500 transition-all duration-300 ease-out cursor-pointer"
            style={{ left: `${reviewEnd}%`, width: `${newPct}%` }}
            onMouseEnter={(e) => handleMouseEnter(e, 'New', newCount)}
            onMouseLeave={handleMouseLeave}
          />
        )}
        {againPct > 0 && (
          <div
            className="absolute top-0 bottom-0 bg-red-400 dark:bg-red-500 transition-all duration-300 ease-out cursor-pointer"
            style={{ left: `${newEnd}%`, width: `${againPct}%` }}
            onMouseEnter={(e) => handleMouseEnter(e, 'Again', againCount)}
            onMouseLeave={handleMouseLeave}
          />
        )}
        {completedPct > 0 && (
          <div
            className="absolute top-0 bottom-0 bg-green-400 dark:bg-green-500 transition-all duration-300 ease-out cursor-pointer"
            style={{ left: `${againEnd}%`, width: `${completedPct}%` }}
            onMouseEnter={(e) => handleMouseEnter(e, 'Done', completedCount)}
            onMouseLeave={handleMouseLeave}
          />
        )}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-2 py-1 text-xs text-white bg-gray-800 dark:bg-gray-200 dark:text-gray-900 rounded shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-full transition-opacity duration-200"
          style={{ left: tooltip.x, top: tooltip.y, opacity: isTooltipVisible ? 1 : 0 }}
        >
          <span className="font-medium">{tooltip.label}:</span> {tooltip.count}
        </div>
      )}
    </>
  );
}
