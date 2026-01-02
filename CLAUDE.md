# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Pluck** is a Chrome extension that captures highlighted text from any webpage, generates spaced repetition flashcard options using Claude API, and sends them directly to Mochi (or copies to clipboard).

**Core flow:** Highlight → Trigger extension (click or Cmd+Shift+M) → Select from 2-3 generated cards → Edit if needed → Send to Mochi

## Development Commands

```bash
# Load extension in Chrome for testing:
# 1. Navigate to chrome://extensions
# 2. Enable "Developer Mode" (top right)
# 3. Click "Load unpacked"
# 4. Select this directory

# After code changes, click the refresh icon on the extension card in chrome://extensions
```

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    CHROME EXTENSION                            │
│                                                                │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐ │
│  │   Content    │      │  Background  │      │    Popup     │ │
│  │   Script     │─────▶│   Worker     │─────▶│   (UI)       │ │
│  │              │      │              │      │              │ │
│  │ - Selection  │      │ - Claude API │      │ - Show cards │ │
│  │ - Context    │      │ - Storage    │      │ - Edit       │ │
│  │ - URL/Title  │      │              │      │ - Copy out   │ │
│  └──────────────┘      └──────────────┘      └──────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

- **Content Script (`content.js`)**: Runs on all pages. Captures selection via `window.getSelection()`, extracts surrounding context (500 chars or parent paragraphs), grabs URL/title, sends to background worker. Site-specific adapters handle ChatGPT/Claude.ai conversation context.

- **Background Worker (`background.js`)**: Service worker that receives context, calls Claude API with card generation prompt, stores API key in `chrome.storage.sync`, returns generated cards to popup.

- **Popup (`popup/`)**: Displays 2-3 card options, allows selection and inline editing of Q&A, formats as Mochi markdown, copies to clipboard.

- **Utils (`utils/mochi-format.js`)**: Mochi markdown formatter utility.

- **Options (`options/`)**: Settings page for API key entry.

## Mochi Output Format

```markdown
# {Question}
---
{Answer}

---
Source: {URL}
```

## Claude API Card Generation

Cards must be: atomic (one concept), clear (unambiguous), testable (verifiable answer), context-independent (makes sense without source).

Output JSON with 2-3 cards, each having `style` (qa/cloze/conceptual), `question`, and `answer`.

## Required Permissions

- `activeTab`: Access current tab content on click
- `storage`: Store API key
- `clipboardWrite`: Copy formatted markdown
- `host_permissions` for `https://api.anthropic.com/*`

## Target Surfaces

| Surface | Priority |
|---------|----------|
| Web articles | P0 |
| Notion (browser) | P0 |
| ChatGPT | P0 |
| Claude.ai | P0 |
| Any other webpage | P1 |

## Setup

1. Load extension in Chrome (see Development Commands)
2. Click extension icon → Settings (gear icon)
3. Enter Claude API key (get from console.anthropic.com)
4. Enter Mochi API key and select a deck (optional, for direct integration)
5. Highlight text on any page → trigger extension → select card → send to Mochi

## Keyboard Shortcuts

- `Cmd+Shift+M` (Mac) / `Ctrl+Shift+M` (Windows): Open Pluck
- `1`, `2`, `3`: Select card by number
- `Enter`: Send to Mochi (or copy if Mochi not configured)
- `Escape`: Close popup
