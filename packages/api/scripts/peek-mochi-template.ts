// Understand the Great Works of Art card structure: template + fields + attachments.
import { sql } from 'drizzle-orm';
import { getDb } from '../lib/db.js';

const key = (await getDb().execute(sql`select mochi_api_key from users where mochi_api_key is not null limit 1`)).rows[0]!.mochi_api_key as string;
const auth = { Authorization: 'Basic ' + Buffer.from(key + ':').toString('base64') };

// 1. The template used by the Artists deck cards
const tpl = await fetch('https://app.mochi.cards/api/templates/G0yY1kSt', { headers: auth });
console.log('template status:', tpl.status);
if (tpl.ok) console.log(JSON.stringify(await tpl.json(), null, 1).slice(0, 1500));

// 2. One card from each GWoA subdeck — same fields, different template?
for (const [name, deck] of [['Artists', 'lVA48Z4R'], ['Titles', '6JeoJxba'], ['Periods', 'QBH5evt3']] as const) {
  const r = await fetch(`https://app.mochi.cards/api/cards?deck-id=${deck}&limit=1`, { headers: auth });
  const d = (await r.json()) as { docs: Array<Record<string, unknown>> };
  const c = d.docs[0];
  console.log(`--- ${name}: template-id=${c['template-id']}, fields=${Object.entries(c.fields as Record<string, { value: string }>).map(([k, v]) => `${k}=${JSON.stringify(v.value).slice(0, 40)}`).join(' ')}`);
}

// 3. Can we download the media? Try the attachment endpoint for 377.jpg on card 0WIXib3z.
for (const url of [
  'https://app.mochi.cards/api/cards/0WIXib3z/attachments/377.jpg',
]) {
  const r = await fetch(url, { headers: auth });
  console.log('attachment fetch:', url.split('/api/')[1], '→', r.status, r.headers.get('content-type'), r.headers.get('content-length'));
}
