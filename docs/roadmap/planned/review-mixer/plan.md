# Review mixer: deck-scoped, proportion-controlled review sessions

**Status:** planned 2026-09-01 · prerequisite for importing the Mochi/Anki decks
**Context:** Pluckk has 307 curated cards in one global review queue. Erik wants to import
Great Works of Art (1,953 cards, 3 subdecks) and Essential Spanish Top 5000 (~10k) from Mochi
(both already live there; key verified). A global queue would be drowned, so review must become
deck-aware first. Erik's requirements, verbatim in spirit:

1. Cards live in folders (exists) and review can be **scoped**.
2. A **daily session target** (e.g. 100 cards) with **per-folder proportions** ("10% from this,
   30% from that").
3. **Focus mode**: pick one folder and work only on it.
4. **Practice mode**: due-agnostic — just deal N interleaved cards under the same proportion
   constraints, ignoring due dates.

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
  "mode": "scheduled" | "focus" | "practice",
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

Practice mode: same quotas, but sampled uniformly at random from **all** cards in the folder
(due-ness ignored). Focus mode: one folder, quota = size.

### Practice reviews don't touch the schedule [D1]

`review_logs.review_mode` already exists (`'standard'` default). Practice submissions post
`review_mode: 'practice'`; the API logs them but **does not upsert `card_review_state`**. Rationale:
SM-2 has no early-review correction — multiplying an interval that hasn't elapsed inflates schedules
and corrupts retention data. Practice is extra exposure, not evidence for scheduling. (Revisit if we
adopt FSRS, which handles early reviews natively.)

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

- **Great Works of Art** (Artists 651 · Titles 651 · Periods 651): **template cards — `content` is
  empty.** Data is in `fields` (painting image `![](@media/377.jpg)`, artist, title, date,
  movement) + `template-id`. The current importer parses only `content` → would import blanks.
  Work: fetch the deck's template to learn which fields are front/back per subdeck, build Q/A from
  fields, **download `@media/` attachments** (Mochi `GET /cards/{id}/attachments/{name}`) → Vercel
  Blob → `image_url`. ~651 images (the three subdecks share them; dedupe by filename).
- **Essential Spanish Top 5000** (~10k): inspect one card first — likely template cards too, and the
  source Anki deck ships **audio**, which Pluckk has no player for. Plan: import text fields, drop
  audio (note it in tags), consider audio support later.
- Import lands each deck in its own folder with `is_paused = true` — invisible until Erik flips it
  on with a proportion.
- **Do not import Anki review history** (only ~500 cards ever reviewed; Great Works ≈246). Fresh
  `new` state is cleaner; the introduction budget handles pacing.

## Decisions taken (defaults — Erik can override)

- **[D1] Practice mode is log-only** (no schedule mutation).
- **[D2] Session size and new-card budgets are separate**; new/day is per folder.
- **[D3] Quota deficit redistributes** to other folders (session always reaches `size` when cards exist).
- **[D4] Review config moves server-side** into `user_study_settings` (today's localStorage value
  migrates on first load).
- **[D5] Paused folders** are fully inert (no due counts, no sessions) until unpaused.

## Also considered / watchlist

- Backlog display: per-folder due counts in the mix editor make vacation pile-ups visible.
- Extension side panel and macOS keep using the plain queue; mixer is webapp-first.
- `GET /api/v1/cards` (library) needs pagination once >2k cards; separate small task.
- Blob budget: ~651 art images ≈ tens of MB — fine.
- Activity grid: practice reviews counted, badged separately (`review_mode`).

## Steps

1. Schema: folder columns + settings columns; `db:push`.
2. API: `POST /api/v1/review/session` (+ practice logging path in `POST /review`).
3. Webapp: mode toggle + mix editor + server-backed settings; session flow unchanged.
4. Smoke tests for the selector (quotas, spillover, pause, practice-no-mutation).
5. Phase 2: template-aware Mochi import with media → import GWoA (paused), then Spanish.
