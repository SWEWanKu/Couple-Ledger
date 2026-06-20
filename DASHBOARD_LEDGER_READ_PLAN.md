# Dashboard Ledger Read Plan

## Current state

- `/dashboard` is protected server-side.
- Anonymous users are redirected to `/login`.
- Authenticated users without household membership are redirected to `/not-invited`.
- Approved household members can access the dashboard.
- Dashboard reads real household summary:
  - household name
  - member count
  - category count
  - category list
- Money/stat sections still use mock data.
- `ledger_entries` and `ledger_entry_splits` are not queried yet.

## Goal

Replace dashboard mock financial data with read-only Supabase queries.

Do this before any write flows:

- monthly expense total
- monthly income total
- monthly balance
- recent records
- category breakdown
- payer summary
- settlement preview

## Non-goals

- no add-record form
- no edit/delete record
- no writes
- no migrations
- no RLS changes
- no new tables
- no `localStorage`
- no service role
- no client-side data authority
- no Supabase SQL execution from this planning task
- no test ledger data seeding from this planning task

## Data model involved

The read-only dashboard aggregation should stay within the existing household model:

- `households`
  - Owns the private couple ledger boundary.
  - Current dashboard already reads the active household name after membership is verified.
- `household_members`
  - Joins each approved Auth user to a household.
  - Defines the security boundary for every household-scoped dashboard query.
  - Provides the member list needed for payer summary and settlement preview.
- `categories`
  - Belongs to a household.
  - Labels ledger entries and powers category breakdown.
  - Current dashboard already reads the category list.
- `ledger_entries`
  - Main read source for expenses and income.
  - Relevant columns for dashboard reads:
    - `household_id`
    - `amount`
    - `entry_type`
    - `category_id`
    - `paid_by`
    - `split_mode`
    - `occurred_on`
    - `note`
    - `created_at`
- `ledger_entry_splits`
  - Per-member share rows for an entry.
  - Needed for settlement preview because `paid_by` alone only tells who paid, not who owes.
  - Relevant columns for dashboard reads:
    - `entry_id`
    - `user_id`
    - `share_amount`
- `profiles`
  - Optional display source for member names.
  - Do not make the first ledger read implementation depend on profiles unless the current RLS policy allows same-household profile display.
  - If profile display is unavailable, use role labels or neutral member labels.

## Query boundary

All dashboard queries must:

- use the existing server Supabase client
- run after `requireHouseholdAccess` or the equivalent server-side household access guard
- scope by the current household id
- rely on RLS
- never query another household
- never use service role credentials
- never query `allowed_user_emails` directly
- never move the source of truth into browser state

The first implementation should keep the current private route behavior unchanged:

- anonymous user -> `/login`
- authenticated user without membership -> `/not-invited`
- household member -> dashboard reads household-scoped data

## Date range rules

Default dashboard range:

- current calendar month
- use local app date logic for the selected month
- query `occurred_on >= monthStart`
- query `occurred_on < nextMonthStart`

Future URL/search param support:

- later dashboard can support `?month=YYYY-MM`
- the first implementation can skip this unless it stays simple and server-only
- invalid month params should fall back to the current calendar month or return a friendly empty state

Date handling should produce date-only boundaries in the same format used by Supabase/Postgres `date` columns. Avoid mixing client timezone timestamps with `occurred_on` date comparisons.

## Amount rules

- `ledger_entries.amount` is positive.
- `entry_type = expense` counts toward expense.
- `entry_type = income` counts toward income.
- balance = income - expense.
- Personal/shared semantics should not distort total household expense.
- Settlement should use split data, not only `paid_by`.
- Category expense breakdown should include expense entries only unless a future UI explicitly asks for income categories.
- Recent records may show both expense and income entries, clearly labelled by `entry_type`.

## First implementation scope

The first code implementation should read:

- current household
- household members
- categories
- this month's ledger entries
- related category labels
- related split rows if needed for settlement preview
- payer/member display if needed

But it should only display:

- expense total
- income total
- balance
- recent records
- category expense breakdown
- simple payer summary

Recommended behavior for this first pass:

- Keep dashboard layout and Animal-Island visual direction intact.
- Replace only the mock money/stat data source.
- Keep any not-yet-supported areas clearly labelled rather than pretending they are complete.
- Avoid adding filters, forms, editing, or record detail pages in the same task.

## Settlement preview rules

Use a conservative first version:

- use expense entries only
- ignore income for settlement
- personal entries should not create shared debt
- equal/custom split entries use `ledger_entry_splits`
- compute:
  - each member paid amount
  - each member share amount
  - net = paid - share
- if only two members:
  - person with negative net owes person with positive net
- if no split rows exist:
  - show "Split data is incomplete"
  - do not guess silently

Additional settlement notes:

- `paid_by` contributes to paid amount.
- `ledger_entry_splits.share_amount` contributes to share amount.
- A member with `net > 0` paid more than their share.
- A member with `net < 0` paid less than their share.
- If both net values are zero, show no settlement needed.
- If the household ever has more than two members, do not reuse the two-person shortcut without a separate design.

## Empty state

When there are no ledger entries:

- all totals should be zero
- recent records should show empty state
- category breakdown should show empty state
- payer summary should show empty state or zero-paid members
- settlement preview should say no settlement needed yet

Empty states should be friendly and explicit. They should not look like loading failures and should not expose raw Supabase errors.

## Proposed files for future implementation

Suggest future code files:

- `src/lib/dashboard/ledger-summary.ts`
  - Server-only read helper for monthly ledger aggregation.
  - Should accept household id, member ids, and date range.
  - Should return normalized dashboard data, not UI components.
- `src/types/dashboard.ts`
  - Extend existing dashboard types with ledger summary, recent record, category breakdown, payer summary, and settlement preview types.
- `src/app/dashboard/page.tsx`
  - Call the ledger summary helper after household access is established.
  - Replace mock financial/stat sections with the read-only summary result.

Do not create these implementation changes in this planning task unless the files already exist and are being edited in a future code task.

## Verification plan for future implementation

Future code task should verify:

- `npm run build`
- logged-out `/dashboard` redirects to `/login`
- approved user `/dashboard` shows real household summary
- with no entries: zero totals
- with seeded sample entries: totals match SQL
- no service role
- no `localStorage`
- no writes
- no cross-household reads
- no direct `allowed_user_emails` query
- no client-side aggregation from unscoped data

Suggested grep checks for the future code task:

- confirm `ledger_entries` and `ledger_entry_splits` reads exist only in the dashboard read helper
- confirm no write APIs are introduced
- confirm no migration files change
- confirm no package files change

## Test data strategy

Do not seed test data in this document.

Recommend a later separate local-only or admin-only test-data task:

- create a few sample `ledger_entries`
- create matching `ledger_entry_splits`
- verify totals manually
- verify settlement math manually
- remove or keep sample data intentionally

Sample-data work should be isolated from the first read-only implementation. It should clearly state whether data is local-only, admin-created, or intentionally kept in the development Supabase project.
