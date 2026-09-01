// Rough card counts for selected Mochi decks (counts up to `cap` per deck).
import { sql } from 'drizzle-orm';
import { getDb } from '../lib/db.js';

const decks: Record<string, string> = {
  'Great Works of Art / Artists': 'lVA48Z4R',
  'Great Works of Art / Titles': '6JeoJxba',
  'Great Works of Art / Periods': 'QBH5evt3',
  'Essential Spanish Top 5000': '5oihpg3t',
  'Pluckk': '2VOpVjoy',
};
const cap = 1200;
const key = (await getDb().execute(sql`select mochi_api_key from users where mochi_api_key is not null limit 1`)).rows[0]!.mochi_api_key as string;
const auth = { Authorization: 'Basic ' + Buffer.from(key + ':').toString('base64') };

for (const [name, id] of Object.entries(decks)) {
  let n = 0; let bookmark: string | undefined; let more = false;
  do {
    const p = new URLSearchParams({ 'deck-id': id, limit: '100' });
    if (bookmark) p.set('bookmark', bookmark);
    const res = await fetch(`https://app.mochi.cards/api/cards?${p}`, { headers: auth });
    if (!res.ok) { console.log(`${name}: HTTP ${res.status}`); break; }
    const d = (await res.json()) as { docs: unknown[]; bookmark?: string };
    n += d.docs.length; bookmark = d.bookmark;
    more = !!bookmark && d.docs.length === 100;
    if (n >= cap) { console.log(`${name}: ${n}+ cards`); more = false; break; }
    await new Promise((r) => setTimeout(r, 80));
  } while (more);
  if (n < cap) console.log(`${name}: ${n} cards`);
}
