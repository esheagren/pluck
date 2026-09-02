// core-engine guard: rebuild every card from its diary and diff against the stored
// snapshot (cards row + card_review_state rows). Exits 1 on any difference.
//   npx dotenv -e .env.local -- tsx scripts/verify-snapshots.ts
import { sql } from 'drizzle-orm';
import { defaultScheduler, legacyFromSpec, rebuild } from '@pluckk/core';
import { getDb, schema } from '../lib/db.js';
import { isoTimestamp } from '../lib/serialize.js';
import { loadEventsForCards } from '../lib/store.js';

const db = getDb();
const cards = await db.select().from(schema.cards);
const states = await db.select().from(schema.cardReviewState);
const stateBy = new Map<string, typeof states[number]>();
for (const s of states) stateBy.set(`${s.cardId}:${s.componentId}`, s);
const events = await loadEventsForCards(db, cards.map((c) => c.id));

let checked = 0, noDiary = 0, bad = 0;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
for (const c of cards) {
  const evs = events.get(c.id);
  if (!evs) { noDiary++; continue; }
  checked++;
  const card = rebuild(evs, defaultScheduler)!;
  const problems: string[] = [];
  if (JSON.stringify(card.spec) !== JSON.stringify(c.spec)) problems.push('spec');
  if (card.isDeleted !== c.isDeleted) problems.push('isDeleted');
  if ((card.folderId ?? null) !== (c.folderId ?? null)) problems.push('folder');
  if ((card.captureKey ?? null) !== (c.captureKey ?? null)) problems.push('captureKey');
  const mirror = legacyFromSpec(card.spec);
  if (mirror.question !== c.question || mirror.answer !== c.answer) problems.push('mirror');
  const maxSeq = evs.reduce((m, e) => Math.max(m, e.seq ?? 0), 0);
  if ((c.snapshotSeq ?? null) !== maxSeq) problems.push(`snapshotSeq ${c.snapshotSeq}≠${maxSeq}`);
  for (const [id, comp] of Object.entries(card.components)) {
    const s = stateBy.get(`${c.id}:${id}`);
    if (!s) {
      if (comp.status !== 'new' || comp.reviewCount !== 0) problems.push(`${id}: no row but reviewed`);
      continue;
    }
    if (comp.status !== s.status) problems.push(`${id}.status ${comp.status}≠${s.status}`);
    if (!near(comp.intervalDays, s.intervalDays)) problems.push(`${id}.interval`);
    if (!near(comp.easeFactor, s.easeFactor)) problems.push(`${id}.ease`);
    if (comp.dueAt !== isoTimestamp(s.dueAt)) problems.push(`${id}.due ${comp.dueAt}≠${isoTimestamp(s.dueAt)}`);
    if (comp.reviewCount !== s.reviewCount || comp.lapseCount !== s.lapseCount || comp.streak !== s.streak) problems.push(`${id}.counts`);
  }
  for (const s of states.filter((x) => x.cardId === c.id)) {
    if (!card.components[s.componentId]) problems.push(`stray state row ${s.componentId}`);
  }
  if (problems.length) { bad++; if (bad <= 15) console.log(`✗ ${c.id}: ${problems.join(', ')}`); }
}
const eventCount = (await db.select({ n: sql<number>`count(*)::int` }).from(schema.cardEvents))[0].n;
console.log(`checked ${checked} cards (${eventCount} events) · without diary ${noDiary} · mismatches ${bad}`);
process.exit(bad === 0 ? 0 : 1);
