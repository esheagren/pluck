// Supabase barrel export

export { createSupabaseClient } from './client';
export {
  getSupabaseClient,
  signInWithGoogle,
  signOut,
  getSession,
  getUser,
  onAuthStateChange,
  getAccessToken
} from './auth';
export { submitFeedback } from './feedback';

// Type exports
export type {
  Database,
  TypedSupabaseClient,
  CardRow,
  FeedbackRow,
  SupabaseClientOptions,
  SaveCardOptions,
  SaveCardResult,
  GetCardsByUserOptions,
  UpdateResult,
  SupabaseCardClient,
  AuthStateChangeCallback,
  AuthResult,
  SignInResult,
  SessionResult,
  UserResult,
  FeedbackResult,
  Session,
  User,
  AuthChangeEvent,
} from './types';
