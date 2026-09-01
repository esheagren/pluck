# Source Context Storage

## Overview

Persists the original highlighted text and surrounding context when saving cards to Supabase. Enables future features like Review Chat (providing LLM with original source) and card generation QA analysis.

## Usage

Automatic - no user action required. When a card is saved from highlighted text:
- `source_selection`: exact highlighted text
- `source_context`: ~500 chars surrounding selection with `[[SELECTED]]..[[/SELECTED]]` markers
- `source_title`: page title

Screenshot and question-mode cards have `null` for these fields.

## Technical Details

### Database Schema

```sql
-- cards table additions (nullable)
source_selection TEXT  -- exact highlighted text
source_context TEXT    -- surrounding context with markers
source_title TEXT      -- page title
```

### Data Flow

```
Content Script → Background → Sidepanel (caches as cachedSelectionData)
                                    ↓ on "Store" click
                            sendToMochi message includes:
                              sourceSelection, sourceContext, sourceTitle
                                    ↓
                            Background → supabase.saveCard()
```

### Key Files

| File | Change |
|------|--------|
| `packages/api/migrations/007_source_context.sql` | Migration |
| `packages/shared/src/supabase/types.ts` | CardRow + SaveCardOptions |
| `packages/shared/src/supabase/client.ts` | saveCard() accepts new fields |
| `packages/extension/src/types/messages.ts` | SendToMochiMessage |
| `packages/extension/sidepanel/sidepanel.ts` | Passes cachedSelectionData |
| `packages/extension/src/background.ts` | Forwards to saveCard() |

### Behavior Notes

- Bidirectional/list cards: all expanded cards share same context (from single selection)
- Existing cards: `null` for all three fields (no backfill)
- Image cards: `null` (no text selection)
- Question mode cards: `null` (no page selection)

## API Changes

### SaveCardOptions (shared package)

```typescript
interface SaveCardOptions {
  userId: string;
  accessToken?: string;
  sourceSelection?: string;  // NEW
  sourceContext?: string;    // NEW
  sourceTitle?: string;      // NEW
}
```

### SendToMochiMessage (extension)

```typescript
interface SendToMochiMessage {
  // ... existing fields
  sourceSelection?: string;  // NEW
  sourceContext?: string;    // NEW
  sourceTitle?: string;      // NEW
}
```

## Configuration

**Required:** Run migration `007_source_context.sql` in Supabase SQL Editor before deploying.
