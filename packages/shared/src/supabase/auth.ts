// Supabase Auth Client for web applications
// Uses @supabase/supabase-js for full auth support

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from '../constants/api';
import type {
  Database,
  TypedSupabaseClient,
  AuthStateChangeCallback,
  SessionResult,
  UserResult,
  SignInResult,
  AuthResult,
} from './types';

// Create a singleton Supabase client
let supabaseClient: TypedSupabaseClient | null = null;

/**
 * Get or create the Supabase client
 */
export function getSupabaseClient(): TypedSupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient<Database>(SUPABASE_URL, SUPABASE_KEY);
  }
  return supabaseClient;
}

/**
 * Sign in with Google OAuth
 * Redirects to Google, then back to the current page
 */
export async function signInWithGoogle(): Promise<SignInResult> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  });
  return { data: data as { url: string } | null, error: error as Error | null };
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<AuthResult> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signOut();
  return { error: error as Error | null };
}

/**
 * Get the current session
 */
export async function getSession(): Promise<SessionResult> {
  const supabase = getSupabaseClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  return { session, error: error as Error | null };
}

/**
 * Get the current user
 */
export async function getUser(): Promise<UserResult> {
  const supabase = getSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error: error as Error | null };
}

/**
 * Listen for auth state changes
 * @param callback - Called with (event, session) on auth changes
 * @returns Unsubscribe function
 */
export function onAuthStateChange(callback: AuthStateChangeCallback): () => void {
  const supabase = getSupabaseClient();
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
  return () => subscription.unsubscribe();
}

/**
 * Get the access token for API calls
 */
export async function getAccessToken(): Promise<string | null> {
  const { session } = await getSession();
  return session?.access_token || null;
}
