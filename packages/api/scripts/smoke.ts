// Direct-invocation smoke test against the real DB (no server needed).
//   npm run smoke      (reads DATABASE_URL etc. from .env.local)
// Exercises: 401 without token, token issue + authed reads (cards, folders,
// review queue, activity), create → review → delete, revoke, 404/405 routing.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import v1 from '../api/v1.js';
import me from '../api/user/me.js';
import { issueToken, revokeToken } from '../lib/auth.js';
import { getDb, schema } from '../lib/db.js';

function mock(method: string, url: string, opts: { body?: unknown; token?: string; query?: Record<string, string> } = {}) {
  const path = url.replace(/^\/api\/v1\//, '');
  const req = {
    method, url, body: opts.body,
    headers: opts.token ? { authorization: `Bearer ${opts.token}` } : {},
    query: { path: path.split('/'), ...(opts.query ?? {}) },
  } as unknown as VercelRequest;
  let statusCode = 200; let payload: unknown = undefined;
  const res = {
    status(c: number) { statusCode = c; return res; },
    json(p: unknown) { payload = p; return res; },
    end() { return res; },
    setHeader() { return res; },
    headersSent: false,
  } as unknown as VercelResponse;
  return { req, res, result: () => ({ status: statusCode, body: payload }) };
}

function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail !== undefined ? '  → ' + JSON.stringify(detail).slice(0, 120) : ''}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  let m = mock('GET', '/api/v1/cards'); await v1(m.req, m.res);
  check('GET cards without token → 401', m.result().status === 401, m.result().body);


  m = mock('GET', '/api/v1/nope'); await v1(m.req, m.res);
  check('unknown v1 route → 404', m.result().status === 404);
  m = mock('DELETE', '/api/v1/cards'); await v1(m.req, m.res);
  check('wrong method → 405', m.result().status === 405);


  // Issue a token for the first imported user and exercise authed routes.
  const [user] = await getDb().select().from(schema.users).limit(1);
  check('an imported user exists', !!user, user?.email);
  const token = await issueToken(user.id, 'smoke');
  try {
    m = mock('GET', '/api/user/me', { token }); await me(m.req, m.res);
    check('GET /api/user/me → 200', m.result().status === 200, (m.result().body as { user: { email: string } }).user);

    m = mock('GET', '/api/v1/cards', { token }); await v1(m.req, m.res);
    const cards = m.result().body as Array<{ id: string; folder: unknown; due_at: unknown }>;
    check('GET cards → array', m.result().status === 200 && Array.isArray(cards), { count: cards.length, sample: cards[0] && { id: cards[0].id, due_at: cards[0].due_at, folder: !!cards[0].folder } });

    m = mock('GET', '/api/v1/folders', { token }); await v1(m.req, m.res);
    check('GET folders → array', m.result().status === 200 && Array.isArray(m.result().body), { count: (m.result().body as unknown[]).length });

    m = mock('GET', '/api/v1/review/queue', { token }); await v1(m.req, m.res);
    const q = m.result().body as { cards: unknown[]; states: unknown[]; new_reviewed_today: unknown[] };
    check('GET review/queue → cards+states', m.result().status === 200 && Array.isArray(q.cards) && Array.isArray(q.states), { cards: q.cards.length, states: q.states.length, newToday: q.new_reviewed_today.length });

    m = mock('GET', '/api/v1/activity', { token }); await v1(m.req, m.res);
    const a = m.result().body as { reviews: unknown[]; cards: unknown[] };
    check('GET activity → aggregates', m.result().status === 200 && Array.isArray(a.reviews), { reviewDays: a.reviews.length, cardDays: a.cards.length });

    m = mock('POST', '/api/v1/cards', { token, body: { question: 'smoke q', answer: 'smoke a', source_url: 'https://example.com/smoke' } }); await v1(m.req, m.res);
    const created = m.result().body as { id: string };
    check('POST cards → 201', m.result().status === 201 && !!created.id, created.id);

    m = mock('POST', '/api/v1/review', { token, body: { card_id: created.id, rating: 'good', new_state: { status: 'learning', due_at: new Date(Date.now() + 86400000).toISOString(), interval_days: 1, ease_factor: 2.5 }, algorithm_version: 'smoke' } }); await v1(m.req, m.res);
    const st = m.result().body as { state: { review_count: number; streak: number } };
    check('POST review → state upserted', m.result().status === 200 && st.state.review_count === 1 && st.state.streak === 1, st.state);

    m = mock('DELETE', `/api/v1/cards/${created.id}`, { token }); await v1(m.req, m.res);
    check('DELETE card (cascades state+log) → 200', m.result().status === 200);
  } finally {
    await revokeToken(token);
  }
  m = mock('GET', '/api/v1/cards', { token }); await v1(m.req, m.res);
  check('revoked token → 401', m.result().status === 401);
}

main().then(() => process.exit(process.exitCode ?? 0), (e) => { console.error(e); process.exit(1); });
