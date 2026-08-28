// Minimal path router for catch-all Vercel functions (Hobby plan caps a
// deployment at 12 functions, so data routes share one entry point).
import type { VercelRequest, VercelResponse } from '@vercel/node';

export type Params = Record<string, string>;
export type RouteHandler = (req: VercelRequest, res: VercelResponse, params: Params) => Promise<void> | void;

interface Route { method: string; pattern: string[]; handler: RouteHandler }

export class Router {
  private routes: Route[] = [];
  on(method: string, path: string, handler: RouteHandler) {
    this.routes.push({ method, pattern: path.split('/').filter(Boolean), handler });
    return this;
  }
  async dispatch(req: VercelRequest, res: VercelResponse, segments: string[]): Promise<void> {
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    let pathMatched = false;
    for (const r of this.routes) {
      if (r.pattern.length !== segments.length) continue;
      const params: Params = {};
      let ok = true;
      for (let i = 0; i < r.pattern.length; i++) {
        const p = r.pattern[i];
        if (p.startsWith(':')) params[p.slice(1)] = decodeURIComponent(segments[i]);
        else if (p !== segments[i]) { ok = false; break; }
      }
      if (!ok) continue;
      pathMatched = true;
      if (r.method !== req.method) continue;
      try {
        await r.handler(req, res, params);
      } catch (err) {
        console.error(`[${req.method} /${segments.join('/')}]`, err);
        if (!res.headersSent) res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
      }
      return;
    }
    res.status(pathMatched ? 405 : 404).json({ error: pathMatched ? 'Method not allowed' : 'Not found' });
  }
}

export function pathSegments(req: VercelRequest): string[] {
  const raw = req.query.path;
  const arr = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split('/') : [];
  return arr.filter(Boolean);
}
