// The diary on Neon: append events, rebuild a card from them, and write the
// materialised snapshot (cards row + one card_review_state row per component).
// Everything the API knows about a card's state goes through here (core-engine step 2+).

import { and, asc, eq, inArray, notInArray } from 'drizzle-orm';
import {
  defaultScheduler, legacyFromSpec, rebuild,
  type Card, type CardEvent, type CardEventBody, type ComponentState, type Scheduler,
} from '@pluckk/core';
import { getDb, schema } from './db.js';
import { isoTimestamp } from './serialize.js';

type Db = ReturnType<typeof getDb>;

/** An event as the API creates it: the server assigns id/seq/at unless the caller (backfill) sets them. */
export type NewEvent = CardEventBody & { userId: string; cardId: string; at?: string; id?: string };

export function rowToEvent(r: typeof schema.cardEvents.$inferSelect): CardEvent {
  return { ...(r.payload as CardEventBody), id: r.id, userId: r.userId, cardId: r.cardId, at: isoTimestamp(r.at), seq: r.seq };
}

function eventToRow(e: NewEvent) {
  const { userId, cardId, at, id, ...body } = e;
  return { ...(id ? { id } : {}), userId, cardId, type: body.type, payload: body, ...(at ? { at } : {}) };
}

/** Append events in order; returns them with server-assigned id/seq/at. */
export async function appendEvents(db: Db, events: NewEvent[]): Promise<CardEvent[]> {
  if (events.length === 0) return [];
  const rows = await db.insert(schema.cardEvents).values(events.map(eventToRow)).returning();
  return rows.sort((a, b) => a.seq - b.seq).map(rowToEvent);
}

export async function loadEvents(db: Db, cardId: string): Promise<CardEvent[]> {
  const rows = await db.select().from(schema.cardEvents).where(eq(schema.cardEvents.cardId, cardId)).orderBy(asc(schema.cardEvents.seq));
  return rows.map(rowToEvent);
}

export async function loadEventsForCards(db: Db, cardIds: string[]): Promise<Map<string, CardEvent[]>> {
  const out = new Map<string, CardEvent[]>();
  for (let i = 0; i < cardIds.length; i += 500) {
    const chunk = cardIds.slice(i, i + 500);
    const rows = await db.select().from(schema.cardEvents).where(inArray(schema.cardEvents.cardId, chunk)).orderBy(asc(schema.cardEvents.seq));
    for (const r of rows) {
      const list = out.get(r.cardId) ?? [];
      list.push(rowToEvent(r));
      out.set(r.cardId, list);
    }
  }
  return out;
}

function componentRow(card: Card, componentId: string, s: ComponentState) {
  return {
    cardId: card.id, userId: card.userId, componentId,
    status: s.status, dueAt: s.dueAt, intervalDays: s.intervalDays, easeFactor: s.easeFactor,
    stepIndex: s.stepIndex, reviewCount: s.reviewCount, lapseCount: s.lapseCount, streak: s.streak,
    lastReviewedAt: s.lastReviewedAt, stability: s.stability ?? null, difficulty: s.difficulty ?? null,
  };
}

/** The statements that persist a snapshot. Callers run them (in a batch when possible). */
export function snapshotStatements(db: Db, card: Card, snapshotSeq: number | null, scheduler: Scheduler = defaultScheduler) {
  const mirror = legacyFromSpec(card.spec);
  const cardUpdate = db.update(schema.cards).set({
    spec: card.spec, provenance: card.provenance, folderId: card.folderId, tags: card.tags,
    imageUrl: card.imageUrl, captureKey: card.captureKey, isDeleted: card.isDeleted,
    snapshotSeq, snapshotAlgorithm: scheduler.id,
    // mirror columns (dropped in step 8)
    question: mirror.question, answer: mirror.answer, style: mirror.style ?? null,
    sourceUrl: card.provenance?.url ?? null, sourceTitle: card.provenance?.title ?? null,
  }).where(eq(schema.cards.id, card.id));

  const ids = Object.keys(card.components);
  const upserts = ids.map((componentId) =>
    db.insert(schema.cardReviewState).values(componentRow(card, componentId, card.components[componentId]))
      .onConflictDoUpdate({
        target: [schema.cardReviewState.cardId, schema.cardReviewState.userId, schema.cardReviewState.componentId],
        set: componentRow(card, componentId, card.components[componentId]),
      }));
  const prune = db.delete(schema.cardReviewState).where(and(
    eq(schema.cardReviewState.cardId, card.id), eq(schema.cardReviewState.userId, card.userId),
    ids.length ? notInArray(schema.cardReviewState.componentId, ids) : undefined,
  ));
  return [cardUpdate, ...upserts, prune];
}

/** Rebuild one card from its full diary and persist the snapshot. Returns the card, or null if it has no events. */
export async function refreshSnapshot(db: Db, cardId: string, scheduler: Scheduler = defaultScheduler): Promise<Card | null> {
  const events = await loadEvents(db, cardId);
  const card = rebuild(events, scheduler);
  if (!card) return null;
  const seq = events.reduce((m, e) => Math.max(m, e.seq ?? 0), 0);
  const stmts = snapshotStatements(db, card, seq, scheduler);
  // neon-http runs a batch in one transaction
  await (db as unknown as { batch: (s: unknown[]) => Promise<unknown> }).batch(stmts);
  return card;
}

/** Append events for one card and refresh its snapshot. The unit of every write in the API. */
export async function commit(db: Db, events: NewEvent[], scheduler: Scheduler = defaultScheduler): Promise<{ card: Card | null; events: CardEvent[] }> {
  const stored = await appendEvents(db, events);
  const cardId = events[0]?.cardId;
  const card = cardId ? await refreshSnapshot(db, cardId, scheduler) : null;
  return { card, events: stored };
}
