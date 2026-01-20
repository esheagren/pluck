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

// Technicality preference (1-4 scale)
// 1 = Intuitive (impressions, analogies)
// 2 = Conceptual (mechanisms, relationships)
// 3 = Detailed (specifics, numbers)
// 4 = Mathematical (formulas, precise values)
export type TechnicalityLevel = 1 | 2 | 3 | 4;

// Breadth preference (1-4 scale)
// 1 = Focused (exactly what was highlighted)
// 2 = Contextual (immediate context)
// 3 = Connected (related concepts)
// 4 = Exploratory (broader implications)
export type BreadthLevel = 1 | 2 | 3 | 4;

// Spaced repetition experience
export type SpacedRepExperience = 'none' | 'tried' | 'regular' | 'power_user';

export interface LearningProfile {
  onboardingCompleted: boolean;
  // Primary category
  primaryCategory: PrimaryCategory | null;
  // Student-specific
  studentLevel: StudentLevel | null;
  studentField: string | null; // For college, graduate, or other students
  // Worker-specific
  workFields: WorkField[]; // Multiple selection allowed
  workFieldOther: string | null; // If 'other' is selected
  workYearsExperience: YearsExperience | null;
  // Researcher-specific
  researchField: string | null;
  researchYearsExperience: YearsExperience | null;
  // Additional interests
  additionalInterests: string[];
  additionalInterestsOther: string | null;
  // Learning preferences
  spacedRepExperience: SpacedRepExperience | null;
  technicalityPreference: TechnicalityLevel | null;
  breadthPreference: BreadthLevel | null;
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

export const SPACED_REP_EXPERIENCE: { value: SpacedRepExperience; label: string; description: string }[] = [
  { value: 'none', label: 'New to this', description: "I haven't used spaced repetition before" },
  { value: 'tried', label: 'Tried it', description: "I've experimented with Anki, Mochi, or similar" },
  { value: 'regular', label: 'Regular user', description: 'I use spaced repetition regularly' },
  { value: 'power_user', label: 'Power user', description: 'I optimize my card writing and review habits' },
];

// Technicality level examples (fallback examples for when API fails)
export const TECHNICALITY_EXAMPLES: { level: TechnicalityLevel; label: string; example: string }[] = [
  { level: 1, label: 'Intuitive', example: "ATP is like a rechargeable battery that gives your cells energy to do work" },
  { level: 2, label: 'Conceptual', example: "ATP (adenosine triphosphate) stores energy in its phosphate bonds. When the third phosphate is removed, energy is released to power cellular processes like muscle contraction" },
  { level: 3, label: 'Detailed', example: "ATP hydrolysis (ATP → ADP + Pi) releases ~30.5 kJ/mol under cellular conditions. This exergonic reaction is coupled to endergonic processes via enzymes like ATPases and kinases" },
  { level: 4, label: 'Technical', example: "ATP hydrolysis has ΔG°' = -30.5 kJ/mol, but actual cellular ΔG ranges from -50 to -65 kJ/mol due to mass action ratios. The γ-phosphate's high transfer potential derives from electrostatic repulsion, resonance stabilization of products, and solvation effects" },
];

// ATP examples for breadth levels
export const BREADTH_EXAMPLES: { level: BreadthLevel; label: string; questions: string[] }[] = [
  { level: 1, label: 'Focused', questions: ['What is ATP?'] },
  { level: 2, label: 'Contextual', questions: ['What is ATP?', 'What does ATP stand for?'] },
  { level: 3, label: 'Connected', questions: ['What is ATP?', 'Where is ATP produced?', 'What is ATP used for?'] },
  { level: 4, label: 'Exploratory', questions: ['What is ATP?', 'How does ATP relate to exercise?', 'Why did evolution favor ATP as energy currency?', 'What happens when ATP is depleted?'] },
];

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
