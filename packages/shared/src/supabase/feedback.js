// Feedback submission helper
import { getSupabaseClient, getAccessToken } from './auth.js';

/**
 * Submit user feedback to Supabase
 * @param {string} userId - User ID
 * @param {string} feedbackText - Feedback content
 * @returns {Promise<{success: boolean}>}
 */
export async function submitFeedback(userId, feedbackText) {
  if (!userId) {
    throw new Error('User must be logged in to submit feedback');
  }

  if (!feedbackText || !feedbackText.trim()) {
    throw new Error('Feedback text is required');
  }

  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('feedback')
    .insert({
      user_id: userId,
      feedback_text: feedbackText.trim()
    });

  if (error) {
    throw new Error(`Failed to submit feedback: ${error.message}`);
  }

  return { success: true };
}
