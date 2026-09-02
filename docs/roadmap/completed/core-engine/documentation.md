# Core Engine — what shipped (2026-09-02)

Branch `core-engine`, PR #11. Steps 1–7 of `plan.md` are live in production; step 8 is deferred (below).

## What changed, by layer

**`packages/core`** (new). Entities (`Card` = `spec` + `provenance` + one `ComponentState` per component),
the event diary types, a pure reducer with `rebuild` / `applyIncremental`, the SM-2 scheduler behind a
`Scheduler` interface with Orbit's four mechanics, the review mixer (`queue.ts`, now one component per card
with a due look-ahead), and zod wire schemas. 51 vitest tests. Built to `dist/` because Vercel's Node
builder transpiles only the project's own TypeScript; the API's Vercel build installs at the repo root and
runs `cd ../core && npm run build` (an empty `packages/api/public/` is required once a build command exists).

**Database.** `card_events` (append-only; `seq` is the global order), `cards.spec/provenance/capture_key/
is_deleted/snapshot_seq/snapshot_algorithm`, `card_review_state.component_id` with a unique index per
card + user + component. Drizzle migrations replace `db:push`: `0000_baseline` was recorded as applied (the
database predates it; `scripts/mark-baseline.ts`), `0001_core_engine_diary` was applied. The backfill wrote
6,410 events (5,918 ingests, 404 reviews, 88 reschedules carrying the exact pre-existing state);
`scripts/verify-snapshots.ts` rebuilds every card from its diary and reports 0 mismatches.

**API.** Every write goes through `lib/store.ts#commit` (append events, rebuild, write the snapshot in one
neon-http batch). `lib/cards.ts` holds create / patch / soft-delete / review / undo; `lib/review.ts` renders
review items (one per component, with state and previews). Routes added: `POST review/items`,
`POST review/undo`, `GET cards/:id/events`, `GET cards?source=`. `POST review` takes a rating and schedules
server-side. `POST cards` accepts a full `spec` and is idempotent on `capture_key`. Deck counts and the
queue honour the 16-hour look-ahead.

**Webapp.** The review queue is a queue of components (`useReviewState` rewritten around server items; no
client-side scheduler). Undo last rating (Z). Cards page: composite chips, source label / visit-with-highlight /
"all cards from this source" (`?source=`), delete → Undo toast, History panel. ReviewCard sizes type to content.

**Extension and Mac app.** One save per generated card with a full `spec` (no more client-side expansion).
The Mac app sends structured provenance (`app:<app>/<window title>`, container = app name, selection).

**Scheduler mechanics (on since step 7).** Elapsed-time growth, 10-minute same-session retry, 0–10 min
deterministic jitter on intervals ≥ 1 day, 16-hour due look-ahead. Every `card.review` event records the
mechanics it used; the reducer replays with those, so changing the defaults never rewrites history.

## Verification recipe

`npm test` (root, 51 core tests) · `npm run smoke` (23) · `npm run smoke:mixer` (12) · `npm run db:verify`
(0 mismatches) · `scripts/probe-prod-cards.ts` (6 end-to-end checks against production).

## Deferred: step 8 (drop the mirror columns)

`cards.question/answer/style/source_*` are still written as a mirror of `spec`/`provenance` and still read
by the extension's page annotations (`source_selector`), the Mochi mirror and the legacy `review/queue`
response. Dropping them means teaching every read path to derive those fields from `spec`/`provenance`
first. Deliberately left for a later release: it is cleanup with no user-visible benefit and real
breakage risk across three clients. `packages/shared/scheduler` remains as a thin re-export for the same
reason. `review_logs` stays as the analytics mirror (decision 3 in the plan).

## Gotchas learned

- Vercel + workspace packages: build them, don't import their `.ts`.
- `NSPanel`-style surprises have a database cousin: `bigserial` `seq` plus ties broken by `id` keeps replay
  deterministic; timestamps alone do not.
- A snapshot's `is_new` for a composite card means "its first component is new"; deck counts are per card.
