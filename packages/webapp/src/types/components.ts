/**
 * Type definitions for React component props
 */

import type { Card, CardWithReviewState, Folder, ActivityDataMap, UsernameCheckResult, OperationResult } from './hooks';

// ============================================================================
// Activity Grid
// ============================================================================

export type ActivityMetric = 'reviews' | 'cardsCreated';

export interface ActivityGridProps {
  activityData?: ActivityDataMap;
  metric?: ActivityMetric;
  showLegend?: boolean;
  startDate?: Date | string;
}

export interface GridCell {
  date: string;
  count: number;
  isFuture: boolean;
}

export interface MonthLabel {
  month: string;
  weekIndex: number;
}

export interface Tooltip {
  date: string;
  count: number;
  x: number;
  y: number;
}

// ============================================================================
// Review Components
// ============================================================================

export interface ReviewCardProps {
  card: CardWithReviewState;
  isFlipped: boolean;
  onFlip: () => void;
  onUpdateCard?: (cardId: string, updates: { question?: string; answer?: string }) => Promise<OperationResult>;
  onDeleteCard?: (cardId: string) => Promise<OperationResult>;
}

export interface ReviewProgressBarProps {
  currentIndex: number;
  dueCards: CardWithReviewState[];
}

// ============================================================================
// Card Components
// ============================================================================

export interface CardGridProps {
  cards: Card[];
  onCardClick?: (card: Card) => void;
  showFolderBadge?: boolean;
  selectedCardIds?: Set<string>;
  onToggleSelect?: (cardId: string) => void;
  activeId?: string | null;
}

export interface DraggableCardProps {
  id: string;
  children: React.ReactNode;
  isSelected?: boolean;
  isBeingDraggedAway?: boolean;
}

export interface PublicCardsGridProps {
  cards?: PublicCardDisplay[];
  loading?: boolean;
}

export interface PublicCardDisplay {
  id: string;
  question: string;
  answer: string;
  style?: string;
  tags?: string[];
  createdAt: string;
}

// ============================================================================
// Folder Components
// ============================================================================

export interface FolderWithColor extends Folder {
  color?: string;
}

export interface FolderListProps {
  folders: FolderWithColor[];
  cards: Card[];
  selectedFolderId: string | null;
  onSelectFolder: (id: string) => void;
  onDeleteFolder: (folderId: string) => Promise<OperationResult>;
  onRenameFolder: (folderId: string, updates: { name: string }) => Promise<OperationResult<Folder>>;
  orderedItems?: string[];
  onReorder?: (items: string[]) => void;
  isDraggingCard?: boolean;
}

export interface DroppableFolderProps {
  id: string;
  children: React.ReactNode;
  className?: string;
  expanded?: boolean;
}

export interface FolderBadgeProps {
  folder: FolderWithColor | null;
  className?: string;
}

export interface CreateFolderButtonProps {
  onCreateFolder: (name: string) => Promise<OperationResult<Folder>>;
}

// ============================================================================
// User Components
// ============================================================================

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

export interface UserAvatarProps {
  avatarUrl?: string | null;
  displayName?: string | null;
  username?: string | null;
  email?: string | null;
  size?: AvatarSize;
}

export interface ProfileHeaderProps {
  profile: ProfileDisplayData | null;
  isEditable?: boolean;
  onEditClick?: () => void;
  size?: AvatarSize;
}

export interface ProfileDisplayData {
  username?: string | null;
  displayName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  email?: string | null;
  memberSince?: string | null;
  createdAt?: string | null;
}

export interface UsernameInputProps {
  value?: string;
  onChange?: (value: string) => void;
  onCheckAvailability?: (username: string) => Promise<UsernameCheckResult>;
  currentUsername?: string | null;
  disabled?: boolean;
}

export interface UsernameAvailability {
  available: boolean;
  reason?: 'current' | 'too_short' | 'too_long' | 'invalid_format' | 'taken' | 'error';
  message?: string;
}

// ============================================================================
// Layout Components
// ============================================================================

// Layout has no props (uses Outlet)
export type LayoutProps = Record<string, never>;

// Sidebar has no props
export type SidebarProps = Record<string, never>;

// MobileNav has no props
export type MobileNavProps = Record<string, never>;

// ============================================================================
// Animation Components
// ============================================================================

export interface SandAnimationProps {
  className?: string;
  filterPosition?: number;
  speed?: number;
  opacity?: number;
  darkMode?: boolean;
}

export interface Particle {
  x: number;
  y: number;
  size: number;
  speed: number;
  color: string;
  opacity: number;
  willPassThrough: boolean;
  stopped: boolean;
  fadeOut: number;
  verticalDrift: number;
}

// ============================================================================
// Modal Components
// ============================================================================

export interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
}

// ============================================================================
// Sortable Components (for @dnd-kit)
// ============================================================================

export interface SortableFolderTabProps {
  id: string;
  children: React.ReactNode;
}
