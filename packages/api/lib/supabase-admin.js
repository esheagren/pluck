// Supabase Admin Client (Server-side with service role key)
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Get user from JWT token
 */
export async function getUserFromToken(token) {
  if (!token) return null;

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  return user;
}

/**
 * Get user profile with subscription info
 */
export async function getUserProfile(userId) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }

  return data;
}

/**
 * Increment the user's card generation count
 */
export async function incrementCardCount(userId, count = 1) {
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
          cards_generated_this_month: (user.cards_generated_this_month || 0) + count
        })
        .eq('id', userId);
    }
  }
}
