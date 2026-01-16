/**
 * Type definitions for Supabase module
 */

import type { SupabaseClient, Session, User, AuthChangeEvent } from '@supabase/supabase-js';

/**
 * Database schema types - Supabase generated format
 */
export interface Database {
  public: {
    Tables: {
      cards: {
        Row: {
          id: string;
          user_id: string;
          question: string;
          answer: string;
          source_url: string | null;
          image_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          question: string;
          answer: string;
          source_url?: string | null;
          image_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          question?: string;
          answer?: string;
          source_url?: string | null;
          image_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      feedback: {
        Row: {
          id: string;
          user_id: string;
          feedback_text: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          feedback_text: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          feedback_text?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      decks: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

/** Typed Supabase client */
export type TypedSupabaseClient = SupabaseClient<Database>;

/** Card row from database */
export type CardRow = Database['public']['Tables']['cards']['Row'];

/** Feedback row from database */
export type FeedbackRow = Database['public']['Tables']['feedback']['Row'];

/**
 * Options for creating a Supabase client
 */
export interface SupabaseClientOptions {
  /** Supabase URL (defaults to configured URL) */
  url?: string;
  /** Supabase API key (defaults to configured key) */
  key?: string;
  /** Error handler function */
  onError?: (message: string, error: unknown) => void;
}

/**
 * Options for saving a card
 */
export interface SaveCardOptions {
  /** User ID to associate with card (required) */
  userId: string;
  /** User's access token for auth */
  accessToken?: string;
}

/**
 * Result of saving a card
 */
export interface SaveCardResult {
  success: boolean;
  cardId?: string;
}

/**
 * Options for fetching cards by user
 */
export interface GetCardsByUserOptions {
  /** User's access token for auth */
  accessToken?: string;
  /** Order clause (default: created_at.desc) */
  order?: string;
}

/**
 * Result of an update operation
 */
export interface UpdateResult {
  success: boolean;
}

/**
 * Supabase client interface with card operations
 */
export interface SupabaseCardClient {
  saveCard(
    question: string,
    answer: string,
    sourceUrl: string,
    options?: SaveCardOptions
  ): Promise<SaveCardResult>;

  fetchCards(order?: string): Promise<CardRow[]>;

  getCardsByUser(userId: string, options?: GetCardsByUserOptions): Promise<CardRow[]>;

  updateCardImage(cardId: string, imageUrl: string): Promise<UpdateResult>;

  uploadImage(imageData: string, mimeType: string, cardId: string): Promise<string>;
}

/**
 * Auth state change callback type
 */
export type AuthStateChangeCallback = (event: AuthChangeEvent, session: Session | null) => void;

/**
 * Result of auth operations
 */
export interface AuthResult {
  error: Error | null;
}

/**
 * Result of sign in operations
 */
export interface SignInResult {
  data: { url: string } | null;
  error: Error | null;
}

/**
 * Result of getting session
 */
export interface SessionResult {
  session: Session | null;
  error: Error | null;
}

/**
 * Result of getting user
 */
export interface UserResult {
  user: User | null;
  error: Error | null;
}

/**
 * Result of feedback submission
 */
export interface FeedbackResult {
  success: boolean;
}

// Re-export commonly used types from supabase-js
export type { Session, User, AuthChangeEvent } from '@supabase/supabase-js';
