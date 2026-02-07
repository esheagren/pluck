# Per-Card Refinement Actions Implementation Plan

**Status:** Complete
**Created:** 2026-02-06
**Started:** 2026-02-06
**Completed:** 2026-02-06

## TL;DR
Add an ellipsis menu on each generated card with refinement actions (Rephrase, Simplify, Make Harder) that call the LLM to produce a new version of just that card, replacing it in-place.

## Critical Decisions
- **UI pattern:** Ellipsis (`...`) menu in card corner, opens dropdown with 3 actions
- **Actions for MVP:** "Rephrase differently", "Simplify", "Make harder"
- **Replacement behavior:** Refined card replaces the original in-place (no side-by-side comparison)
- **Backend approach:** New `/api/refine-card` endpoint that takes the card + action + original source context and returns a single refined card
- **Model:** Use `claude-haiku-4-5-20251001` for refinements — fast, cheap, and sufficient for rephrasing a single card
- **Usage counting:** Each refinement counts as 1 card toward usage limits (same as generation)

## Tasks

**Overall Progress:** 100%

- [x] **Step 1: Add `refineCard` message type to extension types**
  - [x] Add `'refineCard'` to `MessageAction` union in `packages/extension/src/types/messages.ts`
  - [x] Add `RefineCardMessage` interface with fields: `action`, `card` (GeneratedCard), `refinementAction` ('rephrase' | 'simplify' | 'harder'), `sourceSelection`, `sourceContext`
  - [x] Add `RefineCardResponse` interface with `card?: GeneratedCard`, `error?: string`

- [x] **Step 2: Create `/api/refine-card` backend endpoint**
  - [x] Create `packages/api/api/refine-card.ts`
  - [x] Auth + usage limit check (reuse existing `authenticateRequest`, `checkUsageLimit`)
  - [x] Build a focused system prompt with action-specific instructions
  - [x] Call Claude API with Haiku model, `max_tokens: 500`
  - [x] Parse response, validate it's a single card, return it
  - [x] Increment usage count by 1

- [x] **Step 3: Add `refineCard` handler in background worker**
  - [x] In `packages/extension/src/background.ts`, add case for `'refineCard'` message action
  - [x] Forward request to `/api/refine-card` with auth token
  - [x] Return the refined card to the sender

- [x] **Step 4: Add ellipsis menu UI to card rendering**
  - [x] In `sidepanel.ts`, add `createRefinementMenu()` and `setupRefinementMenu()` helpers
  - [x] Integrate into `renderStandardCard()`, `renderBidirectionalCard()`, and `renderDiagramCard()`
  - [x] Skip `renderListCard()` (cloze lists are structural)
  - [x] Wire click handlers with stopPropagation, close on outside click

- [x] **Step 5: Wire refinement actions to backend**
  - [x] `refineCard()` function sends message, shows loading state, replaces card in-place
  - [x] Clears `editedCards` entry on refinement
  - [x] Preserves selection state after re-render
  - [x] Error state: brief red border flash

- [x] **Step 6: Add CSS for menu and loading states**
  - [x] `.card-menu-btn`: hover-reveal in top-right corner
  - [x] `.card-menu-dropdown`: shadow, rounded corners, z-index
  - [x] `.card-refining`: dimmed content + centered spinner
  - [x] `.card-refine-error`: red border flash

## Relevant Files
- `packages/extension/src/types/messages.ts` - Added RefineCard types + RefinementAction
- `packages/extension/src/types/index.ts` - Re-exported new types
- `packages/api/api/refine-card.ts` - New backend endpoint
- `packages/extension/src/background.ts` - Added refineCard message handler
- `packages/extension/sidepanel/sidepanel.ts` - Menu UI + refinement logic
- `packages/extension/sidepanel/sidepanel.css` - Menu and loading state styles

## Testing Plan
- [ ] Generate cards from a text selection, verify ellipsis menu appears on each standard card
- [ ] Click "Rephrase differently" — card should show spinner, then replace with new version
- [ ] Click "Simplify" — card should become more atomic/simpler
- [ ] Click "Make harder" — card should become more demanding
- [ ] Verify refined card can be further refined (chain refinements)
- [ ] Verify refined card can be edited inline after refinement
- [ ] Verify refined card is included correctly when storing to Mochi/Supabase
- [ ] Verify card selection state is preserved after refinement
- [ ] Verify menu closes when clicking outside
- [ ] Verify menu doesn't appear on cloze_list cards
- [ ] Test error case: API failure should restore original card with brief error message
- [ ] Verify usage count increments by 1 per refinement

## Rollback Plan
- Delete `packages/api/api/refine-card.ts`
- Revert changes to `messages.ts`, `background.ts`, `sidepanel.ts`, `sidepanel.css`
- No database migrations or schema changes involved
