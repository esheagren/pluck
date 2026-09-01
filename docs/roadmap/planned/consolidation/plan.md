# Pluckk forward plan — September 2026

Derived from `docs/audit/2026-09-01-architecture-audit.md`. Each phase is a separate PR; each ends with the app
deployed and usable. Erik's touches are marked **[Erik]**; everything else is Claude's.

## Phase 0 — Close out what's open (this week, ~1 hour of Erik's time)

1. **[Erik]** Merge PR #4 (migration + mixer + imports + audit) into `feat/keyboard-shortcuts-help`, then into `main`.
2. **[Erik]** Reload the extension from `packages/extension/dist`, sign in, save one card → confirm it lands on pluckk.app.
3. **[Erik]** Give Art · Artists a Mix % in Settings (or just use Focused Review) — start the art deck for real.
4. Supabase project `grjkoedivfrjlbtfskif`: leave paused until ~Oct 1, then delete. (Calendar note.)

**Decisions (Erik, 2026-09-01): D-A yes · D-B yes · D-C yes.**
- D-A **Private-first.** Yes = delete onboarding, usernames, public profiles, feedback form, all Pro/usage UI. (Recommended.)
- D-B **macOS = thin capture client.** Yes = port now; delete its review/browser. (Recommended, per the Notion use case.)
- D-C **Scheduler: stay SM-2 for now, FSRS after the notes model.** (Recommended; revisit when the backlog feels wrong.)

## Phase 1 — Cut (one session) — ✅ DONE 2026-09-01, commit 68cf44a (111 files, −7,754 lines)

Horizon A of the audit, executed as one PR of deletions:
Stripe/usage/Pro remnants in every client · onboarding wizard · usernames/reserved/public profiles/feedback ·
`popup/` · dead pages/components · `shared/src/index.ts` + `types/` · `saveToSupabase` · `@crxjs` ·
`/roadmap` legacy tree · `docs/roadmap/active/` dupes · `api/migrations/*.sql` → `docs/history/` ·
root `CLAUDE.md` replaced by the accurate one and `.claude/CLAUDE.md` un-ignored · one extension settings surface ·
`index.html` main.jsx · the two activity grids on one date helper.
Exit: everything still deploys; ~4–5k LOC gone; privacy page tells the truth.

## Phase 2 — macOS thin port — ✅ CODE DONE 2026-09-01 (compiles under Xcode 26.3; **[Erik]** run it once + test on Notion)

Keep `⌘⌘` detector, Accessibility reader, panel, generation view, login/settings. Delete review, browser, SM-2,
Pro UI, hardcoded key. Auth → `ASWebAuthenticationSession` opens `pluckk.app/auth/desktop`, the web app runs Google sign-in and
redirects to `pluckk://auth/callback#token=…` (no new Google client needed); data → `/api/v1/cards`,
`/api/generate-cards`, Mochi decks via `/api/import-from-mochi` (key stays server-side). **[Erik]** test on Notion desktop (Electron selected-text caveat).
Exit: `⌘⌘` in any app saves a card to Neon.

## Phase 3 — Core + server-owned domain (two to three sessions)

`packages/core` (types from schema + wire types, scheduler, `expandGeneratedCards`, all prompt builders,
helpers) with a real build so the API imports it. `POST /cards` expands composites server-side; `POST /review`
takes a rating and computes SM-2 server-side (returns state + previews). File-based API routes adopt the
`authed()`/method wrapper; Mochi calls server-only; CORS allowlist. `vitest` on core (scheduler, mixer,
expansion, prompts); `typecheck` in every package; eslint; one GitHub Action. Drizzle migrations instead of push.
Exit: clients carry no algorithms; CI is green; every duplicate in audit §2.2.C is gone.

## Phase 4 — The generator as the product (two sessions, then ongoing)

`core/generator/`: prompt files with `PROMPT_VERSION` stamped on cards; golden set from the four
`cardProblems/` (source → bad → reconstructed) run by `vitest` with an LLM judge; `generations` table
(source, prompt version, raw output, kept/edited/deleted). Then the loop Erik actually wants: each annoying
card becomes a test case; prompt changes are measured, not felt.
Exit: a prompt change can be evaluated before it ships.

## Phase 5 — Client refactors (one session each)

Side panel into modules (or Preact) and typechecked; webapp on react-query with core types, `SettingsPage`
split; PWA manifest + offline review queue so the phone is a real review surface.

## Phase 6 — Notes → cards, then FSRS (when the card count makes scheduling the bottleneck)

`notes` table + `cards.note_id`/`direction`; backfill from the Anki importer (art directions become one deck);
bidirectional pairs and phrasing variations hang off notes. Then `ts-fsrs` server-side; backlog ordered by
retrievability.

## Working agreement

- Every phase ships to production behind a PR; nothing waits for "the big refactor."
- Claude runs the smoke suites (`npm run smoke`, `smoke-mixer`) before every API deploy and browser-verifies the webapp.
- Erik's involvement per phase: Phase 0 (an hour), Phase 2 (Xcode + one test), otherwise decisions only.
