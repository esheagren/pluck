# Onboarding Flow & User Profile Implementation Plan

**Status:** Complete
**Created:** 2026-01-20
**Started:** 2026-01-20
**Completed:** 2026-01-20

## TL;DR
Add a one-time onboarding wizard after first sign-in that collects user information (role, goals, expertise, domains, preferences) to build a persona prompt that personalizes card generation.

## Critical Decisions
- **Trigger:** Wizard appears once after first Google OAuth sign-in, can be skipped without reminders
- **Storage:** New columns in existing `users` table (not a separate table)
- **Integration:** Persona prepended to existing system prompt as "User Context" section
- **Editability:** Learning profile editable via new section in Settings page

## Profile Fields

| Field | Type | UI | Purpose |
|-------|------|-----|---------|
| `role` | text | Text input | "What's your role?" (e.g., "Medical student", "Software engineer") |
| `learning_goals` | text | Textarea | "What are you trying to learn?" |
| `expertise_level` | enum | Radio buttons | beginner / intermediate / expert |
| `card_style` | enum | Radio buttons | concise / balanced / detailed |
| `domains` | text[] | Checkboxes + free text | Predefined categories + custom topics |
| `onboarding_completed` | boolean | - | Track if wizard was completed or skipped |

**Predefined domain categories:** Medicine, Law, Languages, Programming, Science, History, Business, Other

## Tasks

**Overall Progress:** 100%

- [x] **Step 1: Database Schema**
  - [x] Add new columns to `users` table via migration
  - [x] Add `onboarding_completed` boolean (default false)
  - [x] Add `role`, `learning_goals`, `expertise_level`, `card_style`, `domains` columns

- [x] **Step 2: API Endpoints**
  - [x] Extend `GET /api/user/me` to return new profile fields
  - [x] Extend `PATCH /api/user/me` to accept new profile fields
  - [x] Add validation for enum fields

- [x] **Step 3: Onboarding Wizard Component**
  - [x] Create `OnboardingWizard.tsx` component with multi-step form
  - [x] Step 1: Role + Learning Goals
  - [x] Step 2: Expertise Level + Card Style preference
  - [x] Step 3: Domains (checkboxes + free text)
  - [x] Add "Skip for now" button on each step
  - [x] Submit to `PATCH /api/user/me` on completion

- [x] **Step 4: Wizard Trigger Logic**
  - [x] Modify `useAuth.ts` to check `onboarding_completed` after sign-in
  - [x] Show wizard modal when `onboarding_completed === false` and user is new
  - [x] Set `onboarding_completed = true` after completion or skip

- [x] **Step 5: Settings Page Integration**
  - [x] Add "Learning Profile" section to SettingsPage.tsx
  - [x] Reuse form fields from wizard (DRY)
  - [x] Allow editing all profile fields

- [x] **Step 6: Persona Prompt Generation**
  - [x] Create `buildPersonaPrompt(userProfile)` function in shared/constants/
  - [x] Generate contextual prompt section from profile fields
  - [x] Handle empty/partial profiles gracefully

- [x] **Step 7: Card Generation Integration**
  - [x] Modify `generate-cards.ts` to use user profile
  - [x] Prepend persona prompt to system prompt
  - [x] Build passes with all changes

## Relevant Files

**Database:**
- `packages/api/migrations/` - Add new migration file

**API:**
- `packages/api/api/user/me.ts` - Extend GET/PATCH handlers
- `packages/api/lib/types.ts` - Add new UserProfile fields

**Webapp:**
- `packages/webapp/src/components/OnboardingWizard.tsx` - New component
- `packages/webapp/src/pages/SettingsPage.tsx` - Add Learning Profile section
- `packages/webapp/src/hooks/useAuth.ts` - Add onboarding check
- `packages/webapp/src/types/hooks.ts` - Extend Profile type

**Shared:**
- `packages/shared/src/constants/prompts.ts` - Add persona prompt builder

**Card Generation:**
- `packages/api/api/generate-cards.ts` - Inject persona into system prompt

## Persona Prompt Example

Given a user profile:
```json
{
  "role": "Medical student",
  "learning_goals": "Preparing for USMLE Step 1, focusing on pathophysiology",
  "expertise_level": "intermediate",
  "card_style": "concise",
  "domains": ["Medicine", "Biochemistry"]
}
```

Generated persona section:
```
## User Context
The user is a Medical student with intermediate expertise.
Learning goals: Preparing for USMLE Step 1, focusing on pathophysiology
Domains of study: Medicine, Biochemistry
Card style preference: concise (favor brevity over elaboration)

Tailor cards to this context. Use terminology appropriate for their expertise level. Focus on their stated goals when possible.
```

## Testing Plan
- [ ] Wizard appears only for new users on first sign-in
- [ ] Wizard does not appear for existing users (migration sets `onboarding_completed = true`)
- [ ] Skip button works and sets `onboarding_completed = true`
- [ ] Profile fields save correctly to database
- [ ] Settings page shows and allows editing of all fields
- [ ] Card generation includes persona in prompt
- [ ] Cards generated reflect user's expertise level and style preference
- [ ] Empty profile fields don't break card generation

## Rollback Plan
1. Remove persona injection from `generate-cards.ts` (instant rollback)
2. Hide wizard by checking a feature flag or always returning `onboarding_completed = true`
3. Database columns can remain (nullable, no breaking changes)

## Open Questions (Resolved)
- ~~Trigger timing~~ → After first sign-in only
- ~~Skip behavior~~ → Allow skip, no reminders
- ~~Field set~~ → Comprehensive (role, goals, expertise, style, domains)
- ~~Domain capture~~ → Predefined checkboxes + free text
- ~~Edit location~~ → Settings page
