# Pluckk: Supabase → Vercel + Neon migration

**Status:** planned 2026-08-28 · **Blocked on:** inputs from Erik (see §4)
**Context:** Supabase project `grjkoedivfrjlbtfskif` (us-west-2) is paused; Supabase free tier allows 2 active projects and pauses after 7 idle days. Decision: Pluckk moves to the house stack (`projects/templates/vercel-neon-starter/`), Supabase is reserved for PressRun. Pluckk stays a public web app with Google login, few users.

## 1. Target architecture

| Today | After |
|---|---|
| Supabase Postgres (cards, card_reviews, decks, users) | Neon Postgres via Vercel Marketplace, Drizzle schema |
| Supabase Auth (Google OAuth) + JWT in extension | Auth.js Google provider; extension gets a per-user API token |
| Supabase Storage (diagram images) | Vercel Blob |
| RLS + `supabase-js` from browser | All data access through `packages/api` routes (auth’d by Auth.js session or API token) |
| Two Vercel projects (`pluck`, `pluckk-api`) | Same two projects; only the data layer changes. (Merging into one Next app is optional, later.) |
| Stripe / usage limits | Removed for now — few users, no billing |

## 2. Steps

**Phase A — capture (needs Supabase restored + DB URL)**
1. Erik restores the project in the Supabase dashboard.
2. `pg_dump --schema-only` and `pg_dump --data-only` of `public.*` plus `auth.users(id,email)` into `packages/api/migration/` (git-ignored dump, committed schema).
3. Download Storage bucket objects (diagram images) to `migration/images/`.
4. Record row counts per table for the post-migration check.

**Phase B — schema (no inputs needed once A is done)**
5. Write `packages/shared/src/db/schema.ts` in Drizzle from the dumped DDL: `users`, `cards`, `card_reviews`, `decks` + Auth.js tables. Map `auth.users.id` → new `user.id` (keep UUIDs so `cards.user_id` stays valid).
6. `vercel integration add neon` on the `pluckk-api` project (browser consent by Erik once), `vercel env pull`, `db:push`.
7. Import data with `psql` from the dump (schema-name rewrite `auth.users` → `user`), verify counts.
8. Upload images to Blob; rewrite `cards.image_url`.

**Phase C — code**
9. `packages/api`: replace Supabase client with `getDb()`; add routes the webapp currently does via `supabase-js` (list due cards, save review, CRUD cards/decks). Delete Stripe/usage-limit code.
10. Auth: Auth.js in the API (Google). Session cookie for the webapp; a `user_api_tokens` table + `Authorization: Bearer` for the extension.
11. `packages/webapp`: swap `supabase-js` calls for `fetch('/api/…')`; login button → Auth.js.
12. `packages/extension`: replace Chrome-Identity/Supabase flow with "paste API token" in options (token shown on the webapp settings page).
13. `packages/macos`: same token model (check what it currently uses).
14. Update `docs/README.md` and `.claude/CLAUDE.md` (already stale — describes the Mochi-only v1).

**Phase D — cut over**
15. Deploy both projects, smoke-test create → review → SM-2 interval update on prod.
16. Leave Supabase paused for 30 days as rollback, then delete.

Estimate: A+B ≈ one session; C ≈ one to two sessions; D ≈ an hour.

## 3. Verification
- Row counts equal pre/post per table.
- A card created via the extension appears in the webapp and gets a `next_review` after rating.
- `curl https://pluckk-api.vercel.app/api/cards` → 401 without token, 200 with.
- Images render from Blob URLs.

## 4. Inputs needed from Erik
1. **Restore** the `pluckk` project in the Supabase dashboard (Project → Restore).
2. **Database connection string** (Supabase → Project Settings → Database → URI, "session" mode) — for `pg_dump`. Put it in `packages/api/.env.migration` (git-ignored); do not paste in chat.
3. **Google OAuth client ID + secret** for Auth.js. Either reuse the client Supabase used (Google Cloud Console → add redirect URI `https://pluckk.app/api/auth/callback/google`) or create a new one. Into Vercel env via `vercel env add`.
4. **One click** on the Neon consent screen when `vercel integration add neon` opens the browser.
5. **Decision:** keep two Vercel projects (`pluck` + `pluckk-api`) or merge into a single Next.js app from the template. Default if no answer: keep two (less churn).
6. **Decision:** keep the macOS app in scope now, or leave it on the old flow until later. Default: leave it.

## 5. Capture done (2026-08-28)
REST dump at `projects/_migration/supabase-dumps/pluckk/` (15 tables, 3 auth users, 200 images in `card-images`). The live schema is well beyond `docs/README.md`: `cards` (307) carries numeric/interval answers + source anchoring; `card_review_state` (90) and `review_logs` (395) support SM-2 **and FSRS** (`stability`, `difficulty`, `fsrs_weights` in `algorithm_configs`); `folders`, `study_sessions`, `user_study_settings`, `user_calibration_stats`, `reserved_usernames`, `feedback`; plus what look like views/rollups (`public_user_cards`, `card_difficulty_ranking`, `user_daily_review_summary`, `user_daily_card_summary`). Phase B must derive the Drizzle schema from `openapi.json` + a `pg_dump --schema-only` (still wanted: connection string → `_migration/pluckk.pgurl`) to tell tables from views and recover the DB functions the rollups depend on.
