# DOM Context Capture for Images - Implementation Plan

**Status:** Complete
**Created:** 2026-01-23
**Started:** 2026-01-23
**Completed:** 2026-01-23

## TL;DR
When a user pastes a screenshot without text selection, optionally capture a viewport screenshot + extracted DOM text to give the vision API context about what the image refers to.

## Critical Decisions
- **Both screenshot + text**: Capture viewport screenshot (spatial relationship) AND extracted DOM text (machine-readable context)
- **Opt-in toggle**: User enables via toggle in sidepanel, not automatic
- **Capture at paste time**: Grab context when image is pasted, not when sidepanel opens

## Tasks

**Overall Progress:** 100%

- [x] **Step 1: Add DOM context extraction to content script**
  - [x] Add `getVisibleDOMContext()` function in `content.ts`
  - [x] Extract visible headings (H1-H3) from viewport
  - [x] Extract ~1500 chars of visible body text
  - [x] Add message handler for `getDOMContext` action
  - [x] Return `{ headings: string[], visibleText: string, url: string, title: string }`

- [x] **Step 2: Add viewport screenshot capture**
  - [x] Use `chrome.tabs.captureVisibleTab()` in background worker
  - [x] Resize/compress similar to pasted image handling (max 1024px, ~200KB)
  - [x] Add `captureViewport` message handler in background.ts

- [x] **Step 3: Add toggle UI in sidepanel**
  - [x] Add "Include page context" toggle, visible only in image mode
  - [x] Store preference in `chrome.storage.sync`
  - [x] Toggle state persists across sessions

- [x] **Step 4: Wire up context capture on paste**
  - [x] When image pasted AND toggle enabled:
    - [x] Request DOM context from content script
    - [x] Request viewport screenshot from background
  - [x] Store captured context in sidepanel state

- [x] **Step 5: Update generateCardsFromImage flow**
  - [x] Add `pageContext` field to `GenerateCardsFromImageMessage`
  - [x] Update background handler to forward context to API
  - [x] Update API endpoint to accept and use context in vision prompt

- [x] **Step 6: Update vision prompt**
  - [x] Modify prompt to incorporate page context when provided
  - [x] Include viewport screenshot as second image
  - [x] Include extracted text in system/user message

## Relevant Files
- `packages/extension/src/content.ts` - Add DOM context extraction
- `packages/extension/src/background.ts` - Add viewport capture, update message handlers
- `packages/extension/sidepanel/sidepanel.ts` - Add toggle UI, wire up capture on paste
- `packages/extension/src/types/messages.ts` - Add new message types
- `packages/api/src/routes/cards.ts` - Update generate-cards-from-image endpoint

## Testing Plan
- [ ] Paste screenshot with toggle OFF - no context captured, works as before
- [ ] Paste screenshot with toggle ON - context captured and sent to API
- [ ] Verify viewport screenshot is captured and resized correctly
- [ ] Verify DOM text extraction gets headings and visible text
- [ ] Test on various page types (articles, docs, chat interfaces)
- [ ] Verify toggle state persists across sidepanel open/close

## Rollback Plan
Toggle is opt-in and defaults to OFF. If issues arise:
1. Remove toggle from UI
2. Remove context capture calls from paste handler
3. API endpoint already handles missing context (optional field)
