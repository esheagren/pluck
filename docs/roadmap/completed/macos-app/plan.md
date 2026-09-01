# Pluckk macOS App Implementation Plan

**Status:** Completed
**Created:** 2026-01-29
**Started:** 2026-01-29
**Completed:** 2026-01-29

## TL;DR

A native macOS app with an always-visible thin vertical strip on the right edge that expands on double-tap ⌘⌘ to capture text/images and generate flashcards. Includes authentication, card creation via existing API, optional Mochi sync, and a card browser with review mode.

## Critical Decisions

- **Framework**: SwiftUI with AppKit for panel management - best macOS integration, modern APIs
- **Trigger**: Double-tap ⌘⌘ (like Raycast) - requires Accessibility permissions for key monitoring
- **Content capture**: Accessibility API for direct text selection + clipboard fallback for images/incompatible apps
- **Panel style**: Always-visible thin strip (8-12px) with leftward expansion - distinctive UX
- **Project location**: `packages/macos/` in monorepo - shared constants and type definitions
- **Auth**: Supabase OAuth via ASWebAuthenticationSession + custom URL scheme callback
- **Minimum target**: macOS 13 (Ventura) - good SwiftUI support, covers most users
- **Offline**: Online-only for MVP - no offline queue

## Tasks

**Overall Progress:** 100%

- [x] **Step 1: Project Setup**
  - [x] Create Xcode project at `packages/macos/Pluckk/`
  - [x] Configure project settings (bundle ID: `com.pluckk.app`, deployment target: macOS 13)
  - [x] Add URL scheme `pluckk://` in Info.plist for OAuth callback
  - [x] Configure app sandbox entitlements (network access, Accessibility API)
  - [x] Add required privacy descriptions (Accessibility usage)
  - [x] Set up app icons and assets
  - [x] Configure as LSUIElement (menu bar app, no Dock icon)

- [x] **Step 2: Core Window System**
  - [x] Create `PluckkPanel` NSPanel subclass anchored to right screen edge
  - [x] Implement collapsed state (8-12px width, full screen height)
  - [x] Implement expanded state (320px width) with smooth animation
  - [x] Configure panel properties: `.floating` level, borderless, non-activating
  - [x] Handle multi-monitor support (appear on active screen)
  - [x] Add `collectionBehavior` for full-screen app compatibility

- [x] **Step 3: Ambient Strip Animation**
  - [x] Port sand animation concept from extension to SwiftUI Canvas
  - [x] Implement particle system with subtle vertical movement
  - [x] Keep animation performant (< 5% CPU when idle)
  - [x] Add state indicator (different animation when generating/syncing)

- [x] **Step 4: Global Hotkey Detection**
  - [x] Implement `DoubleCmdDetector` using CGEvent tap
  - [x] Detect double-tap ⌘ within 300ms threshold
  - [x] Ignore Cmd+key combinations (Cmd+C, Cmd+Tab, etc.)
  - [x] Handle Accessibility permission request and denial gracefully
  - [x] Add permission check on app launch with explanation UI

- [x] **Step 5: Content Capture**
  - [x] Implement `SelectionReader` using Accessibility API (AXUIElement)
  - [x] Get selected text from `kAXSelectedTextAttribute`
  - [x] Fallback to `kAXSelectedTextRangeAttribute` + `kAXStringForRangeParameterizedAttribute`
  - [x] Final fallback: silent Cmd+C simulation + clipboard read
  - [x] Implement clipboard image detection (NSPasteboard image types)
  - [x] Get source context: app name, window title via Accessibility API

- [x] **Step 6: Authentication**
  - [x] Create `AuthManager` with `@Published` state
  - [x] Implement Google OAuth via ASWebAuthenticationSession
  - [x] Handle `pluckk://auth/callback?token=...` URL scheme
  - [x] Store tokens securely in Keychain
  - [x] Add token refresh logic using Supabase SDK patterns
  - [x] Create login UI view (shown on first launch or when logged out)
  - [ ] Backend: Add endpoint to handle macOS OAuth flow (or reuse existing)

- [x] **Step 7: API Client**
  - [x] Create `PluckkAPI` client matching existing backend endpoints
  - [x] `POST /api/generate-cards` - text-based card generation
  - [x] `POST /api/generate-cards-from-image` - image-based card generation
  - [x] `POST /api/send-to-mochi` - save card (to Pluckk + optional Mochi)
  - [x] `GET /api/user/me` - fetch user profile, settings, subscription status
  - [x] `PATCH /api/user/me` - update settings
  - [x] Handle auth token injection, error responses, rate limits
  - [x] Add request timeout and retry logic

- [x] **Step 8: Card Generation UI**
  - [x] Create `CardGenerationView` for expanded panel
  - [x] Show captured text/image preview at top
  - [x] Display loading state during generation
  - [x] Render 2-4 generated cards with selection checkboxes
  - [x] Show card style indicator (QA, Cloze, etc.)
  - [x] Keyboard shortcuts: 1-4 toggle selection, A select all, Enter send
  - [x] Add deck selector dropdown (fetch user's decks)
  - [x] Add "Also send to Mochi" checkbox (if Mochi configured)
  - [x] Show usage remaining for free tier users

- [x] **Step 9: Card Editing**
  - [x] Create inline edit mode for selected card
  - [x] Editable question and answer fields
  - [x] Keyboard shortcut: E to edit selected card
  - [x] Save edits locally before sending
  - [x] Cancel edit with Esc

- [x] **Step 10: Send Cards Flow**
  - [x] Implement card sending to Pluckk backend
  - [x] Handle Mochi sync if enabled
  - [x] Show success toast with count
  - [x] Auto-collapse panel after successful send
  - [x] Handle errors gracefully (show in panel, don't collapse)

- [x] **Step 11: Card Browser**
  - [x] Create `CardBrowserView` as alternate panel state
  - [x] Fetch user's cards from Supabase (paginated)
  - [x] Display cards in scrollable list with search
  - [x] Filter by deck/folder
  - [x] Show card preview (question, answer truncated)
  - [x] Tap to expand card detail
  - [x] Add navigation between generation mode and browse mode

- [x] **Step 12: Review Mode**
  - [x] Create `ReviewSessionView` for studying due cards
  - [x] Fetch due cards using SM-2 algorithm from `card_review_state`
  - [x] Show card front (question), tap/space to reveal answer
  - [x] Rating buttons: Again (1), Hard (2), Good (3), Easy (4)
  - [x] Update review state via API after each rating
  - [x] Show session progress (X of Y cards)
  - [x] End session summary (cards reviewed, next due)

- [x] **Step 13: Settings**
  - [x] Create `SettingsView` accessible from panel header
  - [x] Account section: email, sign out button
  - [x] Default deck selector
  - [x] Mochi integration toggle + API key field + deck selector
  - [x] Trigger customization (double-tap ⌘ vs custom hotkey)
  - [x] Launch at login toggle (use SMAppService)
  - [ ] Strip appearance options (animation style, opacity)

- [x] **Step 14: Menu Bar Integration**
  - [x] Add menu bar icon (small Pluckk logo)
  - [x] Right-click menu: Settings, Browse Cards, Review Due, Quit
  - [ ] Show badge/indicator when cards are due
  - [x] Left-click: toggle panel expansion

- [ ] **Step 15: Polish & Edge Cases**
  - [x] Handle screen edge changes (external monitor connect/disconnect)
  - [ ] Persist panel state across app restarts
  - [ ] Add onboarding flow for first launch (permissions, login)
  - [x] Handle subscription status (show upgrade prompt for free tier limits)
  - [ ] Add keyboard navigation throughout UI
  - [ ] Implement proper focus management
  - [ ] Add haptic feedback where appropriate

- [ ] **Step 16: Distribution**
  - [ ] Configure code signing with Developer ID
  - [ ] Set up notarization workflow
  - [ ] Create DMG installer with drag-to-Applications
  - [ ] Document manual download + Gatekeeper bypass instructions
  - [ ] Consider Sparkle for auto-updates (optional for MVP)

## Relevant Files

### Existing (to reference/reuse patterns)
- `packages/shared/src/types/index.ts` - Card, Deck, User types
- `packages/shared/src/constants/api.ts` - API base URL, Supabase keys
- `packages/shared/src/supabase/auth.ts` - Auth patterns
- `packages/shared/src/scheduler/sm2-simple.ts` - SM-2 algorithm for review
- `packages/api/api/generate-cards.ts` - Card generation endpoint
- `packages/api/api/send-to-mochi.ts` - Mochi integration endpoint
- `packages/api/lib/auth.ts` - Server-side auth validation
- `packages/extension/sidepanel/sand-animation.ts` - Animation to port

### New (created)
- `packages/macos/Pluckk/Pluckk/PluckkApp.swift` - App entry point
- `packages/macos/Pluckk/Pluckk/AppDelegate.swift` - Panel + hotkey setup
- `packages/macos/Pluckk/Pluckk/Panel/PluckkPanel.swift` - NSPanel subclass
- `packages/macos/Pluckk/Pluckk/Panel/SidebarView.swift` - Main SwiftUI view
- `packages/macos/Pluckk/Pluckk/Panel/AmbientStripView.swift` - Thin animated strip
- `packages/macos/Pluckk/Pluckk/Selection/DoubleCmdDetector.swift` - Hotkey detection
- `packages/macos/Pluckk/Pluckk/Selection/SelectionReader.swift` - Text/image capture
- `packages/macos/Pluckk/Pluckk/Auth/AuthManager.swift` - Token management
- `packages/macos/Pluckk/Pluckk/API/PluckkAPI.swift` - Backend client
- `packages/macos/Pluckk/Pluckk/Views/CardGenerationView.swift` - Card creation UI
- `packages/macos/Pluckk/Pluckk/Views/CardBrowserView.swift` - Card list + search
- `packages/macos/Pluckk/Pluckk/Views/ReviewSessionView.swift` - Study mode
- `packages/macos/Pluckk/Pluckk/Views/SettingsView.swift` - Preferences
- `packages/macos/Pluckk/Pluckk/Models/AppState.swift` - App state management
- `packages/macos/Pluckk/Pluckk/Views/LoginView.swift` - Login UI

## API Changes Needed

- **Optional**: Add `GET /api/cards` endpoint for fetching user's cards with pagination, search, filtering (if not already exposed - may be able to query Supabase directly)
- **Optional**: Add `POST /api/review` endpoint for submitting review ratings (if not already exposed)
- Verify existing endpoints accept requests from non-browser clients (CORS shouldn't matter for native app)

## Testing Plan

- [ ] Unit tests for `DoubleCmdDetector` timing logic
- [ ] Unit tests for `SelectionReader` clipboard fallback
- [ ] Unit tests for SM-2 review scheduling
- [ ] Integration test: Auth flow with test account
- [ ] Integration test: Generate cards from text
- [ ] Integration test: Generate cards from image
- [ ] Integration test: Send to Mochi
- [ ] Manual test: Multi-monitor behavior
- [ ] Manual test: Full-screen app compatibility
- [ ] Manual test: Various apps (Safari, Chrome, Notes, VS Code, Preview)
- [ ] Manual test: Permission denial handling
- [ ] Manual test: Offline behavior (graceful error)

## Rollback Plan

- macOS app is a separate binary - can be uninstalled without affecting extension/webapp
- No database migrations required
- If OAuth callback endpoint added, it's additive (doesn't break existing flows)
- Users can continue using Chrome extension if macOS app has issues

## Dependencies

- Xcode 15+ (for macOS 13 SDK)
- Swift 5.9+
- No external Swift packages required for MVP (could add KeychainAccess for cleaner keychain API)

## Future Considerations (Not in MVP)

- iOS/iPadOS app using same codebase (SwiftUI portability)
- Offline queue with background sync
- Widget for quick capture
- Shortcuts.app integration
- Touch Bar support (if relevant)
- Menu bar quick-review (show due card in popover)
