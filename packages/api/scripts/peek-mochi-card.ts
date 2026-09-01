// Print the raw content of a couple of Great Works of Art cards to see the format.
import { sql } from 'drizzle-orm';
import { getDb } from '../lib/db.js';

const key = (await getDb().execute(sql`select mochi_api_key from users where mochi_api_key is not null limit 1`)).rows[0]!.mochi_api_key as string;
const res = await fetch('https://app.mochi.cards/api/cards?deck-id=lVA48Z4R&limit=2', {
  headers: { Authorization: 'Basic ' + Buffer.from(key + ':').toString('base64') },
});
const d = (await res.json()) as { docs: Array<Record<string, unknown>> };
for (const c of d.docs) {
  console.log('---');
  console.log(JSON.stringify(c, null, 1).slice(0, 1200));
}
