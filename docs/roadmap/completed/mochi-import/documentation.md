# Mochi Import

## Overview
Import existing Mochi flashcards into Pluckk via the Mochi REST API. The feature preserves deck structure by creating matching folders, detects duplicates to prevent re-importing the same cards, and provides detailed feedback on import results.

## Usage

1. **Configure Mochi API Key**: In Settings > Advanced Settings > Mochi Integration, enter your Mochi API key and save
2. **Open Import Section**: The "Import from Mochi" section appears below the Mochi Integration settings
3. **Load Decks**: Click "Load Mochi Decks" to fetch your deck list (includes nested decks with visual hierarchy)
4. **Select Decks**: Check the boxes for decks you want to import
5. **Import**: Click "Import X decks" to start the import
6. **Review Results**: See a summary of cards imported, duplicates skipped, and folders created

## Technical Details

### Backend Endpoint
`/api/import-from-mochi` handles both operations:
- **GET**: Fetches user's Mochi decks with hierarchy (via `parent-id`)
- **POST**: Imports cards from selected decks into Pluckk

### Data Transformation
Mochi cards use `content` field with `\n---\n` separator:
```
Question text
---
Answer text
```
This is parsed into separate `question` and `answer` fields for Pluckk.

### Duplicate Detection
Cards are skipped if a card with the same normalized question (lowercased, whitespace collapsed) already exists in the user's account. This includes cards imported earlier in the same batch.

### Folder Creation
Each imported deck creates a Pluckk folder using the deck's leaf name (not full path). If a folder with that name already exists, cards are added to the existing folder.

### Tagging
All imported cards receive the `imported:mochi` tag for easy identification and potential rollback.

### Performance
- Fetches up to 100 cards per Mochi API request with pagination
- 100ms delay between paginated requests (Mochi rate limit compliance)
- Batched database inserts (500 cards per batch) for large decks

## API Changes

### GET /api/import-from-mochi
**Auth**: Bearer token required
**Response**:
```json
{
  "decks": [
    { "id": "abc", "name": "Spanish", "parent-id": null },
    { "id": "def", "name": "Vocab", "parent-id": "abc" }
  ]
}
```

### POST /api/import-from-mochi
**Auth**: Bearer token required
**Request**:
```json
{
  "deckIds": ["abc", "def"],
  "createFolders": true
}
```
**Response**:
```json
{
  "success": true,
  "imported": 45,
  "skipped": 3,
  "foldersCreated": ["Spanish", "Vocab"],
  "errors": []
}
```

## Configuration
No new environment variables. Uses existing:
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` for database
- User's `mochi_api_key` from their profile (stored encrypted in `users` table)

## Limitations (MVP)
- **No review history**: Mochi's SRS state is not imported; cards start fresh in Pluckk
- **Text only**: Card attachments (images, audio) are not imported
- **One-way**: No sync back to Mochi; this is an import, not sync
