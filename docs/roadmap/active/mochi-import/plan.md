# Mochi Import Implementation Plan

**Status:** Completed
**Created:** 2026-01-23
**Started:** 2026-01-23
**Completed:** 2026-01-23

## TL;DR
Import existing Mochi flashcards into Pluckk via the Mochi API, preserving deck structure as folders, and skipping duplicates based on question matching.

## Critical Decisions
Key architectural/implementation choices made during exploration:
- **API-first approach** - Use Mochi REST API rather than file import for better UX (no manual export step)
- **Duplicate detection by question text** - Skip cards where the normalized question already exists in Pluckk
- **Mirror deck hierarchy as folders** - Create Pluckk folders that match Mochi deck structure (including nested decks via parent-id)
- **UI in webapp Settings page** - Add collapsible "Import from Mochi" section under Advanced Settings
- **Backend proxy for API calls** - Route Mochi API calls through Pluckk backend to avoid CORS and keep API key handling consistent

## Tasks

**Overall Progress:** 100%

- [x] **Step 1: Create Backend Import API Endpoint**
  - [x] Create `/packages/api/api/import-from-mochi.ts` endpoint
  - [x] Implement `GET /api/import-from-mochi` - fetch and return all Mochi decks with hierarchy
  - [x] Implement `POST /api/import-from-mochi` - accept deck IDs, fetch cards, transform, insert into DB
  - [x] Add pagination handling (Mochi returns max 100 cards per request with bookmark cursor)
  - [x] Transform Mochi card format to Pluckk format: `content` field → `question`/`answer` split on `---`
  - [x] Create folders matching Mochi deck hierarchy (uses leaf deck name as folder)
  - [x] Implement duplicate detection: query existing cards by normalized question text before insert
  - [x] Return import summary: cards imported, duplicates skipped, folders created

- [x] **Step 2: Add TypeScript Types**
  - [x] Add `MochiCard` interface to `/packages/api/lib/types.ts` (id, content, deck-id, tags, created-at, etc.)
  - [x] Add `ImportResult` interface (imported: number, skipped: number, folders: string[])
  - [x] Add `ImportFromMochiRequest` interface (deckIds: string[], createFolders: boolean)

- [x] **Step 3: Build Settings Page Import UI**
  - [x] Add "Import from Mochi" collapsible section to `SettingsPage.tsx` (below existing Mochi Integration)
  - [x] Show section only when Mochi API key is configured
  - [x] Add "Load Decks" button that fetches deck list from backend
  - [x] Display deck tree with checkboxes (indented for nested decks)
  - [x] Add "Import Selected" button with loading state
  - [x] Show loading state during import
  - [x] Display results summary: "Imported X cards, skipped Y duplicates, created Z folders"

- [x] **Step 4: Handle Edge Cases**
  - [x] Handle Mochi rate limiting (1 concurrent request) with sequential processing + 100ms delay
  - [x] Handle cards with attachments (images): imports text-only for MVP (attachments skipped)
  - [x] Handle empty decks gracefully (no cards inserted, no error)
  - [x] Handle Mochi API errors (401 invalid key, network errors) with user-friendly messages
  - [x] Validate deck selection (at least one deck selected)

## Relevant Files
- `packages/api/api/import-from-mochi.ts` - NEW: Backend endpoint for import
- `packages/api/lib/types.ts` - Add MochiCard, ImportResult types
- `packages/api/lib/auth.ts` - Reuse authenticateRequest for auth
- `packages/api/lib/supabase-admin.ts` - Database operations for cards/folders
- `packages/webapp/src/pages/SettingsPage.tsx` - Add import UI section
- `packages/webapp/src/types/index.ts` - Add frontend types for import

## Data Transformation

**Mochi Card Format:**
```json
{
  "id": "abc123",
  "content": "What is X?\n---\nX is Y",
  "deck-id": "deck456",
  "tags": ["tag1"],
  "created-at": "2024-01-01T00:00:00Z"
}
```

**Pluckk Card Format:**
```json
{
  "question": "What is X?",
  "answer": "X is Y",
  "user_id": "user789",
  "folder_id": "folder012",
  "style": "qa",
  "tags": ["tag1", "imported:mochi"],
  "source_title": "Imported from Mochi"
}
```

## API Design

### GET /api/import-from-mochi/decks
Returns deck hierarchy for selection UI.
```json
{
  "decks": [
    { "id": "a", "name": "Languages", "parent-id": null },
    { "id": "b", "name": "Spanish", "parent-id": "a" },
    { "id": "c", "name": "French", "parent-id": "a" }
  ]
}
```

### POST /api/import-from-mochi
Request:
```json
{
  "deckIds": ["a", "b"],
  "createFolders": true
}
```

Response:
```json
{
  "success": true,
  "imported": 45,
  "skipped": 3,
  "foldersCreated": ["Languages", "Spanish"],
  "errors": []
}
```

## Testing Plan
- [ ] Unit: Card content parsing (split on `---`, handle edge cases)
- [ ] Unit: Duplicate detection query
- [ ] Integration: Import single deck, verify cards in DB
- [ ] Integration: Import nested decks, verify folder hierarchy
- [ ] Integration: Re-import same deck, verify duplicates skipped
- [ ] E2E: Settings page flow - load decks → select → import → see results

## Rollback Plan
1. Cards can be deleted by folder (each import creates new folders)
2. Add `imported:mochi` tag to all imported cards for easy identification
3. Future: Add import history table to track and reverse imports

## Future Enhancements (Not in MVP)
- Import review history from Mochi
- Support .mochi file upload as alternative
- Two-way sync (export Pluckk changes back to Mochi)
- Image/attachment import
