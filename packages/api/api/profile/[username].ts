// GET /api/profile/:username — public profile (no auth)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { and, desc, eq, sql } from 'drizzle-orm';
import { getDb, schema } from '../../lib/db.js';
import { activityFor } from '../v1.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { username } = req.query;
  if (!username || typeof username !== 'string') { res.status(400).json({ error: 'Username required' }); return; }

  const db = getDb();
  const [profile] = await db.select().from(schema.users)
    .where(and(sql`lower(${schema.users.username}) = ${username.toLowerCase()}`, eq(schema.users.profileIsPublic, true))).limit(1);
  if (!profile) { res.status(404).json({ error: 'Profile not found' }); return; }

  const since = new Date(); since.setFullYear(since.getFullYear() - 1);
  const { reviews } = await activityFor(profile.id, since.toISOString().slice(0, 10));
  const activity = reviews as Array<{ review_date: string; total_reviews: number }>;

  const [{ count: publicCardsCount }] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.cards)
    .where(and(eq(schema.cards.userId, profile.id), eq(schema.cards.isPublic, true)));
  const publicCards = await db.select({
    id: schema.cards.id, question: schema.cards.question, answer: schema.cards.answer,
    style: schema.cards.style, tags: schema.cards.tags, createdAt: schema.cards.createdAt,
  }).from(schema.cards)
    .where(and(eq(schema.cards.userId, profile.id), eq(schema.cards.isPublic, true)))
    .orderBy(desc(schema.cards.createdAt)).limit(20);

  res.status(200).json({
    profile: { username: profile.username, displayName: profile.displayName, bio: profile.bio, avatarUrl: profile.avatarUrl, memberSince: profile.createdAt },
    stats: {
      totalReviews: activity.reduce((s, d) => s + (d.total_reviews || 0), 0),
      activeDays: activity.filter((d) => d.total_reviews > 0).length,
      publicCardsCount,
    },
    activity: activity.map((d) => ({ date: d.review_date, count: d.total_reviews })),
    publicCards,
  });
}
