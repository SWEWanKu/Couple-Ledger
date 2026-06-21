# Record Detail Read Plan

## Goal

Design a future read-only `/records/[id]` page that shows one ledger record for the current household.

The page should help an approved household member inspect a single entry without changing ledger data. It should reuse the existing protected server route pattern already used by `/dashboard`, `/records`, and `/records/new`.

## Non-goals

This design does not include:

- edit
- delete
- income creation
- settlement calculation
- migrations
- SQL execution
- service role
- admin bypass
- localStorage

It also does not implement the route, data helper, links, or any source-code change yet.

## Current Implementation Notes

- `/records` already lists household-scoped `ledger_entries` in read-only mode.
- `/records/new` already creates expense `ledger_entries` and matching `ledger_entry_splits`.
- `src/lib/auth/household-access.ts` is not present at the time of this plan.
- Current household access logic is page-local in existing private routes and should be reused consistently or extracted in a separate focused task.

## Route

- Route: `/records/[id]`
- Type: protected server route.
- Anonymous users redirect to `/login`.
- Authenticated users without household membership redirect to `/not-invited`.
- A non-existing entry should show a not-found state.
- A cross-household entry should show not found or a safe redirect, never partial data.

The route must not trust `params.id` by itself. The URL id only identifies a candidate row after household membership has already been verified.

## Security Boundary

The detail page must use the existing household access guard pattern before reading ledger data.

All queries must be scoped by the current household id. The main entry query must require both:

- `ledger_entries.id = params.id`
- `ledger_entries.household_id = current household id`

Security rules:

- never trust the URL id alone
- never query another household
- no `allowed_user_emails` query from app code
- no service role
- no admin bypass
- no localStorage
- RLS remains the real database boundary

The application-side household filter is a defensive UX and correctness layer. Supabase RLS is still the real protection if a request bypasses the route.

## Data To Read

Read one row from `ledger_entries`:

- `id`
- `household_id`
- `amount`
- `entry_type`
- `category_id`
- `paid_by`
- `split_mode`
- `occurred_on`
- `note`
- `created_by`
- `created_at`

Read related display data:

- category label, icon, and color from `categories`
- `paid_by` display name or email from `profiles`
- `created_by` display name or email from `profiles`

The page may read `ledger_entry_splits` for the verified entry.

Split read rules:

- only read splits after the parent entry is verified for the current household
- split query must be scoped through the verified entry id and household access
- no split writes

Read split fields:

- `user_id`
- `share_amount`
- profile display name or email

## UI Content

The detail page should show:

- amount
- 支出/收入 type label
- category
- `occurred_on`
- note
- paid by
- created by
- `created_at`
- split mode
- split breakdown
- back link to `/records`
- link to `/records/new`

Split mode labels:

- `equal` = `两人平分`
- `personal` = `个人承担`
- `custom` = `自定义分摊` if custom rows exist later

Split breakdown:

- show each member and their share amount
- use the same money formatting as `/records`
- if a profile is missing, fall back to a neutral member label
- do not infer missing split rows silently

The visual treatment should stay consistent with the existing Animal-Island-style records surfaces: warm card surfaces, brown text, soft borders, mint or yellow accents, and clear read-only wording.

## Empty/Error States

Loading is not needed for the server-rendered page beyond the existing app route loading behavior.

Required states:

- record not found
- unauthorized or cross-household record
- missing category
- missing paid-by profile
- missing created-by profile
- missing or incomplete split rows

Graceful degradation:

- missing category should show an uncategorized label
- missing profile should show a neutral member label or email if safely available
- missing splits should show a friendly incomplete-split notice
- raw Supabase errors should not be exposed in the UI

## Implementation Plan

Future implementation should be split into small steps:

1. Create `src/lib/ledger/get-record-detail.ts`.
2. Create `src/app/records/[id]/page.tsx`.
3. Link record cards from `/records` to `/records/[id]`.
4. Verify logged-out redirect.
5. Verify cross-household safety.
6. Verify split breakdown display.

Recommended helper shape:

- accept Supabase server client
- accept current household id
- accept current user id only if display fallback needs it
- accept record id from route params
- return a normalized read model for the page
- return not-found or warning states without throwing raw database details into UI

The first implementation should avoid adding edit, delete, settlement, income creation, migrations, package changes, or SQL files.

## Verification Plan

Future implementation should run:

```powershell
rg -n "ledger_entries|ledger_entry_splits|insert\(|update\(|delete\(|service_role|SUPABASE_SERVICE|localStorage|allowed_user_emails" src/app src/lib src/types
npm run build
git status --short
```

Expected verification:

- detail implementation uses read-only queries only
- `ledger_entry_splits` is allowed only in the detail read helper/page
- no `insert`
- no `update`
- no `delete`
- no service role
- no `localStorage`
- no direct `allowed_user_emails`
- build passes

Manual checks for the future code task:

- logged-out `/records/[id]` redirects to `/login`
- authenticated user without household membership redirects to `/not-invited`
- current household member can read one own-household record
- cross-household id does not expose data
- missing or malformed id does not crash
- split rows display member labels and share amounts
- `/records` cards navigate to the detail page

## Stop Conditions For Future Implementation

Stop and report instead of guessing if:

- household access cannot be verified
- a profile join requires an RLS policy not yet available
- split rows cannot be read without broadening security scope
- detail page needs a new migration
- the implementation would require service role credentials
- the implementation would require writes
