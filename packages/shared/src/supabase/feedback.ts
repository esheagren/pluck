// Feedback submission helper
import { getSupabaseClient } from './auth';
import type { FeedbackResult } from './types';

/**
 * Submit user feedback to Supabase
 * @param userId - User ID
 * @param feedbackText - Feedback content
 * @returns Promise with success status
 */
export async function submitFeedback(
  userId: string,
  feedbackText: string
): Promise<FeedbackResult> {
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
