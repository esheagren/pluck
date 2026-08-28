// GET /api/user/check-username?username=xxx
// Check if username is available (no auth required)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq, sql } from 'drizzle-orm';
import { getDb, schema } from '../../lib/db.js';

export function isValidUsernameFormat(username: string): boolean {
  if (!username || typeof username !== 'string') return false;
  if (username.length < 3 || username.length > 30) return false;
  return /^[a-z][a-z0-9_]*$/.test(username);
}

export async function usernameStatus(normalized: string, excludeUserId?: string): Promise<'reserved' | 'taken' | null> {
  const db = getDb();
  const reserved = await db.select().from(schema.reservedUsernames).where(eq(schema.reservedUsernames.username, normalized)).limit(1);
  if (reserved.length) return 'reserved';
  const existing = await db.select({ id: schema.users.id }).from(schema.users)
    .where(sql`lower(${schema.users.username}) = ${normalized}`).limit(2);
  if (existing.some((u) => u.id !== excludeUserId)) return 'taken';
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { username } = req.query;
  if (!username || typeof username !== 'string') { res.status(400).json({ error: 'Username required' }); return; }
  const normalized = username.toLowerCase().trim();

  if (!isValidUsernameFormat(normalized)) {
    res.status(200).json({ available: false, reason: 'invalid_format',
      message: 'Username must be 3-30 characters, start with a letter, and contain only lowercase letters, numbers, and underscores' });
    return;
  }
  const status = await usernameStatus(normalized);
  if (status === 'reserved') { res.status(200).json({ available: false, reason: 'reserved', message: 'This username is reserved' }); return; }
  if (status === 'taken') { res.status(200).json({ available: false, reason: 'taken', message: 'This username is already taken' }); return; }
  res.status(200).json({ available: true, username: normalized });
}
