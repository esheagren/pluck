# Per-Card Refinement Actions

## Overview
Users can refine individual generated cards without regenerating the entire batch. An ellipsis menu on each card offers three actions — Rephrase, Simplify, and Make harder — that call Claude Haiku to produce a new version of just that card, replacing it in-place.

## Usage
1. Generate cards from a text selection (or screenshot/question)
2. Hover over any card to reveal the `...` menu in the top-right corner
3. Click an action:
   - **Rephrase** — Same knowledge, different wording/angle
   - **Simplify** — More atomic, narrower scope, simpler language
   - **Make harder** — Deeper recall, more specificity, "why/how" instead of "what"
4. Card shows a spinner while refining, then replaces in-place
5. Refined cards can be further refined, edited inline, and stored normally

The menu appears on standard, bidirectional, and diagram cards. Cloze list cards are excluded (they're structural and don't benefit from single-card rephrasing).

## Technical Details

### Message Flow
`sidepanel.ts` → `{ action: 'refineCard', card, refinementAction, sourceSelection, sourceContext }` → `background.ts` → `POST /api/refine-card` → Claude Haiku → refined card returned and replaced at same index in `cards[]` array.

### Backend (`packages/api/api/refine-card.ts`)
- Uses `claude-haiku-4-5-20251001` for speed and cost
- Action-specific system prompts instruct the model on how to transform the card
- Includes original source text and surrounding context when available
- `max_tokens: 500` (single card output)
- Reuses existing `authenticateRequest` and `checkUsageLimit` middleware

### Frontend (`packages/extension/sidepanel/sidepanel.ts`)
- `createRefinementMenu(index)` generates the ellipsis button + dropdown HTML
- `setupRefinementMenu(cardEl, index)` wires click handlers with `stopPropagation`
- `refineCard(index, action)` handles the async flow: loading state → API call → replace or error flash
- On success: card replaced in `cards[]`, `editedCards` entry cleared, selection state preserved
- On error: brief red border flash (1.5s), card restored to original state

### CSS States
- `.card-menu-btn` — opacity 0, revealed on `.card-item:hover`
- `.card-menu-dropdown` — absolutely positioned, z-index 10, shadow
- `.card-refining` — content dimmed to 0.3 opacity, centered spinner, menu hidden
- `.card-refine-error` — red border flash

## API Changes

### `POST /api/refine-card` (new)
**Auth:** Required (Bearer token)
**Usage:** Each refinement counts as 1 card toward monthly limit

**Request:**
```json
{
  "card": { "style": "qa", "question": "...", "answer": "...", "tags": {...} },
  "refinementAction": "rephrase" | "simplify" | "harder",
  "sourceSelection": "optional original highlighted text",
  "sourceContext": "optional surrounding context"
}
```

**Response:**
```json
{
  "card": { "style": "qa", "question": "...", "answer": "...", "tags": {...} }
}
```

### Extension Message Types
- Added `'refineCard'` to `MessageAction` union
- Added `RefinementAction` type: `'rephrase' | 'simplify' | 'harder'`
- Added `RefineCardMessage` and `RefineCardResponse` interfaces

## Known Limitations
- **Server-side card validation**: The `/api/refine-card` endpoint passes client-supplied card JSON directly into the LLM prompt via `JSON.stringify`. A malicious authenticated user could craft card content for prompt injection. Mitigated by auth requirement and the fact that card data originates from Claude. See icebox for future hardening.
