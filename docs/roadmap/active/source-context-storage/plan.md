# Source Context Storage Implementation Plan

**Status:** In Progress
**Created:** 2026-01-22
**Started:** 2026-01-22

## TL;DR
Persist the highlighted text (`selection`) and surrounding context (`context`) when a card is saved, enabling future features like Review Chat Interface and card generation QA.

## Critical Decisions

- **Storage location:** Add two new columns to `cards` table (`source_selection` and `source_context`) rather than a separate table. The data is 1:1 with cards and small (<2KB typical).
- **Nullable columns:** Both fields are nullable since existing cards won't have this data, and image-generated cards may not have traditional selection context.
- **No migration of existing cards:** Historical cards will have `null` for these fields. This is acceptable since the context was never captured.
- **Page title storage:** Also add `source_title` column since it's already captured but not persisted, and is useful for display/search.

## Tasks

**Overall Progress:** 90%

- [x] **Step 1: Database Migration**
  - [x] Create migration `007_source_context.sql` adding three columns to `cards` table:
    - `source_selection TEXT` (the exact highlighted text)
    - `source_context TEXT` (surrounding ~500 chars with `[[SELECTED]]` markers)
    - `source_title TEXT` (page title)
  - [ ] Run migration in Supabase

- [x] **Step 2: Update TypeScript Types**
  - [x] Update `CardRow` in `packages/shared/src/supabase/types.ts` with new fields
  - [x] Update `SaveCardOptions` interface if needed

- [x] **Step 3: Update Supabase Client**
  - [x] Modify `saveCard()` in `packages/shared/src/supabase/client.ts` to accept and persist new fields
  - [x] Add optional `sourceSelection`, `sourceContext`, `sourceTitle` params

- [x] **Step 4: Update Extension Message Types**
  - [x] Add new fields to `SendToMochiMessage` in `packages/extension/src/types/messages.ts`

- [x] **Step 5: Pass Context Through Sidepanel**
  - [x] In `sidepanel.ts`, include `cachedSelectionData` fields when calling `sendToMochi`
  - [x] Pass `selection`, `context`, and `title` from cached data

- [x] **Step 6: Update Background Worker**
  - [x] Modify `sendToMochi` handler in `background.ts` to forward new fields to `saveCard()`

- [x] **Step 7: Update API (if applicable)**
  - [x] Check if `/api/send-to-mochi` needs updates (No - Supabase save happens in extension)

## Relevant Files

- `packages/api/migrations/007_source_context.sql` - New migration (to create)
- `packages/shared/src/supabase/types.ts` - Add new fields to `CardRow`
- `packages/shared/src/supabase/client.ts` - Update `saveCard()` signature and body
- `packages/extension/src/types/messages.ts` - Update `SendToMochiMessage`
- `packages/extension/sidepanel/sidepanel.ts` - Pass cached selection data to message
- `packages/extension/src/background.ts` - Forward new fields in `sendToMochi` handler

## Data Flow (After Implementation)

```
Content Script captures:
  - selection (highlighted text)
  - context (500 chars surrounding with markers)
  - url
  - title

  ↓ all four sent to background

Background caches in memory for regeneration
  ↓ passed to sidepanel via response

Sidepanel caches as `cachedSelectionData`
  ↓ when user clicks "Store"

sendToMochi message now includes:
  - question, answer (from generated card)
  - sourceUrl
  - sourceSelection ← NEW
  - sourceContext ← NEW
  - sourceTitle ← NEW

  ↓

Background calls supabase.saveCard() with all fields
  ↓

Supabase `cards` table stores everything
```

## Testing Plan

- [ ] Create a card from highlighted text, verify all three new fields are populated in Supabase
- [ ] Create a card from a screenshot, verify new fields are `null` (expected)
- [ ] Create a card from question mode, verify fields are handled appropriately
- [ ] Verify existing cards continue to work (null values for new fields)
- [ ] Verify bidirectional and list cards store context correctly (one context shared across expanded cards)

## Rollback Plan

If issues arise:
1. New columns are nullable, so they can be ignored without breaking existing functionality
2. Remove the message field additions and revert `saveCard()` signature
3. Migration can be rolled back with `ALTER TABLE cards DROP COLUMN` statements

## Future Use Cases (Not In Scope)

- **Review Chat Interface:** Will query `source_selection` + `source_context` to provide LLM context
- **Card QA Dashboard:** Analyze generation quality by comparing selection → generated Q&A
- **Similar Card Detection:** Use stored selection for deduplication
