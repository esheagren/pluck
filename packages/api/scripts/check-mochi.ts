// Is the stored Mochi API key still valid, and what decks exist there?
import { sql } from 'drizzle-orm';
import { getDb } from '../lib/db.js';

const db = getDb();
const rows = (await db.execute(sql`select email, mochi_api_key is not null as has_key, mochi_deck_id from users`)).rows;
console.log('users:', JSON.stringify(rows));

const key = (await db.execute(sql`select mochi_api_key from users where mochi_api_key is not null limit 1`)).rows[0]?.mochi_api_key as string | undefined;
if (!key) { console.log('no mochi key stored'); process.exit(0); }

const res = await fetch('https://app.mochi.cards/api/decks?limit=100', {
  headers: { Authorization: 'Basic ' + Buffer.from(key + ':').toString('base64') },
});
console.log('mochi /decks status:', res.status);
if (res.ok) {
  const d = (await res.json()) as { docs: Array<{ id: string; name: string; archived?: boolean; 'parent-id'?: string }> };
  for (const deck of d.docs) console.log(`- ${deck.name}${deck.archived ? ' [archived]' : ''} (${deck.id})${deck['parent-id'] ? ' parent=' + deck['parent-id'] : ''}`);
} else {
  console.log(await res.text());
}
