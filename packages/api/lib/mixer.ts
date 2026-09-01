// Review-mixer selection: decides WHICH cards enter a session; never touches scheduling.
// Modes (docs/roadmap/planned/review-mixer/plan.md):
//   scheduled — per-folder quotas from a mix (explicit or saved folder weights),
//               fill due → new (per-folder new/day cap), deficits redistributed [D3]
//   focus     — one folder, quota = size, same fill order
//   backlog   — one folder, every due card oldest-first, batched; no new cards

export interface CandidateRow {
  cardId: string;
  folderId: string | null;
  createdAt: string;
  status: string | null;   // review-state status, null = new card
  dueAt: string | null;
}

export interface MixEntry { folderId: string | null; pct: number }

export interface FolderInfo { id: string; weight: number | null; isPaused: boolean; newPerDay: number | null }

export interface MixerInput {
  mode: 'scheduled' | 'focus' | 'backlog';
  size: number;
  folderId?: string | null;          // focus/backlog
  mix?: MixEntry[];                  // scheduled override
  folders: FolderInfo[];
  candidates: CandidateRow[];        // every non-paused candidate card
  newReviewedTodayByFolder: Map<string | null, number>;
  defaultNewPerDay: number;
  now?: Date;
}

export interface MixerResult {
  dealtIds: string[];
  meta: {
    mode: string;
    per_folder: Record<string, { due: number; new: number; dealt: number }>;
    due_total: number;
    backlog_remaining?: number;
  };
}

const key = (f: string | null) => f ?? 'unfiled';

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function selectSession(input: MixerInput): MixerResult {
  const now = input.now ?? new Date();
  const paused = new Set(input.folders.filter((f) => f.isPaused).map((f) => f.id));
  const candidates = input.candidates.filter((c) => !(c.folderId && paused.has(c.folderId)));

  // Partition per folder into due (state exists, due_at <= now) and new (no state).
  const byFolder = new Map<string | null, { due: CandidateRow[]; fresh: CandidateRow[] }>();
  for (const c of candidates) {
    let b = byFolder.get(c.folderId);
    if (!b) { b = { due: [], fresh: [] }; byFolder.set(c.folderId, b); }
    if (!c.status) b.fresh.push(c);
    else if (c.dueAt && new Date(c.dueAt) <= now) b.due.push(c);
  }
  for (const b of byFolder.values()) {
    b.due.sort((a, z) => (a.dueAt! < z.dueAt! ? -1 : 1));            // oldest due first
    b.fresh.sort((a, z) => (a.createdAt < z.createdAt ? -1 : 1));    // oldest created first
  }
  const dueTotal = [...byFolder.values()].reduce((s, b) => s + b.due.length, 0);

  const perFolderMeta: MixerResult['meta']['per_folder'] = {};
  const noteMeta = (f: string | null, dealt: number) => {
    const b = byFolder.get(f) ?? { due: [], fresh: [] };
    perFolderMeta[key(f)] = { due: b.due.length, new: b.fresh.length, dealt };
  };

  const newBudget = (f: string | null): number => {
    const info = f ? input.folders.find((x) => x.id === f) : null;
    const cap = info?.newPerDay ?? input.defaultNewPerDay;
    return Math.max(0, cap - (input.newReviewedTodayByFolder.get(f) ?? 0));
  };

  const takeFromFolder = (f: string | null, quota: number): CandidateRow[] => {
    const b = byFolder.get(f);
    if (!b) return [];
    const take: CandidateRow[] = b.due.slice(0, quota);
    if (take.length < quota) take.push(...b.fresh.slice(0, Math.min(quota - take.length, newBudget(f))));
    // remove taken so redistribution passes don't re-take
    b.due = b.due.slice(Math.min(quota, take.length));
    const newTaken = take.filter((c) => !c.status).length;
    b.fresh = b.fresh.slice(newTaken);
    input.newReviewedTodayByFolder.set(f, (input.newReviewedTodayByFolder.get(f) ?? 0) + newTaken);
    return take;
  };

  if (input.mode === 'backlog') {
    const f = input.folderId ?? null;
    const b = byFolder.get(f) ?? { due: [], fresh: [] };
    const dealt = b.due.slice(0, input.size);
    noteMeta(f, dealt.length);
    return {
      dealtIds: dealt.map((c) => c.cardId),  // oldest-first, not shuffled: burn-down order
      meta: { mode: 'backlog', per_folder: perFolderMeta, due_total: dueTotal, backlog_remaining: b.due.length - dealt.length },
    };
  }

  if (input.mode === 'focus') {
    const f = input.folderId ?? null;
    const dealt = takeFromFolder(f, input.size);
    noteMeta(f, dealt.length);
    return { dealtIds: shuffle(dealt).map((c) => c.cardId), meta: { mode: 'focus', per_folder: perFolderMeta, due_total: dueTotal } };
  }

  // scheduled: explicit mix > saved weights > every non-paused folder equally (incl. unfiled)
  let mix: MixEntry[] = input.mix ?? [];
  if (mix.length === 0) {
    const weighted = input.folders.filter((f) => !f.isPaused && (f.weight ?? 0) > 0);
    mix = weighted.length > 0
      ? weighted.map((f) => ({ folderId: f.id, pct: f.weight! }))
      : [...byFolder.keys()].map((f) => ({ folderId: f, pct: 1 }));
  }
  mix = mix.filter((m) => !(m.folderId && paused.has(m.folderId)) && m.pct > 0);
  const pctTotal = mix.reduce((s, m) => s + m.pct, 0) || 1;

  const dealt: CandidateRow[] = [];
  const dealtPerFolder = new Map<string | null, number>();
  // pass 1: quotas; pass 2+: redistribute remaining slots to folders that still have supply
  let remaining = input.size;
  let active = mix.map((m) => m.folderId);
  let weights = new Map(mix.map((m) => [m.folderId, m.pct / pctTotal] as const));
  for (let pass = 0; pass < 4 && remaining > 0 && active.length > 0; pass++) {
    const wTotal = active.reduce((s, f) => s + (weights.get(f) ?? 0), 0) || 1;
    const stillActive: (string | null)[] = [];
    const slots = remaining;
    for (const f of active) {
      const quota = Math.max(pass === 0 ? 0 : 1, Math.round((slots * (weights.get(f) ?? 0)) / wTotal));
      const take = takeFromFolder(f, Math.min(quota, remaining));
      dealt.push(...take);
      dealtPerFolder.set(f, (dealtPerFolder.get(f) ?? 0) + take.length);
      remaining -= take.length;
      if (take.length >= quota && quota > 0) stillActive.push(f);
      if (remaining <= 0) break;
    }
    active = stillActive;
  }

  for (const m of mix) noteMeta(m.folderId, dealtPerFolder.get(m.folderId) ?? 0);
  return { dealtIds: shuffle(dealt).map((c) => c.cardId), meta: { mode: 'scheduled', per_folder: perFolderMeta, due_total: dueTotal } };
}
