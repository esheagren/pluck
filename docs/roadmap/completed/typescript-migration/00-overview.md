# TypeScript Migration Plan

> **Status:** Planning
> **Difficulty:** Medium (6/10)
> **Estimated Effort:** 80-113 hours
> **Category:** Infrastructure

## Executive Summary

Convert the entire Pluckk codebase from JavaScript to TypeScript to improve type safety, developer experience, and catch bugs at compile time rather than runtime.

## Codebase Metrics

| Metric | Value |
|--------|-------|
| Total JS/JSX files | 79 |
| Total lines of code | ~12,400 |
| Packages | 4 (extension, webapp, shared, api) |
| Largest file | `sidepanel.js` (1,427 lines) |
| Average file size | ~157 lines |

## Package Breakdown

| Package | Files | LOC | Complexity | Phase |
|---------|-------|-----|------------|-------|
| `@pluckk/shared` | 19 | ~1,500 | Low | 2 |
| `@pluckk/api` | 15 | ~1,400 | Medium | 3 |
| `@pluckk/extension` | 8 | ~3,000 | High | 4 |
| `@pluckk/webapp` | 37 | ~6,500 | Medium-High | 5 |

## Migration Strategy: Gradual Conversion

We will use a **gradual conversion approach** rather than big-bang:

1. Start with `strict: false` in tsconfig
2. Convert package by package, starting with lowest-risk
3. Progressively enable stricter checks
4. End with full `strict: true` compliance

## Phase Overview

| Phase | Name | Description | Est. Hours |
|-------|------|-------------|------------|
| 1 | [Setup & Foundation](./01-phase-setup.md) | tsconfig, tooling, base types | 4-6 |
| 2 | [Shared Package](./02-phase-shared.md) | Convert @pluckk/shared | 10-14 |
| 3 | [API Package](./03-phase-api.md) | Convert @pluckk/api | 8-12 |
| 4 | [Extension Package](./04-phase-extension.md) | Convert @pluckk/extension | 28-36 |
| 5 | [Webapp Package](./05-phase-webapp.md) | Convert @pluckk/webapp | 20-28 |
| 6 | [Strict Mode & Polish](./06-phase-strict.md) | Enable strict, fix all errors | 10-15 |

## Key Challenges

### 1. Chrome Extension APIs (High Impact)
Chrome APIs have no built-in TypeScript types. We must either:
- Use `chrome-types` npm package (recommended)
- Create custom `.d.ts` files

**Files affected:** `background.js`, `content.js`, `sidepanel.js`, `options.js`, `popup.js`, `auth.js`

### 2. Complex State Management (Medium Impact)
Two files have complex interdependent state:
- `sidepanel.js` (1,427 lines) - multiple UI modes
- `useReviewState.js` (647 lines) - review session state

**Strategy:** Extract shared types first, then convert incrementally.

### 3. Custom API Response Types (Low Impact)
Need to define types for:
- Claude API card generation responses (7 card styles)
- Mochi API responses
- Supabase already has excellent types

## Dependencies to Add

```json
{
  "devDependencies": {
    "typescript": "^5.3.3",
    "@types/chrome": "^0.0.260",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@types/node": "^20.0.0"
  }
}
```

## Success Criteria

- [ ] All `.js`/`.jsx` files converted to `.ts`/`.tsx`
- [ ] `strict: true` enabled in all tsconfigs
- [ ] Zero TypeScript errors on `tsc --noEmit`
- [ ] All existing functionality preserved
- [ ] Build and tests pass

## Agent Instructions

Each phase document contains:
1. **Prerequisites** - What must be done before starting
2. **File Checklist** - Every file to convert with status tracking
3. **Type Definitions Needed** - Interfaces/types to create
4. **Conversion Notes** - File-specific guidance
5. **Verification Steps** - How to confirm completion

**Important:** Update the checklist in each phase document as you complete files. This keeps all agents synchronized on progress.

## File Naming Convention

When converting files:
- `.js` → `.ts`
- `.jsx` → `.tsx`
- Keep the same file location
- Update all imports that reference the file

## Order of Operations

```
Phase 1 (Setup)
    ↓
Phase 2 (Shared) ← Other phases depend on shared types
    ↓
Phase 3 (API) ← Can run in parallel with Phase 4
    ↓
Phase 4 (Extension)
    ↓
Phase 5 (Webapp)
    ↓
Phase 6 (Strict Mode)
```

Phases 3 and 4 can potentially run in parallel once Phase 2 is complete, as they don't directly depend on each other.
