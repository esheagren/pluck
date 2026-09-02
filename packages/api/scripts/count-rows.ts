// Row counts that size the core-engine backfill.
import { sql } from 'drizzle-orm';
import { getDb } from '../lib/db.js';

const db = getDb();
for (const t of ['cards', 'card_review_state', 'review_logs', 'study_sessions', 'folders']) {
  const [{ n }] = (await db.execute(sql.raw(`select count(*)::int as n from ${t}`))).rows as { n: number }[];
  console.log(t.padEnd(18), n);
}
const [{ n }] = (await db.execute(sql.raw(`select count(*)::int as n from cards where style in ('qa_bidirectional','cloze_list')`))).rows as { n: number }[];
console.log('composite styles  ', n);
