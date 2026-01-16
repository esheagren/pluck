// GET /api/profile/:username
// Returns public profile data (no auth required)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../lib/supabase-admin.js';
import type { PublicProfile, PublicCard, ActivityDay } from '../../lib/types.js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { username } = req.query;

  if (!username || typeof username !== 'string') {
    res.status(400).json({ error: 'Username required' });
    return;
  }

  // Get public profile using the database function
  const { data: profiles, error: profileError } = await supabaseAdmin
    .rpc('get_public_profile', { p_username: username });

  if (profileError) {
    console.error('Error fetching profile:', profileError);
    res.status(500).json({ error: 'Failed to fetch profile' });
    return;
  }

  if (!profiles || (profiles as PublicProfile[]).length === 0) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }

  const profile = (profiles as PublicProfile[])[0];

  // Get activity data (last 365 days)
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const dateString = oneYearAgo.toISOString().split('T')[0];

  const { data: activity, error: activityError } = await supabaseAdmin
    .from('user_daily_review_summary')
    .select('review_date, total_reviews')
    .eq('user_id', profile.id)
    .gte('review_date', dateString)
    .order('review_date', { ascending: true });

  if (activityError) {
    console.error('Error fetching activity:', activityError);
  }

  // Get public cards count
  const { count: publicCardsCount, error: countError } = await supabaseAdmin
    .from('cards')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', profile.id)
    .eq('is_public', true);

  if (countError) {
    console.error('Error counting cards:', countError);
  }

  // Get public cards (limited to 20 most recent)
  const { data: publicCards, error: cardsError } = await supabaseAdmin
    .from('cards')
    .select('id, question, answer, style, tags, created_at')
    .eq('user_id', profile.id)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(20);

  if (cardsError) {
    console.error('Error fetching cards:', cardsError);
  }

  const activityData = (activity || []) as ActivityDay[];
  const cardsData = (publicCards || []) as PublicCard[];

  // Calculate some summary stats from activity
  const totalReviews = activityData.reduce((sum, day) => sum + (day.total_reviews || 0), 0);
  const activeDays = activityData.filter(day => day.total_reviews > 0).length;

  res.status(200).json({
    profile: {
      username: profile.username,
      displayName: profile.display_name,
      bio: profile.bio,
      avatarUrl: profile.avatar_url,
      memberSince: profile.created_at
    },
    stats: {
      totalReviews,
      activeDays,
      publicCardsCount: publicCardsCount || 0
    },
    activity: activityData.map(day => ({
      date: day.review_date,
      count: day.total_reviews
    })),
    publicCards: cardsData.map(card => ({
      id: card.id,
      question: card.question,
      answer: card.answer,
      style: card.style,
      tags: card.tags,
      createdAt: card.created_at
    }))
  });
}
