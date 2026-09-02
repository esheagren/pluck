# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project Overview

**Pluckk** is a private-first spaced-repetition system (users = Erik and people he invites; no billing,
no public profiles, no social features — decided 2026-09-01). A Chrome extension captures highlighted text
in the browser; a macOS app (`⌘⌘`) captures from any native app; a web app (pluckk.app) is the single
review surface. All three talk to one API. Product doc: `docs/README.md`. Architecture audit and forward
plan: `docs/audit/2026-09-01-architecture-audit.md`, `docs/roadmap/planned/consolidation/plan.md`.

**Stack (since the 2026-08 migration off Supabase):** Neon Postgres via Drizzle, Vercel serverless
functions, Vercel Blob for card images, Google Sign-In → opaque bearer tokens. No Stripe, no usage limits.

## Packages

| Package | What | Run |
|---|---|---|
| `packages/api` | Vercel functions. `api/v1.ts` is one function routing all `/api/v1/*` data/auth paths via a `vercel.json` rewrite (Hobby plan caps 12 functions; Vercel’s `[...path]` catch-all did not match nested paths). `db/schema.ts` is the Drizzle schema. | `npm run typecheck`, `npm run db:push`, `npm run db:studio`, `vercel --prod` |
| `packages/shared` | `api/` (fetch client, session store, Google OIDC helpers), `scheduler/` (SM-2), `constants/`, `utils/` | imported by the others |
| `packages/webapp` | Vite + React 18, pluckk.app. Hooks in `src/hooks/` call `@pluckk/shared/api`. | `npm run dev:webapp`, `npm run build:webapp` |
| `packages/extension` | Manifest V3. `src/auth.ts` owns sign-in + the API client; background/content built by esbuild as IIFE. | `npm run build:extension`, load unpacked from `packages/extension/dist` |
| `packages/macos` | Swift thin capture client: `⌘⌘` → Accessibility selection → panel → generate → `/api/v1/cards`. Signs in via `pluckk.app/auth/desktop` → `pluckk://` callback. No review/browse (webapp does that). | `xcodebuild -project packages/macos/Pluckk/Pluckk.xcodeproj -scheme Pluckk build` |

## Rules

- **All data access goes through `packages/api`.** Clients never hold DB credentials. Every query in the
  API is scoped `where user_id = <authenticated user>` — there is no RLS any more, so never omit it.
- **Auth:** `POST /api/v1/auth/google { credential }` verifies a Google ID token and issues a `pk_…` token
  (sha256-hashed in `api_tokens`). `lib/auth.ts#authenticateRequest` is the single verifier. Webapp stores
  the token in localStorage, extension in `chrome.storage.local['pluckk_session']`, macOS in the Keychain
  (obtained through the webapp's `/auth/desktop` page, which redirects to `pluckk://auth/callback#token=`).
- **API JSON is snake_case** (the old Supabase row shape) — `lib/serialize.ts#snake` at the boundary.
  Drizzle properties are camelCase. Don't mix them.
- **Schema changes:** edit `packages/api/db/schema.ts`, then `npm run db:push` (prototype) or
  `db:generate` + `db:migrate`. The historical Supabase SQL lives in `docs/history/supabase-migrations/` —
  reference only, never applied.
- **Adding an endpoint:** add a route to `api/v1.ts`, not a new file, unless the function count
  allows it.
- `import.meta` is not available in the esbuild IIFE builds (background/content) — keep shared constants
  plain values.
- Env vars for the API live in Vercel (`vercel env pull .env.local` inside `packages/api`); see
  `packages/api/.env.example`. `GOOGLE_CLIENT_ID` (public) is a constant in `packages/shared/src/constants/api.ts`.

## Roadmap workflow

`docs/roadmap/` — `icebox.md` → `planned/<feature>/plan.md` → `completed/<feature>/`. The current
sequence of work is `docs/roadmap/planned/consolidation/plan.md` (phases 0–6).

## Verification

Before deploying the API: `npm run smoke` and `npx dotenv -e .env.local -- tsx scripts/smoke-mixer.ts` in
`packages/api`. Deploy with `bash scripts-deploy-api.sh` / `bash scripts-deploy-webapp.sh` from the repo root
(the Vercel projects have Root Directory set, so the CLI needs the project identity from env).
