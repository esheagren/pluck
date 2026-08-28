# Pluckk macOS App

## Overview

A native macOS application that brings Pluckk's flashcard generation capabilities system-wide. Features an always-visible thin vertical strip on the right screen edge that expands on double-tap ⌘⌘ to capture text or images from any application and generate spaced repetition flashcards.

## Usage

### Getting Started
1. Open `packages/macos/Pluckk/Pluckk.xcodeproj` in Xcode
2. Build and run (⌘R)
3. Grant Accessibility permission when prompted (required for text capture and hotkey detection)
4. Sign in with your Pluckk account (Google OAuth)

### Creating Cards
1. Highlight text in any application (or take a screenshot with ⌘⇧4)
2. Double-tap the Command key (⌘⌘)
3. The side panel expands showing generated card options
4. Select cards with checkboxes (or press 1-4 keys)
5. Press Enter to save cards

### Keyboard Shortcuts
- `⌘⌘` (double-tap): Trigger card capture
- `1-4`: Toggle card selection
- `Enter`: Send selected cards
- `E`: Edit selected card
- `R`: Regenerate cards
- `Esc`: Cancel/collapse

### Review Mode
Access via menu bar right-click → "Review Due Cards" to study flashcards using SM-2 spaced repetition.

### Card Browser
Access via menu bar right-click → "Browse Cards" to search and view all saved cards.

## Technical Details

### Architecture
```
PluckkApp.swift          → App entry point (@main)
AppDelegate.swift        → Panel setup, menu bar, hotkey registration
├── Panel/
│   ├── PluckkPanel.swift      → NSPanel subclass (floating, edge-anchored)
│   ├── SidebarView.swift      → Main SwiftUI container
│   └── AmbientStripView.swift → Particle animation (Canvas-based)
├── Selection/
│   ├── DoubleCmdDetector.swift → CGEvent tap for ⌘⌘ detection
│   └── SelectionReader.swift   → Accessibility API + clipboard capture
├── Auth/
│   └── AuthManager.swift       → Supabase OAuth, Keychain storage
├── API/
│   └── PluckkAPI.swift         → Backend client (generate, save, review)
├── Views/
│   ├── LoginView.swift
│   ├── CardGenerationView.swift
│   ├── CardBrowserView.swift
│   ├── ReviewSessionView.swift
│   └── SettingsView.swift
└── Models/
    └── AppState.swift          → Shared observable state
```

### Key Implementation Notes

**Double-tap Detection**: Uses CGEvent tap to monitor flagsChanged events. Detects ⌘ release within 300ms threshold, ignoring Cmd+key combinations.

**Text Capture**: Tries Accessibility API (`kAXSelectedTextAttribute`) first, falls back to text range method, then simulates Cmd+C as last resort.

**Panel Behavior**: NSPanel with `.floating` level, `.nonactivatingPanel` style, and `collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]` for compatibility with full-screen apps.

**Authentication**: Supabase OAuth via ASWebAuthenticationSession with `pluckk://` URL scheme callback. Tokens stored in Keychain.

**SM-2 Algorithm**: Implemented directly in PluckkAPI.swift for review state calculations, matching the shared TypeScript implementation.

### Permissions Required
- **Accessibility**: For text selection capture and global hotkey detection
- **Network**: For API communication (backend + Supabase)

## API Changes

No backend changes required. The macOS app uses existing endpoints:
- `POST /api/generate-cards` - Text-based card generation
- `POST /api/generate-cards-from-image` - Image-based card generation
- `POST /api/send-to-mochi` - Save cards (to Pluckk + optional Mochi)
- `GET/PATCH /api/user/me` - User profile and settings
- Direct Supabase queries for cards and review state

## Configuration

All configuration is centralized in `Config.swift`:
- `backendURL`: API endpoint (`https://pluckk-api.vercel.app`)
- `supabaseURL`: Supabase project URL
- `supabaseAnonKey`: Supabase publishable key (RLS-protected)
- `freeTierMonthlyLimit`: 20 cards/month for free users

### Info.plist Settings
- `LSUIElement = true`: Menu bar app (no Dock icon)
- `CFBundleURLSchemes`: `pluckk` for OAuth callback
- `NSAccessibilityUsageDescription`: Permission prompt text

## Known Limitations

- **Onboarding flow**: First-launch experience not polished. User must manually grant Accessibility permission. See icebox for future improvement.

- **Panel state persistence**: Panel collapsed/expanded state not saved across app restarts.

- **Menu bar due badge**: No visual indicator when cards are due for review.

- **Strip customization**: Animation style and opacity not configurable in settings.

- **Token refresh**: Automatic token refresh not implemented - user must re-authenticate if token expires.

- **Distribution**: Not code-signed or notarized. Users must bypass Gatekeeper to install.

## Building for Distribution

1. Set your Development Team in Xcode project settings
2. Archive: Product → Archive
3. Notarize: `xcrun notarytool submit Pluckk.app.zip --apple-id ... --team-id ... --password ...`
4. Create DMG: Use `create-dmg` or similar tool

## Future Enhancements

See `docs/roadmap/icebox.md` for planned improvements:
- iOS/iPadOS app (SwiftUI portability)
- Offline queue with background sync
- Shortcuts.app integration
- Widget for quick capture
