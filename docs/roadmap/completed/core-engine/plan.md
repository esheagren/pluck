# Core Engine — the next major Pluckk update

*Planned 2026-09-02. Supersedes Phase 3 of `docs/roadmap/planned/consolidation/plan.md` and pulls in the
review-screen items from Phase 5. Design rationale: `docs/audit/2026-09-02-orbit-study.md`.*

## What this update is

Pluckk's generator is good and its engine is improvised. This update rebuilds the engine the way Orbit built
theirs, without touching the generator: a **diary of events** becomes the source of truth for every card; a
card holds **several schedules** (forward/reverse, one per list prompt) instead of being split into several
cards; every card carries **real provenance**; capturing the same passage twice **finds the existing card**;
and the scheduler grows intervals from **what actually happened**. All of it lives in one new package,
`packages/core`, that the API, the webapp, the extension and the Mac app import instead of each carrying its
own copy.

What a user notices when it ships:

- **Undo** in review (rating, delete, skip) and on the Cards page.
- A bidirectional card is **one card**; edit it once and both directions change. Lists likewise.
- "**All cards from this page**" and a *visit origin* link that lands on the highlighted passage.
- Capturing the same paragraph twice **returns the card you already have**.
- Cards reviewed late get the **credit for the longer interval**; "due later today" counts as due now, so the
  due count stops jumping at midnight; a card you fail comes back in ten minutes in the same session.
- Every review still shows **what each rating will do** ("Again 10m · Hard 3d · Good 12d · Easy 25d").

Nothing about how cards are generated, the mixer, decks, or the four ratings changes.

## Non-goals

FSRS (this update makes it a replay, but does not do it). Notes → cards. Offline/PWA (this update makes it
cheap; it is its own feature). Any change to prompts or card styles. Binary remembered/forgotten.

## Current state (measured 2026-09-02)

| Table | Rows | Note |
|---|---|---|
| `cards` | 5,918 | 5,617 are the paused Anki imports; 0 rows with a composite style — every past bidirectional/list card was split before saving |
| `card_review_state` | 88 | one mutable 24-column row per reviewed card |
| `review_logs` | 404 | already records `previous_*` and `new_*` per review, but is not authoritative |
| `study_sessions` | 0 | unused |

Composite expansion happens client-side in two places: the extension side panel (one save request per
expanded card) and `CardGenerationView.swift#expandCard` in the Mac app. SM-2 lives in
`packages/shared/src/scheduler/sm2-simple.ts` (`calculateNextReview`, `previewIntervals`) and is called by the
API's `POST review` handler; the webapp also imports `previewIntervals` for the rating buttons. There are no
Drizzle migrations (`db:push` only), no unit tests, no CI.

## Design

### Entities

```ts
// packages/core/src/entities.ts
type ComponentId = 'main' | 'forward' | 'reverse' | `p${number}`;

interface Card {
  id: string;                       // uuid
  userId: string;
  spec: CardSpec;                   // what was authored — replaces question/answer/style/numeric* columns
  provenance: Provenance | null;
  folderId: string | null;
  tags: string[];
  imageUrl: string | null;
  captureKey: string | null;        // sha256(normalised selection + provenance.identifier)
  isDeleted: boolean;
  createdAt: string;
  components: Record<ComponentId, ComponentState>;   // the schedules
}

type CardSpec =
  | { style: 'qa' | 'cloze' | 'explanation' | 'application' | 'diagram'; question: string; answer: string; answerType?: 'text' | 'numeric'; numeric?: {...} }
  | { style: 'qa_bidirectional'; forward: QA; reverse: QA }
  | { style: 'cloze_list'; listName: string; items: string[]; prompts: QA[] };

function componentIdsOf(spec: CardSpec): ComponentId[];   // qa → ['main']; bidirectional → ['forward','reverse']; list → ['p0'…'pN']
function renderComponent(spec: CardSpec, id: ComponentId): { question: string; answer: string }; // what the review screen shows

interface ComponentState {                       // today's card_review_state, minus the card identity
  status: 'new' | 'learning' | 'review' | 'relearning' | 'suspended';
  dueAt: string; intervalDays: number; easeFactor: number; stepIndex: number;
  reviewCount: number; lapseCount: number; streak: number; lastReviewedAt: string | null;
  stability?: number; difficulty?: number;        // reserved for FSRS
}

interface Provenance {                           // Orbit's shape
  identifier: string;      // clustering key: canonical URL for web, "app:<bundle id>/<window title>" for macOS, "anki:<deck>" for imports
  url?: string; title?: string; containerTitle?: string;   // containerTitle = site name / app name / book
  selector?: { type: 'TextQuote'; exact: string; prefix?: string; suffix?: string };
}
```

### Events

```ts
// packages/core/src/events.ts — the diary. Append-only. Never edited.
type CardEvent =
  | { type: 'card.ingest';     cardId; spec; provenance; folderId; tags; captureKey; at }
  | { type: 'card.review';     cardId; componentId; rating: 'again'|'hard'|'good'|'easy'; sessionId; responseMs?; at }
  | { type: 'card.reschedule'; cardId; componentId; dueAt; intervalDays; at }          // manual/backfill/algorithm swap
  | { type: 'card.setDeleted'; cardId; isDeleted; at }
  | { type: 'card.setSpec';    cardId; spec; at }                                      // edits
  | { type: 'card.setProvenance'; cardId; provenance; at }
  | { type: 'card.setFolder';  cardId; folderId; at }
  | { type: 'card.setTags';    cardId; tags; at };
// every event also carries: id (uuid), userId, at (ISO, server-stamped), seq (bigint, server-assigned, the sync cursor)
```

### Reducer and scheduler

```ts
// packages/core/src/reducer.ts
function reduce(card: Card | null, event: CardEvent, scheduler: Scheduler): Card;   // pure; throws on non-ingest without a card
function rebuild(events: CardEvent[], scheduler: Scheduler): Card;                     // events sorted by (at, seq)

// packages/core/src/scheduler.ts
interface Scheduler {
  id: string;                                                    // 'sm2-elapsed-v2' — stored on the snapshot
  next(state: ComponentState, rating: Rating, now: Date): ComponentState;
  preview(state: ComponentState, now: Date): Record<Rating, string>;   // "10m", "3d", …
  initial(now: Date): ComponentState;
}
```

The SM-2 implementation moves in from `packages/shared` unchanged in its arithmetic, plus four mechanics from
Orbit, each behind a named constant so they can be switched off:

| Mechanic | Rule | Constant |
|---|---|---|
| Elapsed-time growth | the base interval for Good/Easy is `max(scheduledInterval, actualElapsedDays)` | `GROW_FROM_ELAPSED = true` |
| Same-session retry | `again` sets `dueAt = now + 10 min` (status `relearning`), instead of hiding the card until the learning step fires | `RETRY_DELAY_MIN = 10` |
| Jitter | `dueAt += (epochMillis % 1000) × 10 min / 1000` — deterministic, 0–10 min | `JITTER_MAX_MIN = 10` |
| Fuzzy due | the queue's "due" threshold is `now + 16 h` | `DUE_LOOKAHEAD_H = 16` |

`queue.ts` is today's `lib/mixer.ts` moved into core with one change: candidates are components, not cards,
and at most one component per card is dealt per session (earliest due wins, ties by component order).

### Storage (Neon)

```sql
-- new
card_events (id uuid pk, seq bigserial unique, user_id, card_id, type text, payload jsonb, at timestamptz, index (user_id, seq), index (card_id, seq));

-- cards: add
spec jsonb, provenance jsonb, capture_key text, is_deleted boolean default false,
snapshot_seq bigint, snapshot_algorithm text;
unique index (user_id, capture_key) where capture_key is not null;
-- keep question/answer/style/source_* for one release as a read-only mirror, then drop.

-- card_review_state: add component_id text default 'main'; unique (card_id, user_id, component_id);
-- it becomes the materialised snapshot of components. review_logs stays as-is (analytics), no longer written by the review handler.
```

Snapshots follow Orbit's rule: on write, if every new event is newer than `snapshot_seq`, apply incrementally;
otherwise rebuild the card from its full event list. With 5,918 cards and a few hundred events a rebuild is
milliseconds.

### API

| Route | Change |
|---|---|
| `POST cards` | accepts a `spec` (composite allowed) + `provenance` + optional `capture_key`; the server derives components and emits `card.ingest`. If `capture_key` matches an existing non-deleted card, returns it with `200` and `{ existing: true }`. Old flat payload still accepted for one release (mapped to `spec: { style: 'qa', … }`). |
| `PATCH cards/:id` | emits `card.setSpec` / `setFolder` / `setTags` / `setProvenance` as appropriate |
| `DELETE cards/:id` | emits `card.setDeleted true` (soft); hard delete becomes an admin script |
| `POST review` | takes `{ card_id, component_id, rating, session_id }`; emits `card.review`; returns the updated component and previews |
| `POST review/undo` | *new*: takes `{ event_id }`; emits the inverse (`card.reschedule` back to the pre-review state, or `setDeleted false`) |
| `GET cards/:id/events` | *new*: the diary, for the card detail page |
| `GET review/session`, `queue`, `decks` | unchanged shape, but rows carry `component_id` and the rendered question/answer for that component |
| `GET cards?source=<identifier>` | *new* filter (replaces `source_url_prefix`) |

All request/response shapes are zod schemas in `packages/core/src/api.ts`, imported by `api/v1.ts` for
validation and by `packages/shared/src/api/client.ts` for types. The snake_case serializer stays at the
boundary so no client breaks; camelCase-in-core, snake_case-on-the-wire becomes a rule enforced by the schemas
rather than by convention.

### Clients

- **Extension**: side panel stops expanding; it posts the composite `spec` once. Sends `provenance` built from
  the page (canonical URL, `og:site_name`, title, TextQuote around the selection — it already captures
  `source_selection` and `source_selector`). Computes `capture_key`.
- **Mac app**: delete `expandCard`; post the composite. `provenance.identifier = "app:<bundle id>/<window
  title>"`, `containerTitle = app name`, `title = window title`. Computes `capture_key`.
- **Webapp**: review shows `renderComponent(spec, component_id)`; rating buttons keep their previews (server
  now supplies them); adds Undo (⌘Z / button) using `review/undo`; Cards page shows one row per card with a
  "2 directions" / "5 prompts" chip; card detail page shows the diary; "All cards from this source" link.
  Bounded, centred review stage (already requested) and content-sized type come with the ReviewCard rewrite.

## Steps (each is one PR, each leaves production working)

| # | Step | Exit criterion |
|---|---|---|
| 1 | **`packages/core` skeleton** — entities, events, reducer, scheduler (SM-2 moved from shared, mechanics behind flags **off**), queue (mixer moved), zod API schemas; vitest with reducer/scheduler/queue tests (property-style like Orbit's); `typecheck` + `test` scripts in every package; one GitHub Action running them. | CI green on a PR that changes no behaviour; `packages/shared/scheduler` re-exports from core. |
| 2 | **Schema + backfill** — add `card_events`, new `cards` columns, `component_id`; switch to `drizzle-kit generate/migrate` with the first real migration; `scripts/backfill-events.ts` writes one `card.ingest` per card (spec from question/answer/style, provenance from `source_*`), one `card.review` per `review_logs` row, and a `card.reschedule` per `card_review_state` row so snapshots match exactly; run it against a Neon branch first, then production. | `scripts/verify-snapshots.ts` rebuilds every card from events and diffs against `card_review_state`: zero differences. |
| 3 | **API writes through the diary** — `POST cards`, `PATCH`, `DELETE`, `POST review` emit events and update snapshots via the reducer; old payloads still accepted; `review_logs` no longer written. Smoke + mixer smoke pass. | Every mutation in prod produces an event; `verify-snapshots` still zero. |
| 4 | **Components** — `POST cards` accepts composite specs and derives components; session/queue/review carry `component_id`; webapp renders components; Mac app and extension stop expanding. | A bidirectional card saved from each client is one row with two schedules, both reviewable. |
| 5 | **Provenance + capture_key** — both clients send structured provenance; idempotent `POST cards`; `GET cards?source=`; webapp "from this source" and visit-origin-with-highlight. Backfill `provenance.identifier` for existing cards from `source_url`. | Re-capturing a passage returns the existing card; Mac-app cards show app name and window title correctly. |
| 6 | **Undo + diary UI** — `POST review/undo`, `GET cards/:id/events`; webapp Undo in review and on delete; card detail shows history. | Undo a rating, a delete and a skip; the snapshot returns to the exact prior state. |
| 7 | **Scheduler mechanics on** — flip the four constants, ship the ReviewCard rewrite (bounded stage, content-sized type, previews from server). Announce in `/about`. | Due count stable across midnight; failed cards return within the session; previews match what happens. |
| 8 | **Drop the mirror** — remove `question/answer/style/source_*` columns and the old flat payload; delete `packages/shared/scheduler`; remove `review_logs` writes' dead code; update `/architecture` diagrams and `CLAUDE.md`. | No client references the old columns; audit §2.2.C duplicates gone. |

Steps 1–3 are pure plumbing with no visible change; 4–6 are the visible features; 7 is behaviour; 8 is
cleanup. Roughly one session per step, two for step 4.

## Testing

- `packages/core`: vitest. Reducer (every event type, rebuild-from-scratch equals incremental, out-of-order
  arrival), scheduler (property style: interval ratios, elapsed-time growth, retry, jitter bounds, previews
  equal `next`), queue (the twelve existing mixer checks moved from `smoke-mixer.ts`, plus one-component-per-card
  and the lookahead).
- `packages/api`: the two existing smoke scripts become vitest suites against a Neon **branch** created in CI
  (`neonctl branches create`), so tests never touch production and CI has a real Postgres.
- `verify-snapshots.ts` runs in CI after step 2 and stays as a nightly guard.
- Extension and Mac app: manual checklist in each PR (save a bidirectional card, review both directions, undo).

## Risks and how they are contained

| Risk | Containment |
|---|---|
| Backfill produces snapshots that differ from today's rows | `verify-snapshots` diff must be zero before step 3 merges; the old columns are kept as a mirror until step 8, so rollback is "read the mirror". |
| Client/server version skew during steps 3–5 | old payloads accepted for one release; new fields optional; the extension and Mac app are updated in the same PR as the API change that needs them. |
| Elapsed-time growth changes intervals for the 88 reviewed cards | it only affects future reviews; flags stay off until step 7; the previews show the effect before each rating. |
| Event log growth | ~1 row per review; at 200 reviews/day that is 73k rows/year. Not a concern on Neon free tier for years. |
| The Anki decks (5,617 cards) get 5,617 ingest events | fine; one transaction, and they carry `provenance.identifier = "anki:<deck>"`, which the mixer can use as a source. |

## Decisions Erik makes

1. **Soft delete only** (deleted cards stay in the diary; a "Deleted" filter shows them; hard delete is a script). Recommended yes.
2. **Turn on all four scheduler mechanics at once in step 7**, or stage them. Recommended all at once; they are individually small and the previews make them visible.
3. **Keep `review_logs`** as an analytics table fed from events, or drop it in step 8. Recommended keep, rebuilt from events nightly, so the activity grid keeps working with no change.

## What Erik does during the build

Step 2: approve running the backfill on production after the Neon-branch dry run. Step 4: reload the extension
and rebuild the Mac app once each. Step 7: use it for a week and say whether the ten-minute retry feels right.
