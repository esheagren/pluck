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

  // Expanded mode: larger targets during drag
  const expandedClass = expanded
    ? 'px-6 py-4 min-w-[120px] text-center bg-white border border-gray-200 shadow-sm'
    : '';

  // Hover feedback
  const hoverClass = isOver
    ? 'ring-2 ring-blue-500 bg-blue-50 scale-105'
    : expanded
    ? 'hover:border-gray-300'
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
