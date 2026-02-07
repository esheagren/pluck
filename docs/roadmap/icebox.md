# Icebox

Feature ideas. Not prioritized - use `/prioritize` to pick the next one.

---

## Study Sessions & Gamification

### Session Timer
A timer-based study mode where users start a focused session. Sessions can be completed either by finishing all due reviews for the day or by reaching a set time limit.

### Reminders
Configurable reminder system that triggers based on user behavior. For example, receive a reminder if you skip two consecutive days of reviews.

### Review Chat Interface
Sidebar chat during review to ask follow-up questions about the card's subject matter. Built with OpenAI agent/chat SDK. Agent has access to card content + stored source context, and tools to modify the card (edit question/answer, rephrase, improve). Requires API endpoints for agent to update cards. Depends on Source Context Storage.

---

## Social Features

### Follow Other Accounts
Follow friends or other users to see their review activity. A leaderboard or activity feed could show who has completed their daily reviews.

### Kudos
Give recognition to users who have finished their reviews for the day. A lightweight way to encourage consistency in your network.

### Nudge
Send a gentle reminder email to friends who haven't reviewed in a while. The recipient would see something like "Erik has nudged you to do your reviews."

---

## Card Creation & Import

### Bulk Card Generation (Deep Research)
Generate a large set of cards about a subject or topic using a deep research query. Users would then curate and select which generated cards to keep.

### Anki Deck Import
Import existing Anki decks to migrate flashcard collections into Pluckk.

### Mochi Deck Import
Allow users to import their existing Mochi flashcard decks into Pluckk, preserving cards, deck structure, and optionally review history. Mochi uses Transit+JSON encoding in `.mochi` files (ZIP archives containing `data.json` + media).

### Non-DOM Content Extraction
Extract text from sources outside the browser DOM, such as PDFs, canvas-based editors, or web views where content isn't accessible via standard `window.getSelection()`. Tiered approach: (1) Standard selection, (2) Site-specific adapters, (3) Screenshot + Vision API as universal fallback.

### Zotero Web Reader Integration
Support capturing highlights from PDFs in Zotero's web reader (zotero.org), with rich bibliographic metadata in the source field. Pull paper title, authors, page number, and Zotero item link.

### Source Context Storage
Persist the exact highlighted text and surrounding context fed to the LLM at card creation time. Enables follow-up questions during review and QA on card generation quality. Prerequisite for Review Chat Interface.

### User-Filtered Page Annotations
Page annotations currently show all users' cards for a URL, not just the current user's. While collisions are unlikely for MVP, this should be fixed for privacy and relevance as the user base grows.

**Context:** See [Source Anchoring documentation](completed/source-anchoring/documentation.md) - Known Limitations section.
**Suggested fix:** Pass user auth token to content script and filter Supabase query by `user_id`.

---

## Rich Content Support

### Media File Support
Support for various file types in cards including audio clips, images, and visual diagrams.

### Audio Pronunciation for Language Cards
Generate TTS audio for non-English text on flashcards using ElevenLabs (or similar). Attach audio to both Supabase and Mochi cards. Requires: new `audio_url` column on cards table, `card-audio` Supabase storage bucket, TTS backend endpoint, and audio playback in the review UI. Mirrors the existing image attachment pipeline.

### LaTeX / Mathematical Notation
Render mathematical expressions and equations using LaTeX syntax.

### Canonical Diagram Study Sets
For taxonomic, comparative, or structural knowledge (e.g., ML algorithm types, system architectures), allow users to generate a canonical diagram that serves as the reference for multiple related flashcards. Two-step flow: generate diagram first, then generate questions from it.

---

## Card Quality & AI

### List Cloze Consolidation
When source text contains a list, avoid generating redundant cloze cards that each blank a different item. Instead, generate a single card that tests recall of the entire list.

### Prompt Improvements
Ongoing refinement of the card generation prompt to produce higher quality, more effective flashcards.

### Card Quality Feedback Loop
Systematic process for documenting problematic cards in `cardProblems/`, analyzing deficiencies, and feeding principles back into the generation prompt. Problem categories: list-recall, surface-level prompts, atomicity violations, buried insights, disconnected examples, missing contrast, decorative graphics.

### User Preference Model
Learn user preferences from selection behavior to generate better-fit cards. Signal sources: which card selected, what was edited, cards deleted/rated later, regenerate usage. Options: feature extraction classifier, embedding-based, LLM-as-preference-extractor, or collaborative filtering.

### Faster/Fine-tuned Models
Use a faster, distilled model potentially fine-tuned specifically for question generation to improve speed and quality.

### Comparison/Contrast Cards
New card style for highlighting similarities and differences between related concepts. Example: "How does X differ from Y?" or "What do X and Y have in common?" Addresses a common knowledge type not currently in the taxonomy.

### Refine Card Server-Side Validation
The `/api/refine-card` endpoint passes client-supplied card JSON directly into the LLM prompt. A malicious authenticated user could craft card content for prompt injection. Low risk (auth required, card data originates from Claude) but should be hardened.

**Context:** See [Per-Card Refinement documentation](completed/per-card-refinement/documentation.md) - Known Limitations section.
**Suggested fix:** Validate card structure server-side (whitelist known fields, strip unexpected properties) before including in the prompt.

### DOM Context Capture for Images
When a user provides just an image/screenshot without text selection, capture the visible DOM text or take a viewport screenshot to extract surrounding context. Helps the AI understand what the image refers to and generate better questions.

### Card Phrasing Variations
Prevent users from memorizing the exact wording instead of the concept. Parent card has multiple child versions with different phrasings. Variations generated cheaply via Haiku or similar. During review, show random variation so user learns the underlying knowledge, not the question shape.

---

## Organization & Deck Management

### Tagging System
Tag cards for filtering, combining, or organizing across decks. Enable flexible card organization beyond simple deck hierarchy.

### Smart Deck Assignment
In the browser extension, save cards to specific decks with intelligent inference about which deck the user likely wants based on context.

### Dynamic Hierarchical Classification
Automatically classify cards into categories that dynamically subdivide as they grow, creating an evolving taxonomy. When a category exceeds a threshold percentage of total cards, automatically subdivide it into more specific subcategories.

### Deck Sharing
Share decks publicly or with specific users. Enable collaborative learning and deck distribution.

### Card Embeddings & Knowledge Graph
Embed cards semantically to enable network/graph visualization of knowledge. Show relationships between concepts and identify gaps.

---

## Spaced Repetition Settings

### Algorithm Customization
Allow users to adjust parameters of the spaced repetition algorithm (e.g., ease factors, intervals, learning steps) to match their preferences.

### Response Time Tracking
Track how long users take to answer each card during review sessions. Add `response_time_ms` to `review_logs` table. Useful for analytics and potentially factoring into scheduling.

### Learning Phase (New Card Acquisition)
Separate learning phase from review phase, similar to Anki. New cards get same-day repetitions at short intervals (e.g., 1min, 10min). Only graduates to spaced review schedule when rated "easy." May also warrant different UI or supporting explanations during learning vs review.

---

## Platform Expansion

### Mobile App
Mobile version for practicing on phone. Consider native app for better performance and offline support.

### Offline Mode
Enable reviewing cards without an internet connection, syncing progress when back online.

### macOS App Polish
Improve the macOS app first-launch experience and add missing features:
- Onboarding flow for permissions and login
- Panel state persistence across restarts
- Menu bar badge when cards are due
- Strip animation customization
- Automatic token refresh

**Context:** See [macOS App documentation](completed/macos-app/documentation.md) - Known Limitations section.

### macOS App Distribution
Code signing, notarization, and DMG installer for the macOS app. Currently users must bypass Gatekeeper.

**Context:** See [macOS App documentation](completed/macos-app/documentation.md).

---

## Infrastructure & Observability

### PostHog User Analytics
Add PostHog for product analytics - track user flows, feature usage, and engagement metrics.

### LLM Observability (Cost & Latency)
Implement observability for LLM API calls using Langchain/LangSmith or similar. Track cost, latency, token usage, and prompt performance across users and operations.

### Public Feature Roadmap with Voting
Expose a user-facing roadmap where users can see planned features, upvote ones they want, and submit their own feature ideas.
