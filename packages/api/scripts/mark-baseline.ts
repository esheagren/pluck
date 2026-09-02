// One-time: the database was created with `drizzle-kit push`, so the first generated
// migration (0000_baseline) describes tables that already exist. Record it as applied
// in drizzle's migrations table without running it, so `db:migrate` starts from 0001.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '../lib/db.js';

const journal = JSON.parse(readFileSync(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8')) as { entries: { idx: number; when: number; tag: string }[] };
const baseline = journal.entries.find((e) => e.idx === 0);
if (!baseline) throw new Error('no baseline entry in journal');
const sqlText = readFileSync(new URL(`../drizzle/${baseline.tag}.sql`, import.meta.url), 'utf8');
const hash = createHash('sha256').update(sqlText).digest('hex');

const db = getDb();
await db.execute(sql`create schema if not exists drizzle`);
await db.execute(sql`create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)`);
const existing = (await db.execute(sql`select count(*)::int as n from drizzle.__drizzle_migrations`)).rows[0] as { n: number };
if (existing.n > 0) {
  console.log('migrations table already has rows; nothing to do');
} else {
  await db.execute(sql`insert into drizzle.__drizzle_migrations (hash, created_at) values (${hash}, ${baseline.when})`);
  console.log(`marked ${baseline.tag} (when=${baseline.when}) as applied`);
}
