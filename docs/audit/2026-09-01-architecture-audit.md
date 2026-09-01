# Pluckk — architecture audit

**Date:** 2026-09-01 · **Scope:** the whole monorepo (152 files, ~31.8k LOC) as it stands after the Neon migration, the review mixer, and the Anki imports. Facts come from a full structural inventory; judgments are mine.

---

## 0. The verdict in one paragraph

Pluckk is a **card-authoring engine wearing a spaced-repetition body**. The thing that is genuinely yours — the part no other app has — is the middle of the pipeline: *highlight → context → LLM → cards with pedagogical taste*. Everything on either side of that (capture plumbing, scheduling, library, review UI) is commodity that Anki, Mochi and a dozen others do adequately. Yet the codebase's weight is inverted: the generator is ~150 lines of prompt duplicated in three places with no tests and no way to measure quality, while ~20k lines are spent on three separately hand-built front-ends, a SaaS scaffold (billing, onboarding, public profiles) for a product with one user, and a Mac client pointed at a database that no longer exists. The good news is that the *spine* is sound — one API, one Postgres schema, a pure scheduler module, a consistent visual language — so this is a reorganization problem, not a rewrite.

---

## 1. What is this software actually trying to do?

Read the artifacts rather than the README. The README says "browser-native spaced repetition." The `docs/cardProblems/` notes — the most carefully written prose in the repo — say something sharper. Every one of the four problem write-ups is about *the quality of a question*: list-recall vs discriminative, atomicity, buried insight, contrast, mental hooks, misinterpreted concepts. The icebox's most developed items are the same theme: card-quality feedback loop, user-preference model, phrasing variations, comparison cards. Nobody writes 150 lines about why "What are typical applications of RNNs?" is a bad card unless the bad card is the thing that hurts.

So the honest thesis is:

> **Turn what I read into questions worth remembering — automatically, in my voice, at my level — and then make sure I actually remember them.**

Three things follow from taking that seriously:

1. **The generator is the product.** Its prompt, its persona logic, its card styles, its quality loop — these are the IP. They should be the most tested, most versioned, most observable code in the repo. Today they are the least.
2. **The scheduler is a utility.** SM-2 vs FSRS matters far less than whether the cards are good. It should be small, pure, server-owned, and boring. Today it is pure (good) but client-owned and duplicated incompatibly in Swift (bad).
3. **The clients are windows, not products.** Extension, web, macOS should each be the thinnest thing that lets you *capture* or *review*. Today each re-implements domain logic (card expansion, activity grids, settings, auth) in its own dialect.

Two tensions have shaped the code without anyone deciding them:

- **SaaS vs private tool.** The code was built as a multi-tenant product (Stripe, usage tiers, onboarding wizard, usernames, public profiles, social features in the icebox). It is used by one person. The migration removed the billing *backend* but every client still carries the scaffolding. This is a decision to make explicitly, not a cleanup to do incidentally.
- **Schema ambition vs implemented behavior.** The database knows about numeric/interval answers, calibration statistics, FSRS stability/difficulty, algorithm configs, study sessions. No client reads any of it. The schema is a wish list; the app is SM-2 with four buttons. That gap is fine *if it is labelled* — today it reads as capability that exists.

And one recent shift changes the shape: importing Great Works (645 cards) and Spanish (4,972) turned Pluckk from "my highlights" into "my whole learning practice." The mixer was the first consequence. The absence of a *note → cards* relationship (why the art deck needed three folders) is the next one waiting.

---

## 2. How it is enacted today

### 2.1 The shape

| Package | LOC | Role | Health |
|---|---|---|---|
| `api` | 5.3k (1.2k is dead SQL) | Vercel functions, Drizzle schema, mixer, prompts | **Good spine.** One auth seam, one schema, one router. Ad-hoc outside `v1.ts`. |
| `shared` | 1.2k | scheduler, API client, constants, utils | **Right idea, half-used.** Barrel + `types/` unreachable; 73% of `prompts.ts` duplicated into `api`. |
| `webapp` | 9.9k | React review/library/settings | **Works; over-typed and prop-drilled.** 612-line type file, 1,188-line Settings page, three dead files. |
| `extension` | 9.4k | MV3 capture + side panel | **The 2,210-line problem.** `sidepanel.ts` = 54 DOM handles + 19 mutable globals + all domain logic. Popup (800 LOC) unreachable. |
| `macos` | 6.0k Swift | native capture/review | **Dark.** Talks to the paused Supabase DB with a hardcoded key and an incompatible SM-2. |

Build/QA posture: **zero tests, zero lint, zero CI.** `typecheck` exists for `api` only (~20% of TS). `index.html` references `/src/main.jsx`; the file is `main.tsx` (works by Vite's leniency). The accurate `CLAUDE.md` lives in `.claude/`, which is **gitignored**; the tracked root `CLAUDE.md` describes a 2024 Mochi-only extension with the wrong hotkey.

### 2.2 Findings, by theme

**A. Card semantics live in the wrong layer.**
- `qa_bidirectional → 2 cards` and `cloze_list → N+1 cards` are expanded in the side panel (`sidepanel.ts:575–633`) *by reading edited values out of the DOM*, and again in Swift (`CardGenerationView.swift:417–455`). The API never sees the composite; the sibling relationship is lost at save.
- There is **no note/card distinction**. A source capture produces N unrelated rows. This blocks: art-style multiple directions in one deck, phrasing variations (icebox), "regenerate from source," and review chat grounded in the original context.
- `GeneratedCard.tags` is an **object** in the API and a **string[]** in the extension. Five definitions of `Card`, four of `Folder`, five of `User`; the webapp's `Card` silently omits 10 fields the API returns.

**B. The generator is scattered and unmeasured.**
- The live system prompt is a template literal inside `generate-cards.ts`. `shared/constants/prompts.ts` holds a copy with a "should match" comment. `api/lib/prompts.ts` is a byte-copy of the persona builder (12 comment lines differ).
- The extension's options page lets a user override the *entire* system prompt — and `background.ts:243` sends it whenever it differs from the bundled default, so a stale extension build silently discards persona and format rules on the server.
- Refinement, vision, and answer-question prompts are inline in their routes. No prompt is versioned; no generation is logged; `cardProblems/` cannot be turned into a regression test because there is nothing to run it against.

**C. Three front-ends, each hand-built, each drifting.**
- Sand animation ×3 (686 LOC). Activity grid ×2, and they bucket days differently (extension uses local dates, webapp uses UTC — the two grids disagree for a US user after 4 pm PT). Shuffle ×3 (one biased). `escapeHtml` ×2. Mochi client ×4, two of them sending the user's Mochi key **from the browser**. Username validation ×2 + a third rule in SQL. Settings UI ×2 in the extension alone (options page vs drawer).
- `sidepanel.ts` has one network call and 37 event listeners; `sendToMochi()` is 146 lines doing DOM read → message loop → error aggregation → DOM write → close policy.
- The 401-line `onMessage` listener in `background.ts` inlines the whole save transaction.

**D. SaaS scaffolding for a private tool.**
- Backend returns `isPro: true` and `remaining: 'unlimited'`; every client still renders usage bars, "Upgrade to Pro," "Manage subscription," and the extension still throws `usage_limit_reached` in five places for an error the server can no longer emit. `privacy.html` tells users Stripe processes their payments. macOS says the free tier is 20; the extension says 0.
- 601-line onboarding wizard, usernames + 51 reserved names, public profile pages, feedback table — all built for users who don't exist.

**E. Scheduling trust and duplication.**
- `POST /review` writes whatever `new_state` the client sends. The webapp computes SM-2 honestly; macOS computes a *different* SM-2 (0–5 quality, no learning phase, wrong column name). Any client can corrupt review state.
- Numeric/calibration/FSRS columns: zero readers.

**F. Hygiene.**
- Dead: `popup/` (~800 LOC, built into dist), `ActivityPage`, `FeedbackModal`, `ProfileHeader`, `shared/src/index.ts` + `types/`, `saveToSupabase` message, `getAuthStatus`, `@crxjs/vite-plugin` dep, `import-supabase.ts`.
- Two roadmap systems (`/roadmap`, 38 files; `/docs/roadmap`) with an identical 2,224-line TypeScript-migration tree in both; `docs/roadmap/active/` is a byte-copy subset of `completed/`.
- Committed credential: `Config.swift:14` (Supabase anon key for a paused project — harmless now, a habit to end).
- CORS `*` with bearer auth; content script calls the API on every page load (`<all_urls>`) for annotations.

### 2.3 What is right, and should be protected

- **One data path.** Every client → one API → one Postgres. Authorization is explicit `where user_id =` everywhere. This was hard to get and is the foundation for everything below.
- **`shared/scheduler`** is pure, small, versioned (`ALGORITHM_VERSION`), and has no I/O. It is the model for what the generator should look like.
- **The mixer** is a pure function (`lib/mixer.ts`) with a real test (`smoke-mixer.ts`, 12 checks). Same pattern, worth spreading.
- **The design language** (Scandinavian minimal, sand animation, the card) is consistent and good across surfaces — the *feel* is a product asset even where the code isn't.
- **`review_logs`** is a proper immutable event log with before/after state. It is the raw material for every future quality metric.

---

## 3. What should change

Three horizons. Each is independently valuable; together they invert the codebase toward its thesis.

### Horizon A — Cut (days, mostly deletion)

Decide **private-first** and act on it:

| Remove | Where | Why |
|---|---|---|
| Stripe / usage / Pro / free-tier UI and errors | extension (sidepanel, options, background), webapp (`useProfile`, privacy copy), macOS | Server can't produce them; they're lies in the UI |
| Onboarding wizard, usernames, reserved names, public profiles, feedback form | webapp + api + schema | SaaS-only features; keep the learning-profile *fields* (they feed the persona prompt) |
| `popup/`, dead pages/components, `shared/src/index.ts`+`types/`, `saveToSupabase`, `@crxjs` dep | extension, webapp, shared | Unreachable |
| `/roadmap` tree, `docs/roadmap/active/` dupes, `api/migrations/*.sql` (→ `docs/history/`) | docs | Two roadmap systems is one too many |
| `packages/macos`: delete review mode, card browser, SM-2, Pro/usage UI, hardcoded key | macos | Thin capture client only (see C4); the port itself is a B-horizon item |
| Root `CLAUDE.md` content → replaced by `.claude/CLAUDE.md`; un-ignore `.claude/CLAUDE.md` | repo | The accurate guidance must be the tracked one |
| One extension settings surface (kill the drawer *or* the options page) | extension | Same settings implemented twice |

### Horizon B — Consolidate (a few weeks of focused work)

1. **`packages/core`** (rename `shared`, make it Node-consumable with a real build): domain types generated from the Drizzle schema (camel) plus one snake wire type per table; the scheduler; **card-style expansion** (`expandGeneratedCards`); **all prompt builders** (single source; the API imports them); formatting helpers. Delete every duplicate listed in §2.2.C.
2. **Server owns the domain.** `POST /cards` accepts *generated* composites and expands them; `POST /review` accepts a **rating**, computes SM-2 server-side, returns the new state and the four previews. Clients stop carrying algorithms. macOS (if revived) becomes a thin client for free.
3. **Extension side panel → modules.** `state.ts` (a small store), `render/*.ts`, `actions/*.ts`; DOM handles resolved once in `dom.ts`. Or adopt Preact — the side panel is already a component tree pretending to be a script. Typecheck it.
4. **Webapp: one data layer.** `@tanstack/react-query` over `@pluckk/core/api`; delete prop-drilling from `App.tsx`; delete `types/hooks.ts` duplicates in favour of core types; split `SettingsPage` (Mochi import → own page).
5. **API consistency.** The file-based routes adopt the `authed()` + method wrapper from `router.ts`; Mochi calls server-only; CORS allowlist instead of `*`.
6. **Tooling floor.** `vitest` on core (scheduler, mixer, expansion, prompt builders — the first three already have test-shaped code); `typecheck` in every package; eslint; one GitHub Action: typecheck + test + build on PR. Drizzle `generate/migrate` instead of `push` now that data is real.
7. **Fix the two grids** (one `formatDateLocal` in core) and `index.html`'s `main.jsx`.

### Horizon C — Turn it inside out (the strategic reframe)

**C1. Make the generator a first-class, versioned, evaluated module.**
`core/generator/` with: prompt templates as files (`system.v3.md`, `persona.ts`, `refine.ts`, `vision.ts`), a `PROMPT_VERSION` written onto every card (`cards.generator_version` — the analogue of `ALGORITHM_VERSION`), a **golden set** built from `cardProblems/` (source → bad card → reconstructed card) that `vitest` runs against the live prompt with an LLM-judge rubric, and **generation traces** (`generations` table: source context, prompt version, raw output, what the user kept/edited/deleted — `source_context` already exists; this closes the loop). This is what makes "Card Quality Feedback Loop" and "User Preference Model" buildable instead of aspirational. It is the highest-leverage change in this document.

**C2. Adopt the note → cards model.**
`notes` (source selection, context, URL, title, generator version, kind) → `cards` (`note_id`, `direction`/`variant`). Great Works becomes one deck whose cards carry `direction ∈ {artist, title, period}`; bidirectional pairs know each other; phrasing variations hang off the note; "regenerate this card from its source" and review-chat-with-context become one query. The import scripts already hold the data to backfill this.

**C3. Let the scheduler earn its keep — server-side, and probably FSRS.**
Once scheduling is server-owned (B2), swapping SM-2 for `ts-fsrs` is a contained change; the columns already exist. The concrete payoff for *you* is the backlog: FSRS computes retrievability per card, so "All 42 due" can be ordered by *what you're about to forget* rather than by due date, and session size can be framed as a retention target. For one user SM-2 is adequate; FSRS is the upgrade that matters at 5,000-card scale.

**C4. Choose the client story: capture at two doors, review at one.** (Revised 2026-09-01 after Erik's note that he captures from Notion desktop and other native apps.) The extension captures *inside Chrome* with rich context (URL, DOM context, CSS selector for re-highlighting and deep links). The macOS app captures *everywhere else* — `⌘⌘` → Accessibility selection → floating panel — the Wispr Flow shape it already has. It should be **ported now, thin**: keep the hotkey, selection reader, panel and generation view (~55%); delete its review mode, card browser, SM-2 and Free/Pro UI (~45%); swap Supabase auth for Google id_token → `/api/v1/auth/google` and PostgREST for `/api/v1/cards`. The webapp is the single review surface — and, as a PWA, the phone surface. Two capture clients, one review client, one core.

**C5. Say what Pluckk is.** Private-first; users = you and people you invite. Auth stays (needed for the extension anyway), everything social goes. That single decision retires ~3k LOC and every awkward "isPro" branch.

---

## 4. If I were sequencing it

1. **Horizon A in one sitting** (it is mostly `git rm`), plus the CLAUDE.md swap and the `.claude` gitignore fix. Immediate clarity, zero risk.
2. **macOS thin port** — auth + `/api/v1/cards`; ~one session of Swift plus an Xcode build. Restores system-wide capture.
3. **B1 + B2** — core package, server-side expansion and scheduling. This is the structural pivot; everything else gets easier after it.
4. **C1** — generator module + golden set + traces. Start with the four `cardProblems` as tests; add a case each time a bad card annoys you.
5. **B3/B4** — side panel and webapp refactors, now against a stable core.
6. **B6** — tests/lint/CI, ratcheted rather than big-bang.
7. **C2, C3** — notes model, FSRS — when the generator work has produced enough cards that scheduling quality becomes the bottleneck.

The one-line summary: **move the domain into a tested core, put the generator at the centre of it, and let every client become thin.**
