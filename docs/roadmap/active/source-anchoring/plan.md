# Source Anchoring & Page Annotations Implementation Plan

**Status:** Complete
**Created:** 2026-01-23
**Started:** 2026-01-23
**Completed:** 2026-01-23

## TL;DR
Store DOM location when extracting text so clicking "Source" deep-links to the exact position. Also inject in-page margin annotations showing cards created from that page, with visibility controlled via settings.

## Critical Decisions
- **DOM Location Strategy:** Use CSS selector + text offset (more robust than XPath across page changes)
- **Storage:** Supabase sync (new columns on `cards` table) - works across devices
- **Annotation Visibility:** Configurable in extension settings (on/off toggle)
- **Source Link Behavior:** Open page, scroll to location, briefly highlight the source text
- **Annotation Style:** Margin cards similar to reference image - subtle, non-intrusive

## Tasks

**Overall Progress:** 100%

- [x] **Step 1: Database Schema**
  - [x] Create migration adding `source_selector` (TEXT) and `source_text_offset` (INT) columns to `cards` table
  - [x] Update `packages/shared/src/supabase/types.ts` with new fields

- [x] **Step 2: Capture DOM Location in Content Script**
  - [x] Create `getDomSelector()` function in `content.ts` that generates a unique CSS selector for the selection's common ancestor
  - [x] Calculate text offset within that element (position of selected text start)
  - [x] Update `SelectionResponse` type to include `selector` and `textOffset`
  - [x] Update `captureSelection()` to return these new fields

- [x] **Step 3: Pass DOM Location Through Message Chain**
  - [x] Update `SelectionData` type in `messages.ts`
  - [x] Update `SendToMochiMessage` type to include new fields
  - [x] Update `SaveCardOptions` in shared types
  - [x] Pass fields through background worker and sidepanel

- [x] **Step 4: Store DOM Location in Supabase**
  - [x] Update `saveCard()` in `packages/shared/src/supabase/client.ts` to accept and store new fields
  - [ ] Verify fields are saved when creating cards (requires manual testing)

- [x] **Step 5: Add Settings Toggle for Annotations**
  - [x] Add `showPageAnnotations` boolean to extension storage options
  - [x] Add toggle to options page UI
  - [x] Default to `false` (opt-in)

- [x] **Step 6: Create Annotation Injection System**
  - [x] Create `packages/extension/src/annotations.ts` module
  - [x] Fetch cards for current URL from Supabase (query by `source_url` matching `window.location.origin + pathname`)
  - [x] For each card with valid selector/offset, render margin annotation
  - [x] Style annotations as subtle margin cards (right side, absolute positioned)
  - [x] Handle click on annotation to expand/show full card

- [x] **Step 7: Inject Annotations on Page Load**
  - [x] Update content script to check settings and conditionally run annotation injection
  - [x] Only inject after page is loaded (`DOMContentLoaded` or `load`)
  - [x] Listen for setting changes to show/hide annotations dynamically

- [x] **Step 8: Add Deep-Link URL Parameter Handling**
  - [x] Define URL parameter format: `?pluckk_card=<cardId>`
  - [x] On page load, if parameter present: scroll to selector, highlight text briefly
  - [x] Add visual highlight animation (yellow fade or similar)

- [x] **Step 9: Update Source Links in Webapp**
  - [x] Modify `ReviewCard.tsx` source link to include `?pluckk_card=<cardId>` parameter
  - [x] Modify `CardsPage.tsx` card modal to show source link with deep-link parameter (if selector exists)

- [x] **Step 10: Handle Edge Cases**
  - [x] Graceful fallback when selector no longer matches (page changed) - scrolls to top
  - [x] Handle pages with authentication (deep-link still works, annotation fetch may fail gracefully)
  - [x] Handle very long pages - uses smooth scrolling with block: 'center'

## Relevant Files
- `packages/extension/src/content.ts` - Add DOM selector capture
- `packages/extension/src/types/messages.ts` - Update message types
- `packages/extension/sidepanel/sidepanel.ts` - Pass new fields
- `packages/extension/src/background.ts` - Route new fields
- `packages/extension/options/options.ts` - Add settings toggle
- `packages/extension/options/options.html` - Settings UI
- `packages/shared/src/supabase/types.ts` - Database types
- `packages/shared/src/supabase/client.ts` - Save card with new fields
- `packages/api/migrations/009_source_anchoring.sql` - New migration
- `packages/webapp/src/components/ReviewCard.tsx` - Deep-link source
- `packages/webapp/src/pages/CardsPage.tsx` - Deep-link source in modal
- **NEW:** `packages/extension/src/annotations.ts` - Annotation injection module

## Testing Plan
- [ ] Create a card from a page, verify selector/offset are stored in DB
- [ ] Click source link from webapp, verify page opens and scrolls to correct location
- [ ] Verify highlight animation appears briefly at the source text
- [ ] Enable annotations in settings, verify margin cards appear on pages with captured text
- [ ] Disable annotations in settings, verify they disappear
- [ ] Test on pages where DOM has changed - verify graceful fallback (no crash, scroll to top)
- [ ] Test across devices (create card on desktop, click source on mobile)

## Rollback Plan
- Database migration is additive (new nullable columns) - no data loss
- Feature is behind settings toggle - can disable without code changes
- If critical issues: revert content script changes, annotations won't inject
- Source links fall back to current behavior (open URL without scroll) if fields are null
