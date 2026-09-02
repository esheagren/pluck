// Direct-invocation smoke test against the real DB (no server needed).
//   npm run smoke      (reads DATABASE_URL etc. from .env.local)
// Exercises: 401 without token, token issue + authed reads (cards, folders,
// review queue, activity), create → review → delete, revoke, 404/405 routing.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import v1 from '../api/v1.js';
import me from '../api/user/me.js';
import { eq } from 'drizzle-orm';
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
    check('DELETE card (soft) → 200', m.result().status === 200);
    m = mock('GET', `/api/v1/cards/${created.id}`, { token }); await v1(m.req, m.res);
    check('deleted card is gone from reads → 404', m.result().status === 404);
    // the smoke card and its diary are hard-deleted so the DB stays clean
    await getDb().delete(schema.cards).where(eq(schema.cards.id, created.id));

    // core-engine step 4: a bidirectional card is ONE card with two schedules
    m = mock('POST', '/api/v1/cards', { token, body: { spec: { style: 'qa_bidirectional', forward: { question: 'smoke F?', answer: 'FA' }, reverse: { question: 'smoke R?', answer: 'RA' } } } }); await v1(m.req, m.res);
    const bi = m.result().body as { id: string; spec: { style: string }; question: string };
    check('POST cards (bidirectional spec) → one card', m.result().status === 201 && bi.spec.style === 'qa_bidirectional' && bi.question === 'smoke F?', bi.id);
    const comps = await getDb().select({ c: schema.cardReviewState.componentId }).from(schema.cardReviewState).where(eq(schema.cardReviewState.cardId, bi.id));
    check('two component schedules exist', comps.map((r) => r.c).sort().join(',') === 'forward,reverse', comps.map((r) => r.c));
    m = mock('POST', '/api/v1/review/items', { token, body: { items: [{ card_id: bi.id, component_id: 'reverse' }, { card_id: bi.id, component_id: 'forward' }] } }); await v1(m.req, m.res);
    const items = (m.result().body as { items: Array<{ component_id: string; question: string; component_count: number; previews: { good: string } }> }).items;
    check('review/items renders each component', items.length === 2 && items[0].component_id === 'reverse' && items[0].question === 'smoke R?' && items[0].component_count === 2 && !!items[0].previews.good, items.map((i) => i.question));
    m = mock('POST', '/api/v1/review', { token, body: { card_id: bi.id, component_id: 'reverse', rating: 'easy' } }); await v1(m.req, m.res);
    const rv = m.result().body as { state: { component_id: string; interval_days: number }; previews: { good: string } };
    check('review targets one component', m.result().status === 200 && rv.state.component_id === 'reverse' && rv.state.interval_days === 7, rv.state);
    const fwd = comps.length ? (await getDb().select().from(schema.cardReviewState).where(eq(schema.cardReviewState.cardId, bi.id))).find((r) => r.componentId === 'forward') : null;
    check('the other component is untouched', fwd?.status === 'new' && fwd.reviewCount === 0);

    // core-engine step 6: undo the rating, then delete + undo the delete, then read the diary
    const rvEvent = (m.result().body as { event_id: string }).event_id;
    m = mock('POST', '/api/v1/review/undo', { token, body: { event_id: rvEvent } }); await v1(m.req, m.res);
    const un = m.result().body as { undone: string; item: { review_state: { status: string; review_count: number } | null } };
    check('undo rating → component back to new', m.result().status === 200 && un.undone === 'card.review' && (un.item.review_state?.status ?? 'new') === 'new' && (un.item.review_state?.review_count ?? 0) === 0, un.item.review_state);
    m = mock('DELETE', `/api/v1/cards/${bi.id}`, { token }); await v1(m.req, m.res);
    const delEvent = (m.result().body as { event_id: string }).event_id;
    check('DELETE returns its event id', m.result().status === 200 && !!delEvent);
    m = mock('POST', '/api/v1/review/undo', { token, body: { event_id: delEvent } }); await v1(m.req, m.res);
    m = mock('GET', `/api/v1/cards/${bi.id}`, { token }); await v1(m.req, m.res);
    check('undo delete → card is back', m.result().status === 200);
    m = mock('GET', `/api/v1/cards/${bi.id}/events`, { token }); await v1(m.req, m.res);
    const diary = (m.result().body as { events: Array<{ type: string }> }).events.map((e) => e.type);
    // ingest · review · reschedule (undo) · setDeleted true · setDeleted false (undo)
    check('diary lists every change, newest first', diary[0] === 'card.setDeleted' && diary[diary.length - 1] === 'card.ingest' && diary.length === 5, diary);
    await getDb().delete(schema.cards).where(eq(schema.cards.id, bi.id));
  } finally {
    await revokeToken(token);
  }
  m = mock('GET', '/api/v1/cards', { token }); await v1(m.req, m.res);
  check('revoked token → 401', m.result().status === 401);
}

main().then(() => process.exit(process.exitCode ?? 0), (e) => { console.error(e); process.exit(1); });
