# Phase 5: Webapp Package (@pluckk/webapp)

> **Status:** Not Started
> **Estimated Hours:** 20-28
> **Prerequisites:** Phases 2, 3, 4 complete
> **Blocks:** Phase 6

## Objective

Convert the React webapp to TypeScript. This is the largest package by file count but benefits from excellent React TypeScript support.

## Package Structure

```
packages/webapp/src/
├── components/          # 15 React components
│   ├── ActivityGrid.jsx
│   ├── CardDisplay.jsx
│   ├── DeckSelector.jsx
│   ├── FolderList.jsx
│   ├── Header.jsx
│   ├── Logo.jsx
│   ├── Nav.jsx
│   ├── ReviewCard.jsx
│   └── ... (7 more)
├── hooks/               # 8 custom hooks
│   ├── useAuth.js
│   ├── useCards.js
│   ├── useDeck.js
│   ├── useProfile.js
│   ├── useReviewState.js  # Complex (647 lines)
│   └── ... (3 more)
├── pages/               # 9 page components
│   ├── CardsPage.jsx      # Complex (497 lines)
│   ├── LandingPage.jsx
│   ├── ReviewPage.jsx
│   ├── SettingsPage.jsx
│   └── ... (5 more)
├── App.jsx
├── main.jsx
└── index.css
```

## File Checklist

### Conversion Order Strategy

Convert in this order to minimize type errors:
1. **Hooks first** - They provide types that components consume
2. **Small components** - Build up type library
3. **Complex components** - With types already defined
4. **Pages** - Composed of typed components
5. **App entry** - Last

### Hooks (`packages/webapp/src/hooks/`)

| # | File | Lines | Status | Notes |
|---|------|-------|--------|-------|
| 1 | `useAuth.js` → `useAuth.ts` | ~80 | [ ] | Auth context hook |
| 2 | `useTheme.js` → `useTheme.ts` | ~40 | [ ] | Theme context hook |
| 3 | `useDeck.js` → `useDeck.ts` | ~100 | [ ] | Deck management |
| 4 | `useCards.js` → `useCards.ts` | ~120 | [ ] | Card CRUD operations |
| 5 | `useProfile.js` → `useProfile.ts` | ~80 | [ ] | User profile data |
| 6 | `useKeyboardShortcuts.js` → `.ts` | ~60 | [ ] | Keyboard handling |
| 7 | `useLocalStorage.js` → `.ts` | ~40 | [ ] | LocalStorage wrapper |
| 8 | `useReviewState.js` → `useReviewState.ts` | 647 | [ ] | **Complex** - Review session state |

### Components (`packages/webapp/src/components/`)

| # | File | Lines | Status | Notes |
|---|------|-------|--------|-------|
| 9 | `Logo.jsx` → `Logo.tsx` | ~30 | [ ] | Simple SVG component |
| 10 | `Header.jsx` → `Header.tsx` | ~60 | [ ] | App header |
| 11 | `Nav.jsx` → `Nav.tsx` | ~80 | [ ] | Navigation |
| 12 | `DeckSelector.jsx` → `DeckSelector.tsx` | ~100 | [ ] | Deck dropdown |
| 13 | `CardDisplay.jsx` → `CardDisplay.tsx` | ~150 | [ ] | Card rendering |
| 14 | `ActivityGrid.jsx` → `ActivityGrid.tsx` | 223 | [ ] | Activity visualization |
| 15 | `FolderList.jsx` → `FolderList.tsx` | 235 | [ ] | Folder/deck list |
| 16 | `ReviewCard.jsx` → `ReviewCard.tsx` | 363 | [ ] | Card review UI |
| 17 | (other small components) | varies | [ ] | Remaining components |

### Pages (`packages/webapp/src/pages/`)

| # | File | Lines | Status | Notes |
|---|------|-------|--------|-------|
| 18 | `LandingPage.jsx` → `LandingPage.tsx` | 448 | [ ] | Landing/marketing page |
| 19 | `ProfilePage.jsx` → `ProfilePage.tsx` | 287 | [ ] | User profile |
| 20 | `SettingsPage.jsx` → `SettingsPage.tsx` | 356 | [ ] | Settings UI |
| 21 | `ReviewPage.jsx` → `ReviewPage.tsx` | 294 | [ ] | Review session |
| 22 | `CardsPage.jsx` → `CardsPage.tsx` | 497 | [ ] | **Complex** - Card management with DnD |
| 23 | (other pages) | varies | [ ] | Remaining pages |

### Root Files

| # | File | Status | Notes |
|---|------|--------|-------|
| 24 | `App.jsx` → `App.tsx` | [ ] | Main app with router |
| 25 | `main.jsx` → `main.tsx` | [ ] | Entry point |

## Type Definitions to Create

### Component Prop Types

```typescript
// In packages/webapp/src/types/components.ts

import type { Card, Deck, User } from '@pluckk/shared/types';

// Card display props
export interface CardDisplayProps {
  card: Card;
  isSelected?: boolean;
  onSelect?: (card: Card) => void;
  onEdit?: (card: Card) => void;
  showActions?: boolean;
}

// Review card props
export interface ReviewCardProps {
  card: Card;
  isFlipped: boolean;
  onFlip: () => void;
  onRate: (quality: 0 | 1 | 2 | 3 | 4 | 5) => void;
}

// Deck selector props
export interface DeckSelectorProps {
  decks: Deck[];
  selectedDeckId?: string;
  onSelect: (deckId: string) => void;
  onCreateNew?: () => void;
}

// Activity grid props
export interface ActivityGridProps {
  data: ActivityData[];
  startDate?: Date;
  endDate?: Date;
}

export interface ActivityData {
  date: string;  // ISO date string
  count: number;
  reviews?: number;
  cardsAdded?: number;
}

// Folder list props
export interface FolderListProps {
  folders: Deck[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onReorder?: (folders: Deck[]) => void;
}
```

### Hook Return Types

```typescript
// In packages/webapp/src/types/hooks.ts

import type { User, Card, Deck } from '@pluckk/shared/types';

// useAuth return type
export interface UseAuthReturn {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
}

// useDeck return type
export interface UseDeckReturn {
  decks: Deck[];
  selectedDeck: Deck | null;
  isLoading: boolean;
  selectDeck: (id: string) => void;
  createDeck: (name: string) => Promise<Deck>;
  deleteDeck: (id: string) => Promise<void>;
  reorderDecks: (decks: Deck[]) => Promise<void>;
}

// useCards return type
export interface UseCardsReturn {
  cards: Card[];
  isLoading: boolean;
  error: string | null;
  addCard: (card: Omit<Card, 'id'>) => Promise<Card>;
  updateCard: (id: string, updates: Partial<Card>) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  moveCard: (cardId: string, toDeckId: string) => Promise<void>;
}

// useReviewState return type (complex)
export interface UseReviewStateReturn {
  // Current session
  currentCard: Card | null;
  remainingCards: number;
  sessionProgress: number;
  isFlipped: boolean;

  // Actions
  startSession: (deckId?: string) => void;
  flipCard: () => void;
  rateCard: (quality: 0 | 1 | 2 | 3 | 4 | 5) => void;
  skipCard: () => void;
  endSession: () => void;

  // Session state
  isSessionActive: boolean;
  sessionStats: SessionStats;
}

export interface SessionStats {
  totalReviewed: number;
  correctCount: number;
  incorrectCount: number;
  averageTime: number;
}
```

### Context Types

```typescript
// In packages/webapp/src/types/context.ts

import type { User } from '@pluckk/shared/types';

export interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

export interface ThemeContextValue {
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  resolvedTheme: 'light' | 'dark';
}
```

## Conversion Notes by File

### `useReviewState.js` → `useReviewState.ts` (Complex)

This is the most complex hook. Strategy:

1. **Define all state types first:**
   ```typescript
   interface ReviewState {
     queue: Card[];
     currentIndex: number;
     isFlipped: boolean;
     sessionStartTime: Date | null;
     reviewResults: ReviewResult[];
   }
   ```

2. **Type all useCallback functions:**
   ```typescript
   const rateCard = useCallback((quality: 0 | 1 | 2 | 3 | 4 | 5) => {
     // ...
   }, [/* deps */]);
   ```

3. **Type useMemo return values:**
   ```typescript
   const sessionStats = useMemo((): SessionStats => ({
     totalReviewed: reviewResults.length,
     // ...
   }), [reviewResults]);
   ```

### `CardsPage.jsx` → `CardsPage.tsx` (Complex)

Uses @dnd-kit for drag-and-drop. Key typing:

1. **DnD types (from library):**
   ```typescript
   import {
     DndContext,
     DragEndEvent,
     DragOverEvent,
     useSensor,
     useSensors,
     PointerSensor,
   } from '@dnd-kit/core';
   ```

2. **Event handlers:**
   ```typescript
   const handleDragEnd = (event: DragEndEvent) => {
     const { active, over } = event;
     // ...
   };
   ```

3. **Sortable items:**
   ```typescript
   import { useSortable } from '@dnd-kit/sortable';

   function SortableCard({ card }: { card: Card }) {
     const { attributes, listeners, setNodeRef, transform } = useSortable({
       id: card.id,
     });
     // ...
   }
   ```

### `ActivityGrid.jsx` → `ActivityGrid.tsx`

Data visualization component. Key typing:

```typescript
interface CellData {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;  // Intensity level
}

const ActivityGrid: React.FC<ActivityGridProps> = ({ data, startDate, endDate }) => {
  const cells = useMemo((): CellData[] => {
    // Calculate grid cells
  }, [data, startDate, endDate]);

  return (
    <div className="activity-grid">
      {cells.map((cell) => (
        <div
          key={cell.date}
          className={`cell level-${cell.level}`}
          title={`${cell.count} reviews on ${cell.date}`}
        />
      ))}
    </div>
  );
};
```

## React TypeScript Patterns

### Function Components

```typescript
// Preferred: FC with explicit props
interface Props {
  title: string;
  children: React.ReactNode;
}

const MyComponent: React.FC<Props> = ({ title, children }) => {
  return <div>{title}{children}</div>;
};

// Alternative: function declaration
function MyComponent({ title, children }: Props): JSX.Element {
  return <div>{title}{children}</div>;
}
```

### Event Handlers

```typescript
// Click handlers
const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
  // ...
};

// Input handlers
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  setValue(e.target.value);
};

// Form handlers
const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  // ...
};

// Keyboard handlers
const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
  if (e.key === 'Enter') {
    // ...
  }
};
```

### Refs

```typescript
// DOM refs
const inputRef = useRef<HTMLInputElement>(null);

// Mutable refs
const countRef = useRef<number>(0);

// Callback refs
const setRef = useCallback((node: HTMLDivElement | null) => {
  if (node) {
    // Do something with node
  }
}, []);
```

### Context

```typescript
// Create typed context
const AuthContext = createContext<AuthContextValue | null>(null);

// Custom hook for context
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

// Provider component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  // ...
  return (
    <AuthContext.Provider value={{ user, /* ... */ }}>
      {children}
    </AuthContext.Provider>
  );
};
```

## Verification Steps

1. After each file conversion:
   ```bash
   cd packages/webapp && npx tsc --noEmit
   ```

2. Run the dev server:
   ```bash
   yarn dev
   ```

3. Test all pages in browser:
   - Landing page loads
   - Login/logout works
   - Cards page with drag-drop
   - Review session flow
   - Settings page

4. Check browser console for React warnings

## Common Issues

### Issue: Children prop type
**Solution:** Use `React.ReactNode`:
```typescript
interface Props {
  children: React.ReactNode;
}
```

### Issue: Event handler types
**Solution:** Use React's event types:
```typescript
onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
```

### Issue: Optional callback props
**Solution:** Make optional and check before calling:
```typescript
interface Props {
  onSelect?: (id: string) => void;
}
// Usage
props.onSelect?.(id);
```

### Issue: Forwarding refs
**Solution:** Use forwardRef:
```typescript
const Input = forwardRef<HTMLInputElement, Props>((props, ref) => {
  return <input ref={ref} {...props} />;
});
```

## Files to Create

| File | Purpose |
|------|---------|
| `src/types/components.ts` | Component prop types |
| `src/types/hooks.ts` | Hook return types |
| `src/types/context.ts` | Context types |
| `src/types/index.ts` | Re-export all types |

## Definition of Done

- [ ] All 37 files converted from `.jsx`/`.js` to `.tsx`/`.ts`
- [ ] All type definition files created
- [ ] `npx tsc --noEmit` passes with no errors
- [ ] `yarn dev` starts without errors
- [ ] All pages render correctly
- [ ] All user flows work (login, review, card management)
- [ ] No React warnings in console
