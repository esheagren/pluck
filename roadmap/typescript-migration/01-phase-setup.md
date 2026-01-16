# Phase 1: Setup & Foundation

> **Status:** Not Started
> **Estimated Hours:** 4-6
> **Prerequisites:** None
> **Blocks:** All other phases

## Objective

Set up TypeScript tooling, configuration files, and base type definitions that all packages will use.

## Checklist

### 1.1 Install Dependencies

- [ ] Add TypeScript and type packages to root `package.json`:
  ```bash
  yarn add -D typescript @types/node
  ```

- [ ] Add package-specific types:
  ```bash
  # In packages/webapp
  yarn add -D @types/react @types/react-dom

  # In packages/extension
  yarn add -D @types/chrome
  ```

### 1.2 Create Root tsconfig.json

- [ ] Create `/tsconfig.base.json` with shared settings:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,

    // Start permissive, tighten later in Phase 6
    "strict": false,
    "noImplicitAny": false,
    "strictNullChecks": false,

    // Useful even in non-strict mode
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### 1.3 Create Package-Specific tsconfigs

- [ ] Create `packages/shared/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] Create `packages/api/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "."
  },
  "include": ["api/**/*", "lib/**/*"],
  "exclude": ["node_modules"]
}
```

- [ ] Create `packages/extension/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": ".",
    "types": ["chrome"]
  },
  "include": ["src/**/*", "sidepanel/**/*", "options/**/*", "popup/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] Create `packages/webapp/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "jsx": "react-jsx",
    "types": ["react", "react-dom"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 1.4 Update Vite Configs

- [ ] Update `packages/webapp/vite.config.js` to handle `.ts`/`.tsx`:
  - Vite handles TypeScript natively, minimal changes needed
  - Ensure `resolve.extensions` includes `.ts` and `.tsx`

- [ ] Update `packages/extension/vite.config.js`:
  - Update entry points to use `.ts` extensions (after conversion)

### 1.5 Create Shared Type Definitions

- [ ] Create `packages/shared/src/types/index.ts` with core types:

```typescript
// Card Types
export type CardStyle =
  | 'qa'
  | 'qa_bidirectional'
  | 'cloze'
  | 'cloze_list'
  | 'conceptual'
  | 'definition'
  | 'example';

export interface BaseCard {
  id?: string;
  style: CardStyle;
  tags?: string[];
  created_at?: string;
}

export interface QACard extends BaseCard {
  style: 'qa';
  question: string;
  answer: string;
}

export interface BidirectionalCard extends BaseCard {
  style: 'qa_bidirectional';
  forward: { question: string; answer: string };
  reverse: { question: string; answer: string };
}

export interface ClozeCard extends BaseCard {
  style: 'cloze';
  text: string;
  cloze_deletions: string[];
}

export interface ClozeListCard extends BaseCard {
  style: 'cloze_list';
  list_name: string;
  items: string[];
  prompts: string[];
}

export type Card = QACard | BidirectionalCard | ClozeCard | ClozeListCard;

// User Types
export interface User {
  id: string;
  email: string;
  created_at: string;
  subscription_tier?: 'free' | 'pro' | 'team';
}

// Deck Types
export interface Deck {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
  card_count?: number;
}

// Review Types
export interface ReviewResult {
  card_id: string;
  quality: 0 | 1 | 2 | 3 | 4 | 5;
  reviewed_at: string;
}

// SM-2 Algorithm Types
export interface SM2State {
  easiness: number;
  interval: number;
  repetitions: number;
  next_review: string;
}

// API Response Types
export interface GenerateCardsResponse {
  cards: Card[];
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

// Chrome Message Types (for extension)
export interface ExtensionMessage {
  action: string;
  payload?: unknown;
}

export interface SelectionContext {
  selectedText: string;
  surroundingContext: string;
  url: string;
  title: string;
}
```

### 1.6 Update Package Exports

- [ ] Update `packages/shared/package.json` to export types:
```json
{
  "exports": {
    ".": "./src/index.ts",
    "./types": "./src/types/index.ts"
  }
}
```

## Verification Steps

1. Run `npx tsc --version` to confirm TypeScript is installed
2. Run `npx tsc --noEmit -p packages/shared/tsconfig.json` - should complete (may have errors, that's ok)
3. Verify VS Code recognizes `.ts` files with IntelliSense
4. Confirm shared types can be imported: `import { Card } from '@pluckk/shared/types'`

## Notes for Agents

- This phase MUST be completed before any other phase begins
- The `strict: false` setting is intentional - we'll enable strict mode in Phase 6
- Chrome types come from `@types/chrome` package, not custom definitions
- If you encounter issues with Vite not recognizing TS, ensure `@vitejs/plugin-react` is up to date

## Files Created This Phase

| File | Purpose |
|------|---------|
| `/tsconfig.base.json` | Shared compiler options |
| `packages/shared/tsconfig.json` | Shared package config |
| `packages/api/tsconfig.json` | API package config |
| `packages/extension/tsconfig.json` | Extension config |
| `packages/webapp/tsconfig.json` | Webapp config |
| `packages/shared/src/types/index.ts` | Core type definitions |
