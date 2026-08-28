// Drizzle rows come back camelCase (schema property names); every client of this
// API was written against Supabase's snake_case rows. Convert at the boundary so
// the webapp/extension/macOS payloads stay byte-compatible.

const toSnake = (k: string) => k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
const toCamel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

export function snake<T = unknown>(value: unknown): T {
  if (Array.isArray(value)) return value.map(snake) as T;
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
