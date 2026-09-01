// Mixer smoke test against the real DB with throwaway data.
//   npx dotenv -e .env.local -- tsx scripts/smoke-mixer.ts
// Creates a temp user + folders/cards/states, exercises all three modes and the
// selection rules (quotas, spillover, pause, new-card caps, backlog batching),
// then deletes the temp user (cascades everything).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq } from 'drizzle-orm';
import v1 from '../api/v1.js';
import { issueToken } from '../lib/auth.js';
import { getDb, schema } from '../lib/db.js';

const db = getDb();

function mock(method: string, url: string, opts: { body?: unknown; token?: string } = {}) {
  const path = url.replace(/^\/api\/v1\//, '');
  const req = { method, url, body: opts.body, headers: opts.token ? { authorization: `Bearer ${opts.token}` } : {}, query: { path: path.split('/') } } as unknown as VercelRequest;
  let statusCode = 200; let payload: unknown;
  const res = { status(c: number) { statusCode = c; return res; }, json(p: unknown) { payload = p; return res; }, end() { return res; }, setHeader() { return res; }, headersSent: false } as unknown as VercelResponse;
  return { req, res, result: () => ({ status: statusCode, body: payload as never }) };
}
function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail !== undefined ? '  → ' + JSON.stringify(detail).slice(0, 140) : ''}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  const [user] = await db.insert(schema.users).values({ email: `mixer-smoke-${Date.now()}@test.local` }).returning();
  const token = await issueToken(user.id, 'smoke-mixer');
  try {
    // Folders: A (due-heavy), B (new-only), C (paused)
    const [fa] = await db.insert(schema.folders).values({ userId: user.id, name: 'A', newPerDay: 3 }).returning();
    const [fb] = await db.insert(schema.folders).values({ userId: user.id, name: 'B', newPerDay: 5 }).returning();
    const [fc] = await db.insert(schema.folders).values({ userId: user.id, name: 'C', isPaused: true }).returning();

    const past = new Date(Date.now() - 3 * 864e5).toISOString();
    const mkCards = async (folderId: string, n: number, withDueState: boolean) => {
      const rows = await db.insert(schema.cards).values(
        Array.from({ length: n }, (_, i) => ({ userId: user.id, folderId, question: `q${folderId.slice(0, 4)}-${i}`, answer: 'a' }))
      ).returning({ id: schema.cards.id });
      if (withDueState) {
        await db.insert(schema.cardReviewState).values(rows.map((r) => ({
          cardId: r.id, userId: user.id, status: 'review', dueAt: past, intervalDays: 3, easeFactor: 2.5,
        })));
      }
      return rows.map((r) => r.id);
    };
    await mkCards(fa.id, 20, true);    // 20 due in A
    await mkCards(fa.id, 10, false);   // 10 new in A (cap 3/day)
    await mkCards(fb.id, 15, false);   // 15 new in B (cap 5/day)
    await mkCards(fc.id, 30, true);    // 30 due in C but paused

    // 1. scheduled, explicit mix 50/50, size 10 → A: 5 due; B: capped at 5 new; spillover → A
    let m = mock('POST', '/api/v1/review/session', { token, body: { mode: 'scheduled', size: 10, mix: [{ folder_id: fa.id, pct: 50 }, { folder_id: fb.id, pct: 50 }] } });
    await v1(m.req, m.res);
    let body = m.result().body as { cards: Array<{ folder_id: string }>; meta: { per_folder: Record<string, { dealt: number }> } };
    const aCount = body.cards.filter((c) => c.folder_id === fa.id).length;
    const bCount = body.cards.filter((c) => c.folder_id === fb.id).length;
    check('scheduled 50/50 size 10 deals 10', body.cards.length === 10, { aCount, bCount });
    check('B capped by new_per_day (≤5)', bCount <= 5, bCount);
    check('spillover went to A', aCount === 10 - bCount);
    check('paused folder C excluded', body.cards.every((c) => c.folder_id !== fc.id));

    // 2. saved weights: A=80, B=20
    await db.update(schema.folders).set({ weight: 80 }).where(eq(schema.folders.id, fa.id));
    await db.update(schema.folders).set({ weight: 20 }).where(eq(schema.folders.id, fb.id));
    m = mock('POST', '/api/v1/review/session', { token, body: { mode: 'scheduled', size: 10 } });
    await v1(m.req, m.res);
    body = m.result().body as never;
    const a2 = (body.cards as Array<{ folder_id: string }>).filter((c) => c.folder_id === fa.id).length;
    check('saved weights ~80/20 respected', body.cards.length === 10 && a2 >= 7, { a2 });

    // 3. focus on B: only B cards, new-cap already partially consumed today
    m = mock('POST', '/api/v1/review/session', { token, body: { mode: 'focus', size: 10, folder_id: fb.id } });
    await v1(m.req, m.res);
    body = m.result().body as never;
    check('focus deals only B', (body.cards as Array<{ folder_id: string }>).every((c) => c.folder_id === fb.id), { n: body.cards.length });

    // 4. backlog on A: oldest-first due, batched, remaining reported
    m = mock('POST', '/api/v1/review/session', { token, body: { mode: 'backlog', size: 8, folder_id: fa.id } });
    await v1(m.req, m.res);
    const bl = m.result().body as { cards: Array<{ folder_id: string; due_at: string }>; meta: { backlog_remaining: number; due_total: number } };
    check('backlog batch of 8 from A', bl.cards.length === 8 && bl.cards.every((c) => c.folder_id === fa.id));
    check('backlog reports remaining', bl.meta.backlog_remaining === 20 - 8, bl.meta.backlog_remaining);
    check('backlog only due cards', bl.cards.every((c) => c.due_at !== null));

    // 5. settings roundtrip
    m = mock('PATCH', '/api/v1/review/settings', { token, body: { session_size: 42 } }); await v1(m.req, m.res);
    m = mock('GET', '/api/v1/review/settings', { token }); await v1(m.req, m.res);
    check('settings persisted', (m.result().body as { session_size: number }).session_size === 42, m.result().body);
  } finally {
    await db.delete(schema.users).where(eq(schema.users.id, user.id)); // cascades folders/cards/states/logs/tokens
  }
  const leftover = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, user.id));
  check('temp user cleaned up', leftover.length === 0);
}

main().then(() => process.exit(process.exitCode ?? 0), (e) => { console.error(e); process.exit(1); });
