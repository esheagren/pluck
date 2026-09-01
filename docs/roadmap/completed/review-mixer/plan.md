# Review mixer: deck-scoped, proportion-controlled review sessions

**Status:** BUILT + imports done 2026-09-01 — mixer live (scheduled/focus/backlog); Great Works 3×~645 and Spanish 4,972 imported, all paused
**Context:** Pluckk has 307 curated cards in one global review queue. Erik wants to import
Great Works of Art (1,953 cards, 3 subdecks) and Essential Spanish Top 5000 (~10k) from Mochi
(both already live there; key verified). A global queue would be drowned, so review must become
deck-aware first. Erik's requirements, verbatim in spirit:

1. Cards live in folders (exists) and review can be **scoped**.
2. A **daily session target** (e.g. 100 cards) with **per-folder proportions** ("10% from this,
   30% from that").
3. **Focus mode**: pick one folder and work only on it.
4. **Backlog mode** (Erik's "practice", clarified 2026-09-01): a deck he hasn't touched in months
   has a huge pile *already due* — he wants to grind through all of a deck's slated reviews,
   ignoring the daily session size. These are genuinely due cards, so they are **normal SM-2
   reviews** (rate → reschedule); no special scheduling semantics needed.
   A true due-agnostic shuffle mode is deferred (would have to be log-only, see watchlist).

## Design

### Two orthogonal layers

- **Scheduler (unchanged):** SM-2 decides *when* each card is due. The mixer never rewrites intervals.
- **Mixer (new, server-side):** decides *which* cards enter today's session. Moves queue-building
  from the client to the API — with 12k cards the current `GET review/queue` (all cards + states)
  becomes a multi-MB payload; the session endpoint returns only the dealt cards.

### API

`POST /api/v1/review/session`
```jsonc
{
  "size": 100,                     // target cards this session
  "mode": "scheduled" | "focus" | "backlog",
  "folder_id": "…",               // focus mode only
  "mix": [                         // scheduled/practice; omit → saved default mix
    { "folder_id": "…", "pct": 30 },
    { "folder_id": null, "pct": 20 }   // null = unfiled
  ]
}
→ { cards: [...only the dealt cards, with states], meta: { per_folder: {due, new, dealt} } }
```
`GET /api/v1/review/queue` stays for backward compat (extension/macOS) but the webapp moves to
sessions.

### Selection algorithm (scheduled mode)

For each folder: quota = size × pct. Fill order **due (oldest due first) → learning → new**, with
new cards capped by that folder's `new_per_day`. If a folder can't fill its quota, the deficit is
**redistributed** to the other folders in proportion [D3]. Deal order: weighted-random interleave so
no folder runs in streaks; persist the dealt list in the existing sessionStorage session.

Focus mode: one folder, quota = size. Backlog mode: one folder, **no size cap** — deal every due
card (oldest first, batched by 50 per request so payloads stay small); the UI shows "n of N due"
progress. New cards excluded in backlog mode unless asked for.

### Backlog reviews are ordinary reviews [D1 — revised 2026-09-01]

Backlog mode deals cards that are already due, so every rating is a normal SM-2 review
(state upserted, log written). The earlier "practice = log-only" rule now applies only to the
deferred due-agnostic mode: if we ever deal cards *before* they are due, those go through
`review_mode: 'practice'` and skip the state upsert (SM-2 has no early-review correction).

### Budgets: reviews vs introductions [D2]

"100 cards/day" is the **session size** (mostly due cards). **New-card introduction** stays a
separate, smaller budget — per folder (`folders.new_per_day`, default 5–10). Without this split,
importing Spanish means sessions full of first-sight words at ~1-day intervals: high volume, low
retention. Introduction rate is the real throttle on a 10k deck.

### Schema

```
folders      + weight int          -- default mix percentage (null = excluded from default mix)
             + is_paused boolean   -- paused folders never enter sessions or counts
             + new_per_day int     -- per-folder introduction budget (null = user default)
user_study_settings                -- becomes the server-side home of review config (today it's
             session_size int      -- localStorage, per browser — migrate it here)
             (reuse existing new_cards_per_day as the global default)
```
Saved mix = folder weights; ad-hoc mixes are request-scoped. Presets ("mixes" table) deferred.

### UI

Review page header: mode toggle (Scheduled · Focus ▾folder · Practice), session size, and a mix
editor (per-folder sliders with due/new counts beside each, "pause" toggle). Settings page:
defaults (session size, global new/day). Per-folder counts come from the session meta.

## Import (phase 2, after mixer ships)

Verified against the live Mochi account (key valid 2026-09-01):

**Investigated 2026-09-01 — import from the LOCAL ANKI COLLECTION, not Mochi.** The "blank"
Mochi cards are not broken: they are Anki-style template cards. `content` is empty because the card
text lives in named `fields` (Artwork = `![](@media/377.jpg)`, Artist, Title, Date, Movement,
Medium, Note) and the question/answer layout lives in a per-subdeck template
(e.g. "Art - Artist?" = front `Artist?` + artwork image, back Artist / "Title" / (Date) / Note).
Three templates over the same 651 notes produce the three subdecks. Mochi renders these fine, but
its API 404s on the `@media` attachments, and Mochi renamed the files on import — so Mochi is a bad
export source. The **local Anki collection has everything under original names**:
`collection.anki2` notes carry `<img src="2014-08-31_182145.jpg">` + all text fields, and the files
are in `collection.media/` (35,548 files, 1.2 GB).

- **Great Works of Art**: read the 651 notes from Anki (deck ids 1667589475433/4/5), build the three
  question directions from the templates above, upload each note's image once to Blob
  (`anki-media/<file>` — ~651 images, shared across the 3 folders), set `image_url`.
- **Essential Spanish Top 5000** (~10k): Anki note = `word (pos) · picture · translation ·
  [sound:….mp3] · frequency-rank`. Import word→translation (and picture → Blob); **drop the audio**
  (Pluckk has no player) and keep the frequency rank as a tag so introduction order can follow
  frequency. Audio support is a separate icebox item.
- Import lands each deck in its own folder with `is_paused = true` — invisible until Erik flips it
  on with a proportion.
- **Do not import Anki review history** (only ~500 cards ever reviewed; Great Works ≈246). Fresh
  `new` state is cleaner; the introduction budget handles pacing.

## Decisions taken (defaults — Erik can override)

- **[D1] Backlog mode = normal reviews** (cards are due; full reschedule). Due-agnostic shuffle deferred; if built, it is log-only.
- **[D2] Session size and new-card budgets are separate**; new/day is per folder.
- **[D3] Quota deficit redistributes** to other folders (session always reaches `size` when cards exist).
- **[D4] Review config moves server-side** into `user_study_settings` (today's localStorage value
  migrates on first load).
- **[D5] Paused folders** are fully inert (no due counts, no sessions) until unpaused.

## Also considered / watchlist

- Backlog display: per-folder due counts in the mix editor make vacation pile-ups visible.
- Extension side panel and macOS keep using the plain queue; mixer is webapp-first.
- `GET /api/v1/cards` (library) needs pagination once >2k cards; separate small task.
- Blob budget: ~651 art images + Spanish pictures ≈ low hundreds of MB — within Blob free allotment; verify before Spanish.
- Activity grid: practice reviews counted, badged separately (`review_mode`).

## Steps

1. Schema: folder columns + settings columns; `db:push`.
2. API: `POST /api/v1/review/session` (+ practice logging path in `POST /review`).
3. Webapp: mode toggle + mix editor + server-backed settings; session flow unchanged.
4. Smoke tests for the selector (quotas, spillover, pause, practice-no-mutation).
5. Phase 2: one-off Anki importer script (`scripts/import-anki.ts`: reads collection.anki2 +
   collection.media directly) → import GWoA (3 paused folders), verify, then Spanish (paused,
   frequency-ordered introduction).
