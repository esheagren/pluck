import type { JSX } from 'react';
import type { FolderBadgeProps } from '../types';

export default function FolderBadge({ folder, className = '' }: FolderBadgeProps): JSX.Element | null {
  if (!folder) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${className}`}
      style={{
        backgroundColor: `${folder.color}20`,
        color: folder.color,
      }}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
      {folder.name}
    </span>
  );
}
