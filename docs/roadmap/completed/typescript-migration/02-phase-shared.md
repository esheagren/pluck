# Phase 2: Shared Package (@pluckk/shared)

> **Status:** Complete
> **Estimated Hours:** 10-14
> **Prerequisites:** Phase 1 complete
> **Blocks:** Phases 3, 4, 5

## Objective

Convert the `@pluckk/shared` package to TypeScript. This package contains utilities, constants, and services used by all other packages.

## Why Start Here

1. **Lowest risk** - Utility functions are easiest to type
2. **Highest reuse** - Types defined here propagate to all packages
3. **Foundation** - Other packages import from shared

## File Checklist

### Supabase Module (`packages/shared/src/supabase/`)

| File | Lines | Status | Notes |
|------|-------|--------|-------|
| `client.js` → `client.ts` | 202 | [x] | Supabase client initialization, well-typed by library |
| `auth.js` → `auth.ts` | ~80 | [x] | Auth helpers |
| `feedback.js` → `feedback.ts` | ~60 | [x] | Feedback submission |
| `index.js` → `index.ts` | ~10 | [x] | Re-exports |
| `types.ts` | NEW | [x] | Database schema and client types |

### Scheduler Module (`packages/shared/src/scheduler/`)

| File | Lines | Status | Notes |
|------|-------|--------|-------|
| `sm2-simple.js` → `sm2-simple.ts` | 190 | [x] | SM-2 algorithm - needs `SM2State` type |
| `constants.js` → `constants.ts` | ~67 | [x] | Algorithm configuration |
| `index.js` → `index.ts` | ~5 | [x] | Re-exports |
| `types.ts` | NEW | [x] | SM2 algorithm types |

### Constants Module (`packages/shared/src/constants/`)

| File | Lines | Status | Notes |
|------|-------|--------|-------|
| `prompts.js` → `prompts.ts` | ~150 | [x] | Prompt templates - mostly strings |
| `api.js` → `api.ts` | ~30 | [x] | API constants |
| `index.js` → `index.ts` | ~5 | [x] | Re-exports |

### Utils Module (`packages/shared/src/utils/`)

| File | Lines | Status | Notes |
|------|-------|--------|-------|
| `helpers.js` → `helpers.ts` | ~100 | [x] | General helpers |
| `mochi-format.js` → `mochi-format.ts` | ~80 | [x] | Mochi markdown formatter |
| `index.js` → `index.ts` | ~5 | [x] | Re-exports |
| `types.ts` | NEW | [x] | Utility function types |

### Root Files

| File | Lines | Status | Notes |
|------|-------|--------|-------|
| `src/index.js` → `src/index.ts` | ~20 | [x] | Main entry point |

## Type Definitions to Create

### SM-2 Algorithm Types

```typescript
// In packages/shared/src/scheduler/types.ts

export interface SM2State {
  easiness: number;      // E-Factor, starts at 2.5
  interval: number;      // Days until next review
  repetitions: number;   // Successful repetitions in a row
  next_review: string;   // ISO date string
}

export interface SM2Input {
  quality: 0 | 1 | 2 | 3 | 4 | 5;  // User's recall quality rating
  currentState?: SM2State;
}

export interface SM2Output extends SM2State {
  was_correct: boolean;
}
```

### Supabase Types

```typescript
// In packages/shared/src/supabase/types.ts

import { SupabaseClient } from '@supabase/supabase-js';

// Database schema types (extend as needed)
export interface Database {
  public: {
    Tables: {
      cards: {
        Row: {
          id: string;
          user_id: string;
          deck_id: string;
          content: string;
          created_at: string;
          // ... other fields
        };
        Insert: Omit<Database['public']['Tables']['cards']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['cards']['Insert']>;
      };
      decks: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['decks']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['decks']['Insert']>;
      };
      // Add other tables as encountered
    };
  };
}

export type TypedSupabaseClient = SupabaseClient<Database>;
```

### Mochi Format Types

```typescript
// In packages/shared/src/utils/types.ts

export interface MochiCard {
  content: string;       // Markdown content
  deck_id?: string;
  template_id?: string;
}

export interface FormatOptions {
  includeSource?: boolean;
  sourceUrl?: string;
}
```

## Conversion Notes by File

### `client.js` → `client.ts`
- Import `Database` type for typed client
- `createClient<Database>(...)` gives full type inference
- Export typed client instance

### `sm2-simple.js` → `sm2-simple.ts`
- Add explicit return types to all functions
- Use `SM2State` interface for state parameters
- Quality rating should be typed as `0 | 1 | 2 | 3 | 4 | 5`

### `mochi-format.js` → `mochi-format.ts`
- Input: `Card` type from shared types
- Output: `string` (formatted markdown)
- Add `FormatOptions` parameter type

### `prompts.js` → `prompts.ts`
- Mostly string constants, minimal typing needed
- Consider `as const` for prompt objects to preserve literal types

## Verification Steps

1. After converting each file, run:
   ```bash
   cd packages/shared && npx tsc --noEmit
   ```

2. Test imports from other packages still work:
   ```typescript
   import { createSupabaseClient } from '@pluckk/shared/supabase';
   import { calculateNextReview } from '@pluckk/shared/scheduler';
   ```

3. Verify no runtime errors by:
   - Loading the extension
   - Running the webapp dev server

## Common Patterns

### Adding Types to Existing Functions

**Before:**
```javascript
export function calculateNextReview(quality, currentState) {
  // ...
}
```

**After:**
```typescript
import { SM2State, SM2Input, SM2Output } from './types';

export function calculateNextReview(
  quality: SM2Input['quality'],
  currentState?: SM2State
): SM2Output {
  // ...
}
```

### Typing Supabase Queries

**Before:**
```javascript
const { data, error } = await supabase
  .from('cards')
  .select('*')
  .eq('user_id', userId);
```

**After:**
```typescript
const { data, error } = await supabase
  .from('cards')
  .select('*')
  .eq('user_id', userId);
// Type is automatically inferred from Database type!
```

## Files to Create

| File | Purpose |
|------|---------|
| `src/scheduler/types.ts` | SM-2 algorithm types |
| `src/supabase/types.ts` | Database schema types |
| `src/utils/types.ts` | Utility function types |

## Definition of Done

- [x] All 11 files converted from `.js` to `.ts`
- [x] All type definition files created
- [x] `npx tsc --noEmit` passes with no errors
- [ ] Imports from other packages work correctly
- [ ] Extension and webapp still function
