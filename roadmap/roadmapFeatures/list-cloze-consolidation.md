# List Cloze Consolidation

When the source text contains a list, avoid generating redundant cloze cards that each blank a different item from the same list.

Currently the prompt generates N cards for an N-item list (each blanking one item). Instead, generate a single card that tests recall of the entire list.

Handled at the API prompt level in `packages/api/api/generate-cards.js`.

---
**Category:** Card Quality & AI
