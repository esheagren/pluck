# Source Anchoring & Page Annotations

## Overview
This feature stores the exact DOM location when extracting text from a webpage, enabling deep-linking back to the source. When clicking a "Source" link from the webapp or review session, the browser opens the original page and scrolls directly to where the text was extracted, with a brief highlight animation. Additionally, users can enable page annotations that display margin indicators on pages where cards have been created.

## Usage

### Deep-Link to Source
1. Create a card from any webpage using Pluckk
2. In the webapp (review or cards page), click the "Source" link
3. The original page opens and automatically scrolls to the exact location
4. The source text briefly highlights in yellow, then fades

### Page Annotations
1. Open Pluckk Settings (extension options page)
2. Enable "Show card annotations on pages" toggle
3. Visit any page where you've previously created cards
4. Small margin indicators appear on the right side showing where cards were extracted
5. Hover or click an indicator to see the card question

## Technical Details

### DOM Location Capture
- When text is selected, `getDomSelector()` generates a unique CSS selector path to the selection's container element
- Uses a combination of tag names, IDs, meaningful classes, and `:nth-of-type()` for uniqueness
- Also captures the text offset (character position) within that element
- Stored as `source_selector` (TEXT) and `source_text_offset` (INTEGER) in the cards table

### Deep-Link URL Format
```
https://example.com/article?pluckk_card=<card-uuid>
```
The content script checks for this parameter on page load and handles scrolling/highlighting.

### Annotation Injection
- Content script checks `showPageAnnotations` setting
- Fetches cards matching current URL from Supabase
- For each card with a valid selector, renders a positioned annotation element
- Annotations are absolutely positioned based on the target element's viewport position

### Graceful Fallbacks
- If selector no longer matches (page changed): scrolls to page top
- If text offset fails: highlights entire element instead of specific text
- If settings disabled: removes all annotations immediately

## API Changes

### Database Schema
New columns in `cards` table (migration 009):
```sql
source_selector TEXT       -- CSS selector path
source_text_offset INTEGER -- Character offset within element
```

### Message Types
`SelectionData`, `SendToMochiMessage`, and `SelectionResponse` now include:
- `selector?: string`
- `textOffset?: number`

### SaveCardOptions
Extended with:
- `sourceSelector?: string`
- `sourceTextOffset?: number`

## Configuration

### Extension Storage
New setting in `chrome.storage.sync`:
- `showPageAnnotations: boolean` (default: `false`)

### Settings UI
Toggle added to options page under "Page Annotations" section.

## Files Modified/Created

**New Files:**
- `packages/extension/src/annotations.ts` - Annotation injection and deep-link handling
- `packages/api/migrations/009_source_anchoring.sql` - Database migration

**Modified Files:**
- `packages/extension/src/content.ts` - DOM selector capture, annotation init
- `packages/extension/src/background.ts` - Pass new fields through message chain
- `packages/extension/sidepanel/sidepanel.ts` - Include fields when storing cards
- `packages/extension/src/types/messages.ts` - Extended message types
- `packages/extension/src/types/storage.ts` - New setting type
- `packages/extension/options/options.html` - Settings toggle UI
- `packages/extension/options/options.ts` - Toggle logic
- `packages/shared/src/supabase/types.ts` - Database types
- `packages/shared/src/supabase/client.ts` - Save new fields
- `packages/webapp/src/types/hooks.ts` - Card interface
- `packages/webapp/src/components/ReviewCard.tsx` - Deep-link URL
- `packages/webapp/src/pages/CardsPage.tsx` - Deep-link URL in modal

## Known Limitations

### User-Filtered Annotations (MEDIUM - deferred)
Annotations currently fetch cards for all users on a URL, not just the current user's. This is acceptable for MVP since collisions are unlikely, but should be addressed as the user base grows. **Added to icebox** - see [User-Filtered Page Annotations](../../icebox.md#user-filtered-page-annotations).

### Other Limitations
- Selector may not work on dynamically loaded content (SPAs with heavy client-side routing)
- Requires running migration 009 before use
