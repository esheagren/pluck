// One-shot import of the Supabase REST dump into Neon, preserving every UUID so
// foreign keys survive. Images go to Vercel Blob and cards.image_url is rewritten.
//
//   DATABASE_URL=… BLOB_READ_WRITE_TOKEN=… npx tsx scripts/import-supabase.ts [dump-dir]
//
// Idempotent: uses ON CONFLICT DO NOTHING on every table, so it can be re-run.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { put } from '@vercel/blob';
import { getDb, schema } from '../lib/db.js';

const dumpDir = process.argv[2] || '/Users/erik/Documents/projects/_migration/supabase-dumps/pluckk';
const db = getDb();

const toCamel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
function load(table: string): Record<string, unknown>[] {
  const p = join(dumpDir, 'tables', `${table}.json`);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : [];
}
function camelRows(rows: Record<string, unknown>[], drop: string[] = []) {
  return rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !drop.includes(k)).map(([k, v]) => [toCamel(k), v])));
}
async function insert<T extends { $inferInsert: unknown }>(table: T, rows: unknown[], label: string) {
  if (rows.length === 0) { console.log(`${label}: 0 rows`); return; }
  for (let i = 0; i < rows.length; i += 200) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.insert(table as any).values(rows.slice(i, i + 200) as any).onConflictDoNothing();
  }
  console.log(`${label}: ${rows.length} rows`);
}

async function main() {
  // 1. users — auth_users.json carries emails; users.json carries profile columns.
  const authUsers = JSON.parse(readFileSync(join(dumpDir, 'auth_users.json'), 'utf8')) as Array<{ id: string; email: string; user_metadata?: { avatar_url?: string; full_name?: string }; identities?: Array<{ provider: string; id: string }> }>;
  const profiles = load('users');
  const users = profiles.map((p) => {
    const au = authUsers.find((a) => a.id === p.id);
    const google = au?.identities?.find((i) => i.provider === 'google');
    const row = camelRows([p], ['stripe_customer_id', 'subscription_status', 'cards_generated_this_month', 'current_period_start'])[0];
    return { ...row, email: row.email ?? au?.email ?? null, googleSub: google?.id ?? null,
      avatarUrl: row.avatarUrl ?? au?.user_metadata?.avatar_url ?? null,
      displayName: row.displayName ?? au?.user_metadata?.full_name ?? null };
  });
  await insert(schema.users, users, 'users');

  await insert(schema.reservedUsernames, load('reserved_usernames'), 'reserved_usernames');
  await insert(schema.folders, camelRows(load('folders')), 'folders');
  await insert(schema.algorithmConfigs, camelRows(load('algorithm_configs')), 'algorithm_configs');
  await insert(schema.cards, camelRows(load('cards')), 'cards');
  await insert(schema.userStudySettings, camelRows(load('user_study_settings')), 'user_study_settings');
  await insert(schema.cardReviewState, camelRows(load('card_review_state')), 'card_review_state');
  await insert(schema.reviewLogs, camelRows(load('review_logs')), 'review_logs');
  await insert(schema.studySessions, camelRows(load('study_sessions')), 'study_sessions');
  await insert(schema.userCalibrationStats, camelRows(load('user_calibration_stats')), 'user_calibration_stats');
  await insert(schema.feedback, camelRows(load('feedback')), 'feedback');

  // 2. images → Vercel Blob, rewrite cards.image_url
  const imgDir = join(dumpDir, 'storage', 'card-images');
  if (existsSync(imgDir) && process.env.BLOB_READ_WRITE_TOKEN) {
    const files = readdirSync(imgDir);
    let n = 0;
    for (const f of files) {
      const cardId = f.replace(/\.(png|jpe?g)$/i, '');
      const ext = f.split('.').pop()!.toLowerCase();
      const blob = await put(`card-images/${f}`, readFileSync(join(imgDir, f)), {
        access: 'public', contentType: ext === 'png' ? 'image/png' : 'image/jpeg', addRandomSuffix: false, allowOverwrite: true,
      });
      await db.execute(sql`update cards set image_url = ${blob.url} where id = ${cardId}::uuid`);
      n++;
    }
    console.log(`images: ${n} uploaded to Blob`);
  } else {
    console.log('images: skipped (no dir or BLOB_READ_WRITE_TOKEN)');
  }

  // 3. counts
  for (const t of ['users', 'folders', 'cards', 'card_review_state', 'review_logs', 'algorithm_configs', 'reserved_usernames', 'feedback', 'study_sessions', 'user_study_settings', 'user_calibration_stats']) {
    const r = await db.execute(sql.raw(`select count(*)::int as n from ${t}`));
    console.log(`  ${t}: ${(r.rows[0] as { n: number }).n}`);
  }
  const stale = await db.execute(sql`select count(*)::int as n from cards where image_url like '%supabase.co%'`);
  console.log(`  cards still pointing at supabase storage: ${(stale.rows[0] as { n: number }).n}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
