import { describe, expect, it } from 'vitest';
import type { CardSpec } from './entities.js';
import type { CardEvent, CardEventBody } from './events.js';
import { applyIncremental, rebuild, reduce, ReducerError } from './reducer.js';

const T0 = '2026-09-01T10:00:00.000Z';
const T1 = '2026-09-01T10:05:00.000Z';
const T2 = '2026-09-02T10:00:00.000Z';
const T3 = '2026-09-03T10:00:00.000Z';

const bi: CardSpec = { style: 'qa_bidirectional', forward: { question: 'F?', answer: 'FA' }, reverse: { question: 'R?', answer: 'RA' } };
const qa: CardSpec = { style: 'qa', question: 'Q?', answer: 'A' };

let n = 0;
const ev = (body: CardEventBody & { at: string; cardId?: string }): CardEvent =>
  ({ ...body, id: `e${++n}`, userId: 'u1', cardId: body.cardId ?? 'c1' }) as CardEvent;

const ingest = (spec: CardSpec = bi, at = T0) => ev({ type: 'card.ingest', at, spec, provenance: null, folderId: 'f1', tags: [], captureKey: 'k' });

describe('reduce', () => {
  it('ingest creates a card with one fresh schedule per component', () => {
    const card = reduce(null, ingest());
    expect(Object.keys(card.components)).toEqual(['forward', 'reverse']);
    expect(card.components.forward).toMatchObject({ status: 'new', intervalDays: 0, dueAt: T0 });
    expect(card).toMatchObject({ id: 'c1', folderId: 'f1', isDeleted: false, createdAt: T0 });
  });
  it('anything but ingest on a missing card throws', () => {
    expect(() => reduce(null, ev({ type: 'card.setDeleted', at: T1, isDeleted: true }))).toThrow(ReducerError);
  });
  it('review advances one component and leaves the other alone', () => {
    const card = reduce(reduce(null, ingest()), ev({ type: 'card.review', at: T1, componentId: 'forward', rating: 'good' }));
    expect(card.components.forward).toMatchObject({ status: 'review', intervalDays: 3, reviewCount: 1, lastReviewedAt: T1 });
    expect(card.components.reverse).toMatchObject({ status: 'new', reviewCount: 0 });
  });
  it('a review of a component the spec no longer has is ignored', () => {
    const card = reduce(reduce(null, ingest()), ev({ type: 'card.review', at: T1, componentId: 'p7', rating: 'good' }));
    expect(card.components.p7).toBeUndefined();
  });
  it('reschedule sets a component state verbatim', () => {
    const state = { status: 'review' as const, dueAt: T3, intervalDays: 12, easeFactor: 2.4, stepIndex: 0, reviewCount: 5, lapseCount: 1, streak: 2, lastReviewedAt: T2 };
    const card = reduce(reduce(null, ingest()), ev({ type: 'card.reschedule', at: T2, componentId: 'reverse', state }));
    expect(card.components.reverse).toEqual(state);
  });
  it('editing the spec keeps schedules for components that survive and starts fresh ones', () => {
    let card = reduce(null, ingest());
    card = reduce(card, ev({ type: 'card.review', at: T1, componentId: 'forward', rating: 'good' }));
    const edited: CardSpec = { ...bi, forward: { question: 'F2?', answer: 'FA2' } };
    card = reduce(card, ev({ type: 'card.setSpec', at: T2, spec: edited }));
    expect(card.spec).toEqual(edited);
    expect(card.components.forward.reviewCount).toBe(1);
    card = reduce(card, ev({ type: 'card.setSpec', at: T3, spec: qa }));
    expect(Object.keys(card.components)).toEqual(['main']);
    expect(card.components.main.dueAt).toBe(T3);
  });
  it('re-ingesting an existing card un-deletes it without touching its history', () => {
    let card = reduce(null, ingest());
    card = reduce(card, ev({ type: 'card.review', at: T1, componentId: 'forward', rating: 'easy' }));
    card = reduce(card, ev({ type: 'card.setDeleted', at: T2, isDeleted: true }));
    expect(card.isDeleted).toBe(true);
    card = reduce(card, ingest(qa, T3));
    expect(card.isDeleted).toBe(false);
    expect(card.spec).toEqual(bi);
    expect(card.components.forward.intervalDays).toBe(7);
  });
  it('folder, tags, image and provenance setters', () => {
    let card = reduce(null, ingest());
    card = reduce(card, ev({ type: 'card.setFolder', at: T1, folderId: null }));
    card = reduce(card, ev({ type: 'card.setTags', at: T1, tags: ['art'] }));
    card = reduce(card, ev({ type: 'card.setImage', at: T1, imageUrl: 'https://img' }));
    card = reduce(card, ev({ type: 'card.setProvenance', at: T1, provenance: { identifier: 'https://p' } }));
    expect(card).toMatchObject({ folderId: null, tags: ['art'], imageUrl: 'https://img', provenance: { identifier: 'https://p' } });
  });
});

describe('rebuild and incremental application agree', () => {
  const events: CardEvent[] = [
    ingest(),
    ev({ type: 'card.review', at: T1, componentId: 'forward', rating: 'good' }),
    ev({ type: 'card.setFolder', at: T2, folderId: 'f2' }),
    ev({ type: 'card.review', at: T3, componentId: 'reverse', rating: 'again' }),
  ];
  it('rebuild sorts events by time before applying', () => {
    const shuffled = [events[3], events[1], events[0], events[2]];
    expect(rebuild(shuffled)).toEqual(events.reduce<ReturnType<typeof rebuild>>((c, e) => reduce(c, e), null));
  });
  it('applyIncremental extends a snapshot, and refuses when an event predates it', () => {
    const snapshot = rebuild(events.slice(0, 2))!;
    expect(applyIncremental(snapshot, T1, events.slice(2))).toEqual(rebuild(events));
    expect(applyIncremental(snapshot, T2, [events[1]])).toBeNull();
  });
  it('rebuild of nothing is null', () => {
    expect(rebuild([])).toBeNull();
  });
});
