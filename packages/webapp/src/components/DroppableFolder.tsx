import type { JSX } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { DroppableFolderProps } from '../types';

export default function DroppableFolder({
  id,
  children,
  className = '',
  expanded = false,
}: DroppableFolderProps): JSX.Element {
  const { isOver, setNodeRef } = useDroppable({
    id: id,
  });

  // Expanded mode: slightly larger targets during drag
  const expandedClass = expanded
    ? 'px-4 py-3 min-w-[100px] text-center border border-gray-200 dark:border-dark-border'
    : '';

  // Hover feedback
  const hoverClass = isOver
    ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/30 scale-105'
    : expanded
    ? 'hover:border-gray-300 dark:hover:border-gray-600'
    : '';

  return (
    <div
      ref={setNodeRef}
      className={`${className} ${expandedClass} ${hoverClass} transition-all duration-150 rounded-lg`}
    >
      {children}
    </div>
  );
}
