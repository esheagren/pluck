# Non-DOM Content Extraction

Extract text from sources outside the browser DOM, such as PDFs, canvas-based editors, or web views where content isn't accessible via standard `window.getSelection()`.

## The Problem

Current architecture assumes text lives in the DOM as selectable text nodes. This breaks for:
- PDFs rendered via PDF.js canvas, Chrome's built-in viewer, or embedded viewers (like Notion's PDF view)
- Canvas-based editors (Google Docs, some Notion views)
- Cross-origin iframes with embedded content
- Native app webviews with different security contexts

## Proposed Tiered Approach

| Tier | Method | When Used |
|------|--------|-----------|
| 1 | Standard `getSelection()` | Works on ~80% of web content |
| 2 | Site-specific adapters | High-value targets (Notion, Google Docs) |
| 3 | Screenshot + Vision API | Universal fallback for anything visible |

## Tier 3 Implementation Notes

- `Cmd+Shift+S` triggers screen region capture via `chrome.desktopCapture` or `navigator.clipboard.read()`
- Send image to Claude with vision-enabled model
- Single prompt extracts text AND generates cards
- Works on literally anything visible on screen
- Tradeoff: Higher API cost (vision), slightly more user friction

## Sidepanel UI Changes Needed

- "No selection detected" state
- "Paste screenshot" and "Paste text" fallback buttons
- Hotkey for region capture

## Alternative/Simpler Fallback

Clipboard-based approach where user manually copies text (Cmd+C) and extension reads from clipboard when `getSelection()` returns empty. Less seamless but zero additional API cost.

---
**Category:** Card Creation & Import
