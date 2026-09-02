// core-engine step 2: write the diary for every card that has none yet, and set the
// snapshot columns so cards/card_review_state equal what the reducer produces.
//
//   npx dotenv -e .env.local -- tsx scripts/backfill-events.ts --dry-run   # build + verify in memory, write nothing
//   npx dotenv -e .env.local -- tsx scripts/backfill-events.ts             # write
//
// Per card: card.ingest at created_at (spec from the flat columns, provenance from
// source_*), one card.review per review_logs row, and — when a card_review_state row
// exists — a final card.reschedule carrying that exact state, so the snapshot matches
// today's row to the digit whatever the historical algorithm did. Idempotent: cards
// that already have an ingest event are skipped.

import { randomUUID } from 'node:crypto';
import { asc, inArray, sql } from 'drizzle-orm';
import {
  captureKey, provenanceFromLegacy, rebuild, specFromLegacy, defaultScheduler, legacyFromSpec,
  type CardEvent, type CardEventBody, type ComponentState, type Rating,
} from '@pluckk/core';
import { getDb, schema } from '../lib/db.js';
import { isoTimestamp } from '../lib/serialize.js';
import { rowToEvent } from '../lib/store.js';

const DRY = process.argv.includes('--dry-run');
const db = getDb();

const cards = await db.select().from(schema.cards).orderBy(asc(schema.cards.createdAt));
const states = await db.select().from(schema.cardReviewState);
const logs = await db.select().from(schema.reviewLogs).orderBy(asc(schema.reviewLogs.reviewedAt));
const ingested = new Set((await db.select({ cardId: schema.cardEvents.cardId }).from(schema.cardEvents).where(sql`type = 'card.ingest'`)).map((r) => r.cardId));

const stateByCard = new Map(states.map((s) => [s.cardId, s]));
const logsByCard = new Map<string, typeof logs>();
for (const l of logs) { const a = logsByCard.get(l.cardId) ?? []; a.push(l); logsByCard.set(l.cardId, a); }

console.log(`cards ${cards.length} · states ${states.length} · logs ${logs.length} · already ingested ${ingested.size}${DRY ? ' · DRY RUN' : ''}`);

type Row = typeof schema.cardEvents.$inferInsert;
const rows: Row[] = [];
const rebuilt = new Map<string, ReturnType<typeof rebuild>>();
const seenCaptureKeys = new Set<string>();
let skipped = 0, withState = 0, withLogs = 0;

for (const c of cards) {
  if (ingested.has(c.id) || !c.userId) { skipped++; continue; }
  const createdAt = isoTimestamp(c.createdAt);
  const spec = specFromLegacy(c);
  const provenance = provenanceFromLegacy(c);
  let key: string | null = null;
  if (provenance && c.sourceSelection) {
    const k = `${c.userId}:${captureKey(c.sourceSelection, provenance.identifier)}`;
    if (!seenCaptureKeys.has(k)) { seenCaptureKeys.add(k); key = k.split(':')[1]; }
  }
  const events: CardEvent[] = [];
  const mk = (at: string, body: CardEventBody): CardEvent =>
    ({ ...body, id: randomUUID(), userId: c.userId!, cardId: c.id, at }) as CardEvent;

  events.push(mk(createdAt, { type: 'card.ingest', spec, provenance, folderId: c.folderId, tags: c.tags ?? [], captureKey: key, imageUrl: c.imageUrl }));
  let lastAt = createdAt;
  for (const l of logsByCard.get(c.id) ?? []) {
    const at = isoTimestamp(l.reviewedAt);
    if (at > lastAt) lastAt = at;
    events.push(mk(at, { type: 'card.review', componentId: 'main', rating: l.rating as Rating, sessionId: null, responseMs: l.responseTimeMs ?? null }));
    withLogs++;
  }
  const s = stateByCard.get(c.id);
  if (s) {
    withState++;
    const state: ComponentState = {
      status: s.status as ComponentState['status'], dueAt: isoTimestamp(s.dueAt), intervalDays: s.intervalDays, easeFactor: s.easeFactor,
      stepIndex: s.stepIndex ?? 0, reviewCount: s.reviewCount, lapseCount: s.lapseCount, streak: s.streak,
      lastReviewedAt: s.lastReviewedAt ? isoTimestamp(s.lastReviewedAt) : null, stability: s.stability ?? null, difficulty: s.difficulty ?? null,
    };
    const candidates = [isoTimestamp(s.updatedAt), s.lastReviewedAt ? isoTimestamp(s.lastReviewedAt) : createdAt, lastAt];
    const at = candidates.sort().at(-1)!;
    events.push(mk(at, { type: 'card.reschedule', componentId: 'main', state }));
  }
  // seq is assigned on insert in array order; ties on `at` resolve by seq, so keep this order.
  for (const e of events) {
    const { id, userId, cardId, at, ...body } = e;
    rows.push({ id, userId, cardId, at, type: body.type, payload: body });
  }
  rebuilt.set(c.id, rebuild(events.map((e, i) => ({ ...e, seq: i })), defaultScheduler));
}

console.log(`events to write ${rows.length} (cards ${rebuilt.size}, review events ${withLogs}, reschedules ${withState}, skipped ${skipped})`);

// In-memory verification: rebuilt snapshot vs today's row, before anything is written.
let mismatches = 0;
for (const c of cards) {
  const card = rebuilt.get(c.id);
  if (!card) continue;
  const s = stateByCard.get(c.id);
  const m = card.components.main;
  const problems: string[] = [];
  if (s) {
    if (m.status !== s.status) problems.push(`status ${m.status}≠${s.status}`);
    if (Math.abs(m.intervalDays - s.intervalDays) > 1e-6) problems.push(`interval ${m.intervalDays}≠${s.intervalDays}`);
    if (Math.abs(m.easeFactor - s.easeFactor) > 1e-6) problems.push(`ease ${m.easeFactor}≠${s.easeFactor}`);
    if (m.dueAt !== isoTimestamp(s.dueAt)) problems.push(`due ${m.dueAt}≠${isoTimestamp(s.dueAt)}`);
    if (m.reviewCount !== s.reviewCount || m.lapseCount !== s.lapseCount || m.streak !== s.streak) problems.push('counts');
  } else if (m.status !== 'new' || m.reviewCount !== 0) problems.push(`no state row but ${m.status}/${m.reviewCount}`);
  const mirror = legacyFromSpec(card.spec);
  if (mirror.question !== c.question || mirror.answer !== c.answer) problems.push('mirror text');
  if (problems.length) { mismatches++; if (mismatches <= 10) console.log(`  ✗ ${c.id}: ${problems.join(', ')}`); }
}
console.log(`in-memory verification: ${mismatches === 0 ? 'all match' : `${mismatches} mismatches`}`);
if (mismatches > 0) process.exit(1);
if (DRY) { console.log('dry run: nothing written'); process.exit(0); }

// Write events in insertion order (seq follows), then snapshots.
for (let i = 0; i < rows.length; i += 300) {
  await db.insert(schema.cardEvents).values(rows.slice(i, i + 300));
  if ((i / 300) % 5 === 0) console.log(`  events ${Math.min(i + 300, rows.length)}/${rows.length}`);
}
const ids = [...rebuilt.keys()];
const seqByCard = new Map<string, number>();
for (let i = 0; i < ids.length; i += 500) {
  const rs = await db.select({ cardId: schema.cardEvents.cardId, seq: sql<number>`max(seq)::int` }).from(schema.cardEvents)
    .where(inArray(schema.cardEvents.cardId, ids.slice(i, i + 500))).groupBy(schema.cardEvents.cardId);
  for (const r of rs) seqByCard.set(r.cardId, r.seq);
}
const stmts: unknown[] = [];
for (const id of ids) {
  const card = rebuilt.get(id)!;
  const mirror = legacyFromSpec(card.spec);
  stmts.push(db.update(schema.cards).set({
    spec: card.spec, provenance: card.provenance, captureKey: card.captureKey, isDeleted: false,
    snapshotSeq: seqByCard.get(id) ?? null, snapshotAlgorithm: defaultScheduler.id,
    question: mirror.question, answer: mirror.answer,
  }).where(sql`id = ${id}`));
}
for (let i = 0; i < stmts.length; i += 100) {
  await (db as unknown as { batch: (s: unknown[]) => Promise<unknown> }).batch(stmts.slice(i, i + 100));
  if ((i / 100) % 10 === 0) console.log(`  snapshots ${Math.min(i + 100, stmts.length)}/${stmts.length}`);
}
// card_review_state rows already hold the right values (the reschedule event carries them); just stamp component_id.
await db.execute(sql`update card_review_state set component_id = 'main' where component_id is null or component_id = ''`);
const total = (await db.select({ n: sql<number>`count(*)::int` }).from(schema.cardEvents))[0].n;
console.log(`done · card_events now ${total} rows`);
// keep the import used so the snapshot rows are consistent with the store's conversion
void rowToEvent;
