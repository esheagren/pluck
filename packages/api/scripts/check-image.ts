// Prints one migrated image URL and its HTTP status (post-import sanity check).
import { sql } from 'drizzle-orm';
import { getDb } from '../lib/db.js';

const r = await getDb().execute(sql`select image_url from cards where image_url is not null limit 1`);
const url = (r.rows[0] as { image_url: string }).image_url;
const res = await fetch(url, { method: 'HEAD' });
console.log(res.status, res.headers.get('content-type'), url);
process.exit(res.ok ? 0 : 1);
