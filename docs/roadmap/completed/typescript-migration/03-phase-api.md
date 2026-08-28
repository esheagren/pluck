# Phase 3: API Package (@pluckk/api)

> **Status:** Not Started
> **Estimated Hours:** 8-12
> **Prerequisites:** Phase 2 complete
> **Can Parallel With:** Phase 4 (Extension)

## Objective

Convert the `@pluckk/api` package to TypeScript. This package contains Vercel serverless API endpoints.

## Package Structure

```
packages/api/
├── api/                    # Serverless endpoint handlers
│   ├── generate-cards.js   # Claude API integration
│   ├── health.js           # Health check endpoint
│   ├── user/               # User-related endpoints
│   └── webhooks/           # Stripe webhooks
└── lib/                    # Shared utilities
    ├── auth.js             # Authentication helpers
    ├── stripe.js           # Stripe client
    └── supabase-admin.js   # Admin Supabase client
```

## File Checklist

### Library Files (`packages/api/lib/`)

| File | Lines | Status | Notes |
|------|-------|--------|-------|
| `auth.js` → `auth.ts` | ~80 | [ ] | JWT validation, user extraction |
| `stripe.js` → `stripe.ts` | ~40 | [ ] | Stripe client - has native types |
| `supabase-admin.js` → `supabase-admin.ts` | ~30 | [ ] | Admin client with service role |

### API Endpoints (`packages/api/api/`)

| File | Lines | Status | Notes |
|------|-------|--------|-------|
| `generate-cards.js` → `generate-cards.ts` | 205 | [ ] | **Complex** - Claude API, card generation |
| `health.js` → `health.ts` | ~20 | [ ] | Simple health check |
| `user/profile.js` → `user/profile.ts` | ~60 | [ ] | Get user profile |
| `user/usage.js` → `user/usage.ts` | ~80 | [ ] | Usage statistics |
| `user/subscription.js` → `user/subscription.ts` | ~70 | [ ] | Subscription status |
| `webhooks/stripe.js` → `webhooks/stripe.ts` | 211 | [ ] | **Complex** - Stripe webhook handling |
| `decks/list.js` → `decks/list.ts` | ~50 | [ ] | List user decks |
| `decks/create.js` → `decks/create.ts` | ~60 | [ ] | Create deck |
| `cards/create.js` → `cards/create.ts` | ~80 | [ ] | Create card |
| `cards/review.js` → `cards/review.ts` | ~90 | [ ] | Submit review result |
| `feedback/submit.js` → `feedback/submit.ts` | ~50 | [ ] | Submit feedback |

## Type Definitions to Create

### API Request/Response Types

```typescript
// In packages/api/lib/types.ts

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Card, User, Deck } from '@pluckk/shared/types';

// Vercel handler type
export type ApiHandler = (
  req: VercelRequest,
  res: VercelResponse
) => Promise<void> | void;

// Generate cards request
export interface GenerateCardsRequest {
  selectedText: string;
  surroundingContext?: string;
  url?: string;
  title?: string;
  preferences?: {
    cardStyle?: string;
    difficulty?: string;
  };
}

// Generate cards response
export interface GenerateCardsResponse {
  success: boolean;
  cards?: Card[];
  error?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

// Standard API error response
export interface ApiError {
  success: false;
  error: string;
  code?: string;
}

// Authenticated request (after auth middleware)
export interface AuthenticatedRequest extends VercelRequest {
  user: User;
}
```

### Stripe Webhook Types

```typescript
// In packages/api/lib/stripe-types.ts

import type Stripe from 'stripe';

export interface WebhookHandlers {
  'checkout.session.completed': (session: Stripe.Checkout.Session) => Promise<void>;
  'customer.subscription.updated': (subscription: Stripe.Subscription) => Promise<void>;
  'customer.subscription.deleted': (subscription: Stripe.Subscription) => Promise<void>;
  'invoice.payment_failed': (invoice: Stripe.Invoice) => Promise<void>;
}

export type WebhookEventType = keyof WebhookHandlers;
```

### Claude API Types

```typescript
// In packages/api/lib/claude-types.ts

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeRequest {
  model: string;
  max_tokens: number;
  messages: ClaudeMessage[];
  system?: string;
}

export interface ClaudeResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: 'text';
    text: string;
  }>;
  model: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}
```

## Conversion Notes by File

### `generate-cards.js` → `generate-cards.ts`

This is the most complex file. Key typing needs:

1. **Request validation:**
   ```typescript
   const { selectedText, surroundingContext, url, title } =
     req.body as GenerateCardsRequest;
   ```

2. **Claude API call:**
   ```typescript
   const response = await fetch('https://api.anthropic.com/v1/messages', {
     // ...
   });
   const data: ClaudeResponse = await response.json();
   ```

3. **Parse JSON from Claude response:**
   ```typescript
   // Claude returns JSON string in content, needs parsing
   const cardsJson = JSON.parse(data.content[0].text);
   const cards: Card[] = cardsJson.cards;
   ```

### `webhooks/stripe.js` → `webhooks/stripe.ts`

1. **Stripe event typing:**
   ```typescript
   import Stripe from 'stripe';

   const event = stripe.webhooks.constructEvent(
     rawBody,
     signature,
     webhookSecret
   ) as Stripe.Event;
   ```

2. **Switch on event type with type narrowing:**
   ```typescript
   switch (event.type) {
     case 'checkout.session.completed':
       const session = event.data.object as Stripe.Checkout.Session;
       // ...
       break;
   }
   ```

### `auth.js` → `auth.ts`

1. **Export middleware function:**
   ```typescript
   export function withAuth(handler: ApiHandler): ApiHandler {
     return async (req, res) => {
       const user = await validateToken(req);
       if (!user) {
         return res.status(401).json({ error: 'Unauthorized' });
       }
       (req as AuthenticatedRequest).user = user;
       return handler(req, res);
     };
   }
   ```

## Vercel-Specific Considerations

1. **Install Vercel types:**
   ```bash
   yarn add -D @vercel/node
   ```

2. **Handler export pattern:**
   ```typescript
   // Each API file exports default handler
   import type { VercelRequest, VercelResponse } from '@vercel/node';

   export default async function handler(
     req: VercelRequest,
     res: VercelResponse
   ) {
     // ...
   }
   ```

3. **Environment variables:**
   ```typescript
   // Type-safe env access
   const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
   if (!CLAUDE_API_KEY) {
     throw new Error('CLAUDE_API_KEY not configured');
   }
   ```

## Verification Steps

1. After each file conversion:
   ```bash
   cd packages/api && npx tsc --noEmit
   ```

2. Test endpoints locally with Vercel CLI:
   ```bash
   vercel dev
   ```

3. Test each endpoint:
   - `GET /api/health` - Should return 200
   - `POST /api/generate-cards` - Test with sample text

## Common Issues

### Issue: Stripe types not found
**Solution:** Stripe has built-in types, just import:
```typescript
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});
```

### Issue: Request body typing
**Solution:** Use type assertion after validation:
```typescript
if (!req.body?.selectedText) {
  return res.status(400).json({ error: 'Missing selectedText' });
}
const body = req.body as GenerateCardsRequest;
```

## Files to Create

| File | Purpose |
|------|---------|
| `lib/types.ts` | API request/response types |
| `lib/stripe-types.ts` | Stripe webhook types |
| `lib/claude-types.ts` | Claude API types |

## Definition of Done

- [ ] All 15 files converted from `.js` to `.ts`
- [ ] All type definition files created
- [ ] `npx tsc --noEmit` passes with no errors
- [ ] `vercel dev` starts without errors
- [ ] All API endpoints respond correctly
