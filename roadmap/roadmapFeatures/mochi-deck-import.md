# Mochi Deck Import

Allow users to import their existing Mochi flashcard decks into Pluckk, preserving cards, deck structure, and optionally review history.

## The Problem

Users switching from Mochi have existing flashcard collections they don't want to lose. Manual recreation is tedious and loses scheduling progress.

## Proposed Approach

1. **File upload** - Accept `.mochi` files (ZIP archives containing `data.json` + media)
2. **Parse structure** - Extract decks, cards, templates, and review history
3. **Map to Pluckk schema:**
   - Mochi decks → folders
   - Card content (Q `---` A format) → question/answer fields
   - Mochi reviews → card_review_state and review_logs
4. **Media handling** - Upload images/attachments to storage, rewrite URLs in card content
5. **Preview & confirm** - Show import summary before committing

## Technical Notes

- Mochi uses Transit+JSON encoding (JSON superset)
- Format is well-documented and relatively simple
- Nested decks supported via `parent-id`
- Template/field system would need mapping decisions

## Open Questions

- Preserve original scheduling or reset cards to "new"?
- How to handle Mochi templates that don't map to simple Q/A?
- Duplicate detection strategy?

---
**Category:** Card Creation & Import
