# Phase 6: Strict Mode & Polish

> **Status:** Complete
> **Estimated Hours:** 10-15
> **Prerequisites:** Phases 1-5 complete
> **Blocks:** None (final phase)

## Objective

Enable TypeScript strict mode across all packages, fix all resulting errors, and ensure the codebase has full type safety.

## Why a Separate Phase

Enabling `strict: true` from the start would create hundreds of errors, making incremental progress difficult. By converting files first with relaxed settings, then enabling strict mode, we can:

1. Make steady progress through conversion
2. Batch strict-mode fixes at the end
3. Ensure nothing is missed

## Strict Mode Settings

### Current (Relaxed) Settings
```json
{
  "strict": false,
  "noImplicitAny": false,
  "strictNullChecks": false
}
```

### Target (Strict) Settings
```json
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "strictFunctionTypes": true,
  "strictBindCallApply": true,
  "strictPropertyInitialization": true,
  "noImplicitThis": true,
  "useUnknownInCatchVariables": true,
  "alwaysStrict": true
}
```

## Checklist

### 6.1 Enable Strict Mode Incrementally

Enable one flag at a time and fix errors:

- [ ] **Step 1:** Enable `noImplicitAny: true`
  ```bash
  # Check error count
  npx tsc --noEmit 2>&1 | grep -c "error TS"
  ```

- [ ] **Step 2:** Enable `strictNullChecks: true`
  - This will likely produce the most errors
  - Focus on optional chaining and nullish coalescing

- [ ] **Step 3:** Enable `strictFunctionTypes: true`
  - Usually fewer errors
  - Watch for callback type issues

- [ ] **Step 4:** Enable full `strict: true`
  - Catch remaining issues

### 6.2 Package-by-Package Strict Fixes

#### Shared Package
- [ ] Fix all `noImplicitAny` errors
- [ ] Add null checks to all function parameters
- [ ] Verify all exports have explicit types

#### API Package
- [ ] Type all request body parsing
- [ ] Add null checks to env variable access
- [ ] Type all error handling catch blocks

#### Extension Package
- [ ] Type all DOM queries (may be null)
- [ ] Add null checks to Chrome API responses
- [ ] Type all message handler parameters

#### Webapp Package
- [ ] Type all useState initial values
- [ ] Add null checks to refs
- [ ] Type all useCallback/useMemo returns

### 6.3 Common Strict Mode Fixes

Track fixes by category:

| Category | Count | Status |
|----------|-------|--------|
| Implicit any parameters | - | [ ] |
| Null/undefined checks | - | [ ] |
| Missing return types | - | [ ] |
| Untyped catch clauses | - | [ ] |
| Optional property access | - | [ ] |

## Common Error Patterns & Fixes

### 1. Implicit Any Parameters

**Error:** `Parameter 'x' implicitly has an 'any' type`

**Before:**
```typescript
function process(data) {
  return data.value;
}
```

**After:**
```typescript
interface DataInput {
  value: string;
}

function process(data: DataInput): string {
  return data.value;
}
```

### 2. Possible Null/Undefined

**Error:** `Object is possibly 'null'`

**Before:**
```typescript
const element = document.querySelector('.card');
element.classList.add('selected');  // Error!
```

**After (Option A - Null check):**
```typescript
const element = document.querySelector('.card');
if (element) {
  element.classList.add('selected');
}
```

**After (Option B - Non-null assertion, use sparingly):**
```typescript
const element = document.querySelector('.card')!;
element.classList.add('selected');
```

**After (Option C - Optional chaining):**
```typescript
const element = document.querySelector('.card');
element?.classList.add('selected');
```

### 3. Untyped Catch Clauses

**Error:** `Catch clause variable type annotation must be 'any' or 'unknown'`

**Before:**
```typescript
try {
  await fetchData();
} catch (error) {
  console.log(error.message);  // Error in strict mode
}
```

**After:**
```typescript
try {
  await fetchData();
} catch (error) {
  if (error instanceof Error) {
    console.log(error.message);
  } else {
    console.log('Unknown error');
  }
}

// Or use a helper
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
```

### 4. Missing Return Types

**Error:** Function return type should be explicit in strict mode

**Before:**
```typescript
function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

**After:**
```typescript
interface Item {
  price: number;
}

function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

### 5. useState with Null Initial Value

**Before:**
```typescript
const [user, setUser] = useState(null);  // Type is 'null'
```

**After:**
```typescript
const [user, setUser] = useState<User | null>(null);
```

### 6. Ref Objects

**Before:**
```typescript
const ref = useRef(null);
ref.current.focus();  // Error: possibly null
```

**After:**
```typescript
const ref = useRef<HTMLInputElement>(null);
ref.current?.focus();

// Or if you know it's set:
if (ref.current) {
  ref.current.focus();
}
```

### 7. Event Handler Parameters

**Before:**
```typescript
const handleClick = (e) => {  // implicit any
  e.preventDefault();
};
```

**After:**
```typescript
const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.preventDefault();
};
```

### 8. Object Index Signatures

**Before:**
```typescript
const handlers = {
  click: handleClick,
  hover: handleHover,
};
handlers[eventType]();  // Error: implicit any
```

**After:**
```typescript
const handlers: Record<string, () => void> = {
  click: handleClick,
  hover: handleHover,
};
handlers[eventType]?.();
```

## Verification Steps

### Per-Package Verification

```bash
# Check each package individually
cd packages/shared && npx tsc --noEmit
cd packages/api && npx tsc --noEmit
cd packages/extension && npx tsc --noEmit
cd packages/webapp && npx tsc --noEmit
```

### Full Build Verification

```bash
# Build all packages
yarn build

# Run any existing tests
yarn test
```

### Runtime Verification

1. **Extension:**
   - Load in Chrome
   - Test all features
   - Check DevTools console for errors

2. **Webapp:**
   - Run dev server
   - Navigate all pages
   - Test all user flows
   - Check browser console

3. **API:**
   - Deploy to Vercel preview
   - Test all endpoints
   - Verify error handling

## Final Checklist

- [ ] `strict: true` enabled in `tsconfig.base.json`
- [ ] All packages compile without errors
- [ ] Extension builds and runs correctly
- [ ] Webapp builds and runs correctly
- [ ] API deploys and responds correctly
- [ ] No `any` types remaining (or justified with comments)
- [ ] No `@ts-ignore` comments (or justified)
- [ ] All type exports documented

## Cleanup Tasks

- [ ] Remove any `// @ts-nocheck` comments added during conversion
- [ ] Review and remove unnecessary type assertions (`as`)
- [ ] Ensure consistent type import style (`import type`)
- [ ] Add JSDoc comments to exported types
- [ ] Update package.json exports for type declarations

## Definition of Done

- [ ] `strict: true` enabled in all tsconfigs
- [ ] `npx tsc --noEmit` passes in all packages
- [ ] No TypeScript errors anywhere
- [ ] All features work correctly
- [ ] Code review completed
- [ ] Documentation updated (if needed)

## Post-Migration Benefits

After completing this phase, the codebase will have:

1. **Full type safety** - Catch errors at compile time
2. **Better IDE support** - Autocomplete, refactoring, go-to-definition
3. **Self-documenting code** - Types serve as documentation
4. **Safer refactoring** - TypeScript catches breaking changes
5. **Improved maintainability** - New developers understand code faster
