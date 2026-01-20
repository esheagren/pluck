// Supabase Admin Client (Server-side with service role key)
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import type { UserProfile } from './types.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
}

export const supabaseAdmin: SupabaseClient = createClient(
  supabaseUrl || '',
  supabaseServiceKey || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

/**
 * Get user from JWT token
 */
export async function getUserFromToken(token: string): Promise<User | null> {
  if (!token) return null;

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  return user;
}

/**
 * Get user profile with subscription info
 * Auto-creates profile if it doesn't exist (for users who authenticated but have no profile row)
 */
export async function getUserProfile(userId: string, userEmail?: string): Promise<UserProfile | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    // If user doesn't exist, try to create them
    if (error.code === 'PGRST116') { // Row not found
      console.log('User profile not found, creating new profile for:', userId);

      const { data: newUser, error: createError } = await supabaseAdmin
        .from('users')
        .insert({
          id: userId,
          email: userEmail || null,
          subscription_status: 'free',
          onboarding_completed: false,
          cards_generated_this_month: 0,
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating user profile:', createError);
        return null;
      }

      return newUser as UserProfile;
    }

    console.error('Error fetching user profile:', error);
    return null;
  }

  return data as UserProfile;
}

/**
 * Increment the user's card generation count
 */
export async function incrementCardCount(userId: string, count: number = 1): Promise<void> {
  const { error } = await supabaseAdmin.rpc('increment_card_count', {
    user_id: userId,
    count: count
  });

  if (error) {
    // Fallback to direct update if RPC doesn't exist
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('cards_generated_this_month')
      .eq('id', userId)
      .single();

    if (user) {
      await supabaseAdmin
        .from('users')
        .update({
          cards_generated_this_month: ((user as { cards_generated_this_month?: number }).cards_generated_this_month || 0) + count
        })
        .eq('id', userId);
    }
  }
}
