# DOM Context Capture for Images

## Overview
When users paste a screenshot to generate flashcards, they can optionally capture page context (visible DOM text + viewport screenshot) to help the AI understand what the image refers to. This is particularly useful when the pasted image alone lacks sufficient context about the topic being studied.

## Usage
1. Open the Pluckk sidepanel
2. Navigate to a page with content you want to study
3. Check the **"Include page context"** toggle below the screenshot focus input
4. Paste a screenshot (Cmd/Ctrl+V)
5. The extension captures the visible page context before showing the screenshot preview
6. Click the arrow to generate cards - the AI now has additional context about the page

The toggle preference persists across sessions.

## Technical Details

### Data Flow
1. **On paste** (with toggle enabled):
   - Sidepanel requests DOM context from content script (`getDOMContext` message)
   - Sidepanel requests viewport screenshot from background (`captureViewport` message)
   - Both requests run in parallel

2. **On generate**:
   - Page context is included in the `generateCardsFromImage` message
   - Background forwards context to the API
   - API includes context in Claude's vision prompt

### DOM Context Extraction
The content script extracts:
- **Headings**: All visible H1-H3 elements in the viewport
- **Body text**: ~1500 chars of visible paragraph/text content (deduped)
- **Metadata**: Page URL and title

### Viewport Screenshot
The background worker:
- Captures visible tab via `chrome.tabs.captureVisibleTab()`
- Resizes to max 1024px dimension
- Compresses to JPEG targeting ~200KB
- Uses `OffscreenCanvas` (service worker compatible)

### Vision Prompt Enhancement
When page context is provided, the API:
1. Appends context info to the user message (title, headings, text excerpt)
2. Sends the viewport screenshot as a second image to Claude
3. Claude uses both images + text to understand the relationship

## API Changes

### `POST /api/generate-cards-from-image`
New optional field in request body:
```typescript
interface PageContext {
  domContext: {
    headings: string[];
    visibleText: string;
    url: string;
    title: string;
  };
  viewportScreenshot?: {
    imageData: string;  // base64
    mimeType: string;
  };
}

// Request body
{
  imageData: string;
  mimeType: string;
  focusText?: string;
  pageContext?: PageContext;  // NEW
}
```

## Configuration
New setting stored in `chrome.storage.sync`:
- `includePageContext`: boolean (default: `false`)

## Files Changed
- `packages/extension/src/content.ts` - DOM context extraction
- `packages/extension/src/background.ts` - Viewport capture + message handler
- `packages/extension/sidepanel/sidepanel.ts` - Toggle UI + capture logic
- `packages/extension/sidepanel/sidepanel.html` - Toggle markup
- `packages/extension/sidepanel/sidepanel.css` - Toggle styles
- `packages/extension/src/types/messages.ts` - New message types
- `packages/extension/src/types/index.ts` - Type exports
- `packages/api/lib/types.ts` - PageContext type
- `packages/api/api/generate-cards-from-image.ts` - Context handling
