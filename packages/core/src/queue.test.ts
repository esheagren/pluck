// The mixer rules, as pure tests. Scenario set ported from the old smoke-mixer.ts
// (which needed a live database).
import { describe, expect, it } from 'vitest';
import { onePerCard, selectSession, type CandidateRow, type FolderInfo, type MixerInput } from './queue.js';

const NOW = new Date('2026-09-02T12:00:00.000Z');
const PAST = new Date(NOW.getTime() - 3 * 864e5).toISOString();
const A = 'aaaaaaaa-0000-0000-0000-000000000000';
const B = 'bbbbbbbb-0000-0000-0000-000000000000';
const C = 'cccccccc-0000-0000-0000-000000000000';

function mk(folderId: string, n: number, due: boolean, prefix = folderId.slice(0, 1)): CandidateRow[] {
  return Array.from({ length: n }, (_, i) => ({
    cardId: `${prefix}${i}`, folderId, createdAt: new Date(NOW.getTime() - (n - i) * 1000).toISOString(),
    status: due ? 'review' : null, dueAt: due ? PAST : null,
  }));
}

const folders: FolderInfo[] = [
  { id: A, weight: null, isPaused: false, newPerDay: 3 },
  { id: B, weight: null, isPaused: false, newPerDay: 5 },
  { id: C, weight: null, isPaused: true, newPerDay: null },
];

function input(over: Partial<MixerInput>): MixerInput {
  return {
    mode: 'scheduled', size: 10, folders: folders.map((f) => ({ ...f })),
    candidates: [...mk(A, 20, true, 'ad'), ...mk(A, 10, false, 'an'), ...mk(B, 15, false, 'bn'), ...mk(C, 30, true, 'cd')],
    newReviewedTodayByFolder: new Map(), defaultNewPerDay: 10, now: NOW, noShuffle: true, ...over,
  };
}
const inFolder = (r: ReturnType<typeof selectSession>, f: string, cands: CandidateRow[]) =>
  r.dealt.filter((d) => cands.find((c) => c.cardId === d.cardId)?.folderId === f).length;

describe('scheduled mode', () => {
  it('explicit 50/50 mix: B capped by new/day, spillover goes to A, paused C excluded', () => {
    const inp = input({ mix: [{ folderId: A, pct: 50 }, { folderId: B, pct: 50 }] });
    const r = selectSession(inp);
    const a = inFolder(r, A, inp.candidates), b = inFolder(r, B, inp.candidates), c = inFolder(r, C, inp.candidates);
    expect(r.dealt.length).toBe(10);
    expect(b).toBeLessThanOrEqual(5);
    expect(a).toBe(10 - b);
    expect(c).toBe(0);
    expect(r.meta.mode).toBe('scheduled');
  });
  it('saved weights 80/20 are respected', () => {
    const inp = input({ folders: [{ ...folders[0], weight: 80 }, { ...folders[1], weight: 20 }, folders[2]] });
    const r = selectSession(inp);
    expect(r.dealt.length).toBe(10);
    expect(inFolder(r, A, inp.candidates)).toBeGreaterThanOrEqual(7);
  });
  it('with no weights every non-paused folder shares equally', () => {
    const inp = input({});
    const r = selectSession(inp);
    expect(r.dealt.length).toBe(10);
    expect(inFolder(r, C, inp.candidates)).toBe(0);
  });
  it('the new/day budget is consumed across calls in a day', () => {
    const today = new Map<string | null, number>([[B, 4]]);
    const inp = input({ mix: [{ folderId: B, pct: 100 }], newReviewedTodayByFolder: today });
    const r = selectSession(inp);
    expect(r.dealt.length).toBe(1); // 5 cap − 4 already reviewed
  });
});

describe('focus and backlog', () => {
  it('focus deals only the chosen folder', () => {
    const inp = input({ mode: 'focus', folderId: B });
    const r = selectSession(inp);
    expect(r.dealt.length).toBe(5);
    expect(inFolder(r, B, inp.candidates)).toBe(5);
    expect(r.meta.mode).toBe('focus');
  });
  it('backlog deals due cards oldest-first in batches and reports the remainder', () => {
    const inp = input({ mode: 'backlog', size: 8, folderId: A });
    const r = selectSession(inp);
    expect(r.dealt.length).toBe(8);
    expect(r.dealt.every((d) => d.cardId.startsWith('ad'))).toBe(true);
    expect(r.meta.backlog_remaining).toBe(12);
    expect(r.dealtIds).toEqual(r.dealt.map((d) => d.cardId));
  });
  it('pause guards the Mix only: backlog on a paused deck works', () => {
    const inp = input({ mode: 'backlog', size: 5, folderId: C });
    const r = selectSession(inp);
    expect(r.dealt.length).toBe(5);
    expect(inFolder(r, C, inp.candidates)).toBe(5);
  });
});

describe('components', () => {
  it('at most one component per card is dealt, the earliest due', () => {
    const rows: CandidateRow[] = [
      { cardId: 'x', componentId: 'reverse', folderId: A, createdAt: PAST, status: 'review', dueAt: '2026-09-01T00:00:00.000Z' },
      { cardId: 'x', componentId: 'forward', folderId: A, createdAt: PAST, status: 'review', dueAt: '2026-08-30T00:00:00.000Z' },
      { cardId: 'y', componentId: 'main', folderId: A, createdAt: PAST, status: 'review', dueAt: PAST },
    ];
    expect(onePerCard(rows).map((r) => `${r.cardId}:${r.componentId}`).sort()).toEqual(['x:forward', 'y:main']);
    const r = selectSession(input({ mode: 'focus', folderId: A, candidates: rows }));
    expect(r.dealt).toEqual(expect.arrayContaining([{ cardId: 'x', componentId: 'forward' }, { cardId: 'y', componentId: 'main' }]));
    expect(r.dealt.length).toBe(2);
  });
  it('a card dealt without a componentId presents as main', () => {
    const r = selectSession(input({ mode: 'backlog', size: 1, folderId: A }));
    expect(r.dealt[0].componentId).toBe('main');
  });
});

describe('look-ahead', () => {
  const in10h = new Date(NOW.getTime() + 10 * 3600e3).toISOString();
  const rows: CandidateRow[] = [{ cardId: 'soon', folderId: A, createdAt: PAST, status: 'review', dueAt: in10h }];
  it('a card due later today is not due without look-ahead', () => {
    expect(selectSession(input({ mode: 'backlog', folderId: A, candidates: rows, dueLookaheadHours: 0 })).dealt.length).toBe(0);
  });
  it('and is due with a 16-hour look-ahead', () => {
    expect(selectSession(input({ mode: 'backlog', folderId: A, candidates: rows, dueLookaheadHours: 16 })).dealt.length).toBe(1);
  });
});
