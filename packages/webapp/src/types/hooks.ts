/**
 * Type definitions for custom React hooks
 */

import type { User } from '@pluckk/shared/supabase';
import type {
  CardReviewState,
  IntervalPreviews,
  NextReviewResult,
  Rating,
  RatingsMap,
} from '@pluckk/shared/scheduler';

// ============================================================================
// Database Types (matching Supabase schema)
// ============================================================================

/**
 * Folder row from database
 */
export interface Folder {
  id: string;
  user_id: string;
  name: string;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Card row from database with optional folder relation
 */
export interface Card {
  id: string;
  user_id: string;
  question: string;
  answer: string;
  source_url: string | null;
  image_url: string | null;
  folder_id: string | null;
  folder?: Folder | null;
  created_at: string;
  updated_at: string;
}

/**
 * Card with review state (used in review sessions)
 */
export interface CardWithReviewState extends Card {
  review_state: CardReviewState | null;
  is_new: boolean;
  is_due?: boolean;
  _againCard?: boolean;
}

// ============================================================================
// useAuth Types
// ============================================================================

/**
 * Billing information for the user
 */
export interface BillingInfo {
  isPro: boolean;
  cardsUsed: number;
  limit: number;
}

/**
 * Return type for useAuth hook
 */
export interface UseAuthReturn {
  user: User | null;
  loading: boolean;
  billingInfo: BillingInfo | null;
  learningProfile: LearningProfile | null;
  showOnboarding: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  handleUpgrade: () => Promise<void>;
  handleManageSubscription: () => Promise<void>;
  completeOnboarding: (profile: Omit<LearningProfile, 'onboardingCompleted'>) => Promise<void>;
  skipOnboarding: () => Promise<void>;
}

// ============================================================================
// useTheme Types
// ============================================================================

export type Theme = 'light' | 'dark';

/**
 * Return type for useTheme hook
 */
export interface UseThemeReturn {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

// ============================================================================
// useProfile Types
// ============================================================================

/**
 * User profile data
 */
export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_public: boolean;
  created_at: string;
}

/**
 * Learning profile for personalized card generation
 */
export type PrimaryCategory = 'student' | 'worker' | 'researcher';
export type StudentLevel = 'high_school' | 'college' | 'medical_school' | 'law_school' | 'graduate_school' | 'other';
export type WorkField = 'consulting' | 'engineering' | 'product' | 'finance' | 'marketing' | 'design' | 'sales' | 'operations' | 'legal' | 'healthcare' | 'education' | 'other';
export type YearsExperience = '1-2' | '3-5' | '6-10' | '10+';

export interface LearningProfile {
  onboardingCompleted: boolean;
  // Primary category
  primaryCategory: PrimaryCategory | null;
  // Student-specific
  studentLevel: StudentLevel | null;
  studentField: string | null; // For college, graduate, or other students
  // Worker-specific
  workField: WorkField | null;
  workFieldOther: string | null; // If workField is 'other'
  workYearsExperience: YearsExperience | null;
  // Researcher-specific
  researchField: string | null;
  researchYearsExperience: YearsExperience | null;
  // Additional interests
  additionalInterests: string[];
  additionalInterestsOther: string | null;
}

export const STUDENT_LEVELS: { value: StudentLevel; label: string }[] = [
  { value: 'high_school', label: 'High School' },
  { value: 'college', label: 'College' },
  { value: 'medical_school', label: 'Medical School' },
  { value: 'law_school', label: 'Law School' },
  { value: 'graduate_school', label: 'Graduate School' },
  { value: 'other', label: 'Other' },
];

export const WORK_FIELDS: { value: WorkField; label: string }[] = [
  { value: 'consulting', label: 'Consulting' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'product', label: 'Product' },
  { value: 'finance', label: 'Finance' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'design', label: 'Design' },
  { value: 'sales', label: 'Sales' },
  { value: 'operations', label: 'Operations' },
  { value: 'legal', label: 'Legal' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'education', label: 'Education' },
  { value: 'other', label: 'Other' },
];

export const YEARS_EXPERIENCE: { value: YearsExperience; label: string }[] = [
  { value: '1-2', label: '1-2 years' },
  { value: '3-5', label: '3-5 years' },
  { value: '6-10', label: '6-10 years' },
  { value: '10+', label: '10+ years' },
];

export const ADDITIONAL_INTERESTS = [
  'Science',
  'Math',
  'History',
  'Languages',
  'Arts',
  'Business',
  'Technology',
] as const;

/**
 * Subscription data
 */
export interface Subscription {
  isPro: boolean;
  plan: string | null;
  status: string | null;
}

/**
 * Usage data
 */
export interface Usage {
  cardsThisMonth: number;
  limit: number;
}

/**
 * User settings
 */
export interface Settings {
  newCardsPerDay: number;
  emailNotifications: boolean;
}

/**
 * Profile update payload
 */
export interface ProfileUpdates {
  username?: string;
  display_name?: string;
  bio?: string;
  is_public?: boolean;
  settings?: Partial<Settings>;
}

/**
 * Username check result
 */
export interface UsernameCheckResult {
  available: boolean;
  reason?: 'too_short' | 'taken' | 'invalid' | 'error';
  message?: string;
}

/**
 * Return type for useProfile hook
 */
export interface UseProfileReturn {
  profile: Profile | null;
  subscription: Subscription | null;
  usage: Usage | null;
  settings: Settings | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  updateProfile: (updates: ProfileUpdates) => Promise<{ success?: boolean; error?: string }>;
  checkUsername: (username: string) => Promise<UsernameCheckResult>;
  refetch: () => Promise<void>;
}

// ============================================================================
// useCards Types
// ============================================================================

/**
 * Card updates payload
 */
export interface CardUpdates {
  question?: string;
  answer?: string;
  folder_id?: string | null;
}

/**
 * Operation result with optional error
 */
export interface OperationResult<T = unknown> {
  data?: T;
  error?: Error | unknown;
  success?: boolean;
}

/**
 * Return type for useCards hook
 */
export interface UseCardsReturn {
  cards: Card[];
  loading: boolean;
  refetch: () => Promise<void>;
  getShuffledCards: () => Card[];
  updateCard: (cardId: string, updates: CardUpdates) => Promise<OperationResult<Card>>;
  deleteCard: (cardId: string) => Promise<OperationResult>;
  moveCardToFolder: (cardId: string, folderId: string | null, folder?: Folder | null) => Promise<OperationResult<Card>>;
}

// ============================================================================
// useFolders Types
// ============================================================================

/**
 * Folder updates payload
 */
export interface FolderUpdates {
  name?: string;
  sort_order?: number;
}

/**
 * Return type for useFolders hook
 */
export interface UseFoldersReturn {
  folders: Folder[];
  loading: boolean;
  refetch: () => Promise<void>;
  createFolder: (name: string) => Promise<OperationResult<Folder>>;
  updateFolder: (folderId: string, updates: FolderUpdates) => Promise<OperationResult<Folder>>;
  deleteFolder: (folderId: string) => Promise<OperationResult>;
}

// ============================================================================
// usePublicProfile Types
// ============================================================================

/**
 * Public profile data
 */
export interface PublicProfile {
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
}

/**
 * Profile stats
 */
export interface ProfileStats {
  totalCards: number;
  totalReviews: number;
  currentStreak: number;
  longestStreak: number;
}

/**
 * Activity data point
 */
export interface ActivityDataPoint {
  date: string;
  reviews: number;
  cardsCreated: number;
}

/**
 * Public card (limited info)
 */
export interface PublicCard {
  id: string;
  question: string;
  answer: string;
  created_at: string;
}

/**
 * Profile error
 */
export interface ProfileError {
  status?: number;
  message: string;
}

/**
 * Return type for usePublicProfile hook
 */
export interface UsePublicProfileReturn {
  profile: PublicProfile | null;
  stats: ProfileStats | null;
  activity: ActivityDataPoint[];
  publicCards: PublicCard[];
  loading: boolean;
  error: ProfileError | null;
  refetch: () => Promise<void>;
}

// ============================================================================
// useActivityStats Types
// ============================================================================

/**
 * Activity data map (date string -> activity counts)
 */
export interface ActivityDataMap {
  [date: string]: {
    reviews: number;
    cardsCreated: number;
  };
}

/**
 * Return type for useActivityStats hook
 */
export interface UseActivityStatsReturn {
  activityData: ActivityDataMap;
  loading: boolean;
  error: Error | unknown | null;
  refetch: () => Promise<void>;
}

// ============================================================================
// useReviewState Types
// ============================================================================

/**
 * Saved session data for persistence
 */
export interface SavedSession {
  cardIds: string[];
  currentIndex: number;
  timestamp: number;
}

/**
 * Restored session data
 */
export interface RestoredSession {
  cards: CardWithReviewState[];
  index: number;
}

/**
 * Review submission result
 */
export interface ReviewSubmitResult {
  success?: boolean;
  error?: string | Error | unknown;
  newState?: NextReviewResult;
}

/**
 * Return type for useReviewState hook
 */
export interface UseReviewStateReturn {
  dueCards: CardWithReviewState[];
  currentCard: CardWithReviewState | null;
  currentIndex: number;
  loading: boolean;
  isComplete: boolean;
  totalCards: number;
  reviewedCount: number;
  totalNewCards: number;
  newCardsAvailableToday: number;
  newCardsPerDay: number;
  getIntervalPreviews: () => IntervalPreviews | null;
  submitReview: (rating: Rating) => Promise<ReviewSubmitResult>;
  skipCard: () => void;
  restart: () => void;
  startNewCardsSession: (ignoreLimit?: boolean) => Promise<void>;
  refetch: (forceRefresh?: boolean) => Promise<void>;
  RATINGS: RatingsMap;
}

// ============================================================================
// Page Props Types
// ============================================================================

/**
 * Props for ReviewPage
 */
export interface ReviewPageProps {
  userId: string | undefined;
  onUpdateCard?: (cardId: string, updates: CardUpdates) => Promise<OperationResult>;
  onDeleteCard?: (cardId: string) => Promise<OperationResult>;
}

/**
 * Props for LandingPage
 */
export interface LandingPageProps {
  onSignIn: () => void;
}

/**
 * Props for CardsPage
 */
export interface CardsPageProps {
  cards: Card[];
  loading: boolean;
  onUpdateCard?: (cardId: string, updates: CardUpdates) => Promise<OperationResult<Card>>;
  onDeleteCard?: (cardId: string) => Promise<OperationResult>;
  onMoveCardToFolder?: (cardId: string, folderId: string | null) => Promise<OperationResult<Card>>;
  folders: Folder[];
  foldersLoading: boolean;
  onCreateFolder: (name: string) => Promise<OperationResult<Folder>>;
  onUpdateFolder: (folderId: string, updates: FolderUpdates) => Promise<OperationResult<Folder>>;
  onDeleteFolder: (folderId: string) => Promise<OperationResult>;
}

/**
 * Props for SettingsPage
 */
export interface SettingsPageProps {
  user: User | null;
  billingInfo: BillingInfo | null;
  onSignOut: () => void;
  onUpgrade: () => void;
  onManage: () => void;
}

/**
 * Props for ProfilePage
 */
export interface ProfilePageProps {
  user: User | null;
}

/**
 * Mochi deck from API
 */
export interface MochiDeck {
  id: string;
  name: string;
}

/**
 * Status message
 */
export interface StatusMessage {
  type: 'success' | 'error' | '';
  message: string;
}
