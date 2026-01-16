# Phase 4: Extension Package (@pluckk/extension)

> **Status:** Not Started
> **Estimated Hours:** 28-36
> **Prerequisites:** Phase 2 complete
> **Can Parallel With:** Phase 3 (API)

## Objective

Convert the Chrome extension to TypeScript. This is the **most complex phase** due to Chrome API usage and large UI files.

## Why This Is Complex

1. **Chrome APIs** - No native types, must use `@types/chrome`
2. **Message passing** - Complex async communication between components
3. **Large files** - `sidepanel.js` is 1,427 lines
4. **DOM manipulation** - Heavy vanilla JS DOM operations
5. **Service worker** - Background script has unique constraints

## Package Structure

```
packages/extension/
├── src/
│   ├── background.js      # Service worker (767 lines)
│   ├── content.js         # Content script (145 lines)
│   └── auth.js            # Auth utilities (230 lines)
├── sidepanel/
│   ├── sidepanel.js       # Main UI (1,427 lines) **LARGEST FILE**
│   └── sand-animation.js  # Animation utility (~100 lines)
├── options/
│   └── options.js         # Settings page (417 lines)
├── popup/
│   └── popup.js           # Popup UI (368 lines)
└── manifest.json
```

## File Checklist

### Priority Order (convert in this sequence)

| # | File | Lines | Status | Complexity | Notes |
|---|------|-------|--------|------------|-------|
| 1 | `src/auth.js` → `src/auth.ts` | 230 | [ ] | Medium | Start here - isolated, uses Chrome storage |
| 2 | `src/content.js` → `src/content.ts` | 145 | [ ] | Low | Content script, selection handling |
| 3 | `sidepanel/sand-animation.js` → `.ts` | ~100 | [ ] | Low | Canvas animation utility |
| 4 | `popup/popup.js` → `popup/popup.ts` | 368 | [ ] | Medium | Popup UI logic |
| 5 | `options/options.js` → `options/options.ts` | 417 | [ ] | Medium | Settings page |
| 6 | `src/background.js` → `src/background.ts` | 767 | [ ] | **High** | Service worker, message hub |
| 7 | `sidepanel/sidepanel.js` → `.ts` | 1,427 | [ ] | **Very High** | Main UI - save for last |

## Type Definitions to Create

### Chrome Message Types

```typescript
// In packages/extension/src/types/messages.ts

// All possible message actions
export type MessageAction =
  | 'GET_SELECTION'
  | 'GENERATE_CARDS'
  | 'SEND_TO_MOCHI'
  | 'COPY_TO_CLIPBOARD'
  | 'GET_API_KEY'
  | 'SET_API_KEY'
  | 'OPEN_SIDEPANEL'
  | 'AUTH_STATUS'
  | 'LOGIN'
  | 'LOGOUT';

// Base message interface
export interface ExtensionMessage<T = unknown> {
  action: MessageAction;
  payload?: T;
}

// Specific message types
export interface GetSelectionMessage extends ExtensionMessage {
  action: 'GET_SELECTION';
}

export interface GenerateCardsMessage extends ExtensionMessage<SelectionContext> {
  action: 'GENERATE_CARDS';
  payload: SelectionContext;
}

export interface SelectionContext {
  selectedText: string;
  surroundingContext: string;
  url: string;
  title: string;
}

// Response types
export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Type-safe message sender
export function sendMessage<T>(
  message: ExtensionMessage
): Promise<MessageResponse<T>> {
  return chrome.runtime.sendMessage(message);
}
```

### Storage Types

```typescript
// In packages/extension/src/types/storage.ts

export interface StorageData {
  claudeApiKey?: string;
  mochiApiKey?: string;
  selectedDeckId?: string;
  userPreferences?: UserPreferences;
  authToken?: string;
}

export interface UserPreferences {
  defaultCardStyle?: string;
  autoSendToMochi?: boolean;
  showContextInCards?: boolean;
}

// Type-safe storage access
export async function getStorage<K extends keyof StorageData>(
  keys: K[]
): Promise<Pick<StorageData, K>> {
  return chrome.storage.sync.get(keys) as Promise<Pick<StorageData, K>>;
}

export async function setStorage(
  data: Partial<StorageData>
): Promise<void> {
  return chrome.storage.sync.set(data);
}
```

### UI State Types (for sidepanel)

```typescript
// In packages/extension/src/types/ui-state.ts

export type UIMode =
  | 'idle'
  | 'loading'
  | 'selection'
  | 'cards'
  | 'editing'
  | 'sending'
  | 'success'
  | 'error';

export interface SidepanelState {
  mode: UIMode;
  selectedText?: string;
  generatedCards?: Card[];
  selectedCardIndex?: number;
  editedCard?: Card;
  error?: string;
}

// Card from @pluckk/shared
import type { Card } from '@pluckk/shared/types';
```

### DOM Element Types

```typescript
// In packages/extension/src/types/dom.ts

// Type for cached DOM elements (sidepanel pattern)
export interface SidepanelElements {
  container: HTMLElement;
  selectionDisplay: HTMLElement;
  cardList: HTMLElement;
  sendButton: HTMLButtonElement;
  copyButton: HTMLButtonElement;
  regenerateButton: HTMLButtonElement;
  loadingSpinner: HTMLElement;
  errorDisplay: HTMLElement;
}

// Helper to safely query DOM
export function getElement<T extends HTMLElement>(
  selector: string
): T | null {
  return document.querySelector<T>(selector);
}

export function getRequiredElement<T extends HTMLElement>(
  selector: string
): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);
  return el;
}
```

## Conversion Notes by File

### `src/auth.js` → `src/auth.ts` (Start Here)

Relatively isolated file. Key changes:
- Type the token validation response
- Use `StorageData` type for storage access
- Add return types to all functions

```typescript
export async function getAuthToken(): Promise<string | null> {
  const { authToken } = await getStorage(['authToken']);
  return authToken ?? null;
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getAuthToken();
  return token !== null && !isTokenExpired(token);
}
```

### `src/content.js` → `src/content.ts`

Simple content script. Key changes:
- Type the selection result
- Type message sending

```typescript
function getSelectionContext(): SelectionContext {
  const selection = window.getSelection();
  return {
    selectedText: selection?.toString() ?? '',
    surroundingContext: getSurroundingContext(selection),
    url: window.location.href,
    title: document.title,
  };
}

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, sendResponse) => {
    if (message.action === 'GET_SELECTION') {
      sendResponse({ success: true, data: getSelectionContext() });
    }
    return true; // Keep channel open for async response
  }
);
```

### `src/background.js` → `src/background.ts`

Complex service worker. Strategy:
1. Define all message handler types first
2. Create typed message router
3. Convert handlers one at a time

```typescript
// Message router pattern
const messageHandlers: Record<MessageAction, MessageHandler> = {
  GET_SELECTION: handleGetSelection,
  GENERATE_CARDS: handleGenerateCards,
  SEND_TO_MOCHI: handleSendToMochi,
  // ...
};

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, sendResponse) => {
    const handler = messageHandlers[message.action];
    if (handler) {
      handler(message, sender)
        .then(sendResponse)
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true; // Async response
    }
  }
);
```

### `sidepanel/sidepanel.js` → `sidepanel/sidepanel.ts` (Last)

**This is the largest and most complex file.** Conversion strategy:

1. **First pass:** Add type annotations without restructuring
   - Type all DOM element references
   - Type state variables
   - Type event handlers

2. **Consider refactoring:** This file may benefit from being split:
   - `sidepanel-state.ts` - State management
   - `sidepanel-ui.ts` - DOM manipulation
   - `sidepanel-handlers.ts` - Event handlers
   - `sidepanel.ts` - Main entry point

3. **DOM element pattern:**
   ```typescript
   // Cache typed DOM elements at top of file
   const elements: SidepanelElements = {
     container: getRequiredElement('#container'),
     cardList: getRequiredElement('#card-list'),
     // ...
   };
   ```

4. **State management:**
   ```typescript
   let state: SidepanelState = {
     mode: 'idle',
   };

   function setState(updates: Partial<SidepanelState>): void {
     state = { ...state, ...updates };
     render();
   }
   ```

## Chrome API Typing Patterns

### Message Listeners

```typescript
chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void
  ) => {
    // handler
    return true; // Required for async
  }
);
```

### Storage Access

```typescript
// Get
const result = await chrome.storage.sync.get(['claudeApiKey']);
const key = result.claudeApiKey as string | undefined;

// Set
await chrome.storage.sync.set({ claudeApiKey: 'key' });
```

### Tab Queries

```typescript
const [tab] = await chrome.tabs.query({
  active: true,
  currentWindow: true,
});
if (tab?.id) {
  await chrome.tabs.sendMessage(tab.id, message);
}
```

## Vite Config Updates

After converting, update `vite.config.js` entry points:

```javascript
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        background: 'src/background.ts',
        content: 'src/content.ts',
        sidepanel: 'sidepanel/sidepanel.ts',
        options: 'options/options.ts',
        popup: 'popup/popup.ts',
      },
    },
  },
});
```

## Verification Steps

1. After each file conversion:
   ```bash
   cd packages/extension && npx tsc --noEmit
   ```

2. Build the extension:
   ```bash
   yarn build
   ```

3. Load in Chrome and test:
   - Open sidepanel
   - Highlight text and generate cards
   - Send to Mochi / copy to clipboard
   - Check settings page

4. Check Chrome DevTools console for errors

## Common Issues

### Issue: `chrome` is not defined
**Solution:** Ensure `@types/chrome` is installed and `types: ["chrome"]` is in tsconfig

### Issue: Event listener return type
**Solution:** Chrome listeners should `return true` for async responses

### Issue: DOM null checks
**Solution:** Use non-null assertion for known elements, or getRequiredElement helper

## Files to Create

| File | Purpose |
|------|---------|
| `src/types/messages.ts` | Message type definitions |
| `src/types/storage.ts` | Storage type definitions |
| `src/types/ui-state.ts` | UI state types |
| `src/types/dom.ts` | DOM helper types |
| `src/types/index.ts` | Re-export all types |

## Definition of Done

- [ ] All 7 files converted from `.js` to `.ts`
- [ ] All type definition files created
- [ ] `npx tsc --noEmit` passes with no errors
- [ ] Extension builds successfully with Vite
- [ ] Extension loads in Chrome without errors
- [ ] All functionality works (sidepanel, popup, options, message passing)
- [ ] Background service worker runs without errors
