// Drizzle rows come back camelCase (schema property names); every client of this
// API was written against Supabase's snake_case rows. Convert at the boundary so
// the webapp/extension/macOS payloads stay byte-compatible.

const toSnake = (k: string) => k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
const toCamel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

// Postgres returns timestamptz as "2026-02-10 14:48:38.45+00"; Supabase returned ISO
// ("2026-02-10T14:48:38.45+00:00"). Normalise so every client keeps parsing reliably.
const PG_TS = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}(?:\.\d+)?)([+-]\d{2})(?::?(\d{2}))?$/;
export function isoTimestamp(v: string): string {
  const m = PG_TS.exec(v);
  return m ? `${m[1]}T${m[2]}${m[3]}:${m[4] ?? '00'}` : v;
}

export function snake<T = unknown>(value: unknown): T {
  if (Array.isArray(value)) return value.map(snake) as T;
  if (typeof value === 'string') return isoTimestamp(value) as T;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[toSnake(k)] = snake(v);
    return out as T;
  }
  return value as T;
}

/** Convert an incoming snake_case body to camelCase keys, keeping only allowed keys. */
export function pick<T extends Record<string, unknown>>(body: unknown, allowed: readonly string[]): Partial<T> {
  const out: Record<string, unknown> = {};
  if (!body || typeof body !== 'object') return out as Partial<T>;
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    const ck = toCamel(k);
    if (allowed.includes(ck)) out[ck] = v;
  }
  return out as Partial<T>;
}
