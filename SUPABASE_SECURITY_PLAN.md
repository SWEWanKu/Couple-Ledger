# Supabase Security / RLS Plan

## Current state

- OTP login works.
- Supabase SSR clients exist.
- Middleware only refreshes/propagates auth cookies.
- No route protection yet.
- No database schema/RLS yet.
- No ledger persistence yet.

## Security goal

This app is private and only for two people.

The security model must ensure:

- anonymous users cannot read private data
- authenticated but unapproved users cannot read private data
- approved users can only read/write data in their shared household
- frontend route protection is UX only
- Supabase RLS is the real data boundary

The browser must only use the publishable Supabase client. A service role key must never appear in browser code, client bundles, or public environment variables.

## Human decisions required

These decisions must be made before migrations are written or seeded:

- the two approved email addresses
- couple/household display name
- whether Auth users are manually created first
- initial category set
- whether income entries are shared or personal by default
- currency default, likely CNY
- whether each person can edit the other person's display name later
- whether categories are shared household settings or have per-person visibility
- whether soft delete is needed for ledger entries before real use

## Proposed tables

### `allowed_user_emails`

Purpose:

- Database-level allowlist for the two approved login emails.
- Complements Supabase Auth user creation and `shouldCreateUser: false`.

Important columns:

- `email text not null`
- `intended_display_name text`
- `created_at timestamptz not null`

Primary key:

- `email`

Foreign keys:

- none

RLS:

- Enable RLS.

Rows each user should be able to access:

- SELECT: no client policy by default; approved users do not need to read the allowlist through the app.
- INSERT: no client policy; manage through migrations, seed scripts, or Supabase admin tooling.
- UPDATE: no client policy.
- DELETE: no client policy.

### `profiles`

Purpose:

- App profile row for each approved Supabase Auth user.
- Stores display-only app identity separate from Auth credentials.

Important columns:

- `id uuid not null`
- `email text not null`
- `display_name text not null`
- `avatar_key text`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Primary key:

- `id`

Foreign keys:

- `id` references `auth.users(id)` on delete cascade

RLS:

- Enable RLS.

Rows each user should be able to access:

- SELECT: own profile and profiles of users in the same household.
- INSERT: own profile only, and only if `is_allowed_user()` is true.
- UPDATE: own display fields only; do not allow changing Auth identity.
- DELETE: no normal client delete policy.

### `households`

Purpose:

- Represents the private couple household shared by the two approved users.
- Owns categories and ledger entries.

Important columns:

- `id uuid not null`
- `name text not null`
- `currency text not null`
- `created_by uuid not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Primary key:

- `id`

Foreign keys:

- `created_by` references `auth.users(id)`

RLS:

- Enable RLS.

Rows each user should be able to access:

- SELECT: households where the user has a `household_members` row.
- INSERT: only during controlled setup by an approved user.
- UPDATE: only members, or owner-only if roles matter later.
- DELETE: no normal client delete policy.

### `household_members`

Purpose:

- Joins approved Auth users to a household.
- Defines the security boundary for all household data.

Important columns:

- `household_id uuid not null`
- `user_id uuid not null`
- `role text not null`
- `joined_at timestamptz not null`

Primary key:

- `(household_id, user_id)`

Foreign keys:

- `household_id` references `households(id)` on delete cascade
- `user_id` references `auth.users(id)` on delete cascade

RLS:

- Enable RLS.

Rows each user should be able to access:

- SELECT: member rows for households where the caller is also a member.
- INSERT: no open client policy; use controlled setup or a future owner-only RPC.
- UPDATE: no open client policy, or owner-only role changes after a separate design.
- DELETE: no normal client policy.

### `categories`

Purpose:

- Shared category list for the household ledger.
- Supports spending/income classification and UI filters.

Important columns:

- `id uuid not null`
- `household_id uuid not null`
- `name text not null`
- `kind text not null`
- `icon text`
- `color text`
- `sort_order int not null`
- `is_archived boolean not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Primary key:

- `id`

Foreign keys:

- `household_id` references `households(id)` on delete cascade

RLS:

- Enable RLS.

Rows each user should be able to access:

- SELECT: categories in households where `is_household_member(household_id)` is true.
- INSERT: allowed for household members with `household_id` in their household.
- UPDATE: allowed for household members; keep updates within the same household.
- DELETE: prefer archive first; hard delete only for unused categories and only by household members.

### `ledger_entries`

Purpose:

- Main ledger record for an expense or income event.
- Stores amount, date, category, payer/source, note, and split mode.

Important columns:

- `id uuid not null`
- `household_id uuid not null`
- `amount numeric(12,2) not null`
- `entry_type text not null`
- `category_id uuid`
- `paid_by uuid not null`
- `split_mode text not null`
- `occurred_on date not null`
- `note text`
- `created_by uuid not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Primary key:

- `id`

Foreign keys:

- `household_id` references `households(id)` on delete cascade
- `category_id` references `categories(id)` on delete set null
- `paid_by` references `auth.users(id)`
- `created_by` references `auth.users(id)`

RLS:

- Enable RLS.

Rows each user should be able to access:

- SELECT: entries in households where `is_household_member(household_id)` is true.
- INSERT: allowed for members of the target household; `created_by` should equal `auth.uid()` and `paid_by` must be a member of the same household.
- UPDATE: allowed for members of the entry household; updates must keep `household_id`, `paid_by`, `created_by`, and `category_id` consistent with the same household.
- DELETE: allowed for members of the entry household, or soft-delete later if audit history becomes important.

### `ledger_entry_splits`

Purpose:

- Stores each person's responsibility/share for a ledger entry.
- Allows equal, custom, and personal split modes.

Important columns:

- `id uuid not null`
- `entry_id uuid not null`
- `user_id uuid not null`
- `share_amount numeric(12,2) not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Primary key:

- `id`

Foreign keys:

- `entry_id` references `ledger_entries(id)` on delete cascade
- `user_id` references `auth.users(id)`

RLS:

- Enable RLS.

Rows each user should be able to access:

- SELECT: splits whose parent entry belongs to a household where the caller is a member.
- INSERT: allowed when parent entry household is the caller's household and `user_id` is also a member of that household.
- UPDATE: same as INSERT, with checks that the split remains attached to an accessible parent entry.
- DELETE: allowed for splits attached to entries in the caller's household.

## Auth user allowlist strategy

- `shouldCreateUser: false` already prevents automatic signup from the OTP login page.
- Supabase Auth users should be manually created/invited for the two people.
- `allowed_user_emails` is still useful as a database-level allowlist.
- Do not store allowed emails in frontend code.
- Do not rely on hiding UI.

Operational plan:

- The login page can remain email OTP.
- A user who is not manually present in Supabase Auth should not receive a working OTP session.
- If an unapproved Auth user ever exists, database RLS must still prevent private data access.
- The app should later show a friendly blocked state for authenticated users who are not in the allowlist, but the database must deny access even if that UI is bypassed.

## Helper functions

Plan helper SQL functions, but do not implement them yet:

- `is_allowed_user()`
- `is_household_member(target_household_id uuid)`
- optionally `current_user_email()`

Intended logic:

- use `auth.uid()` for authenticated user id
- use JWT/email only carefully
- prefer membership table checks for household data

Function behavior:

- `current_user_email()` should return the normalized email from trusted Auth context when needed for allowlist checks.
- `is_allowed_user()` should return true only when the current authenticated user's email exists in `allowed_user_emails`.
- `is_household_member(target_household_id uuid)` should return true only when `household_members` contains the pair `(target_household_id, auth.uid())`.

Design notes:

- `auth.uid()` is the primary identity for row ownership and membership.
- JWT email claims can be stale or derived from token state, so email should only support allowlist bootstrap checks.
- Household-scoped tables should depend on `household_members`, not repeated email checks.
- If security-definer helpers are used for policy performance, keep them out of exposed schemas and review privileges carefully.
- Add indexes on columns used by policies, especially `household_members.user_id`, `household_members.household_id`, and household foreign keys.

## RLS policy outline

### `allowed_user_emails`

- SELECT policy: none for client roles by default.
- INSERT policy: none for client roles.
- UPDATE policy: none for client roles.
- DELETE policy: none for client roles.
- WITH CHECK expectations: not applicable to client roles.

### `profiles`

- SELECT policy: authenticated users may select their own profile and profiles for users who share a household with them.
- INSERT policy: authenticated users may insert only their own profile row.
- UPDATE policy: authenticated users may update only their own profile row.
- DELETE policy: no client delete policy.
- WITH CHECK expectations: `id` must equal `auth.uid()`; caller must pass `is_allowed_user()`; updates must not move identity to another user.

### `households`

- SELECT policy: authenticated users may select households where `is_household_member(id)` is true.
- INSERT policy: controlled setup only; if opened to clients, require `is_allowed_user()` and later create membership in the same setup flow.
- UPDATE policy: members may update display fields; owner-only can be introduced later if roles become meaningful.
- DELETE policy: no client delete policy.
- WITH CHECK expectations: household remains owned/created by an approved authenticated user.

### `household_members`

- SELECT policy: authenticated users may select member rows for their own households.
- INSERT policy: no open client policy in the first migration.
- UPDATE policy: no open client policy in the first migration.
- DELETE policy: no open client policy in the first migration.
- WITH CHECK expectations: any future mutation must keep users inside the same approved household and must not add unapproved emails.

### `categories`

- SELECT policy: authenticated household members may select categories for their household.
- INSERT policy: authenticated household members may insert categories only for their household.
- UPDATE policy: authenticated household members may update categories only in their household.
- DELETE policy: authenticated household members may delete only categories in their household; prefer archive if entries reference a category.
- WITH CHECK expectations: `household_id` must satisfy `is_household_member(household_id)`.

### `ledger_entries`

- SELECT policy: authenticated household members may select entries for their household.
- INSERT policy: authenticated household members may insert entries for their household.
- UPDATE policy: authenticated household members may update entries for their household.
- DELETE policy: authenticated household members may delete entries for their household.
- WITH CHECK expectations:
  - `household_id` must satisfy `is_household_member(household_id)`.
  - `created_by` must equal `auth.uid()`.
  - `paid_by` must be a member of the same household.
  - `category_id`, when present, must belong to the same household.

### `ledger_entry_splits`

- SELECT policy: authenticated household members may select splits whose parent entry is in their household.
- INSERT policy: authenticated household members may insert splits for entries in their household.
- UPDATE policy: authenticated household members may update splits for entries in their household.
- DELETE policy: authenticated household members may delete splits for entries in their household.
- WITH CHECK expectations:
  - parent `entry_id` must belong to a household where the caller is a member.
  - split `user_id` must be a member of the parent entry household.
  - split amounts must be non-negative.
  - sum-to-entry validation should begin in application/server validation and can later move to a trigger after the write path is stable.

## Route protection plan

Plan, but do not implement:

Public routes:

- `/`
- `/login`
- `/auth/callback`

Private routes:

- `/dashboard`
- `/records`
- `/records/new`
- `/settlement`
- `/settings`

Routing rules:

- middleware or server layout can redirect anonymous users to `/login`
- route protection should not replace RLS
- unapproved authenticated users should get a friendly blocked state later

Implementation notes for a future task:

- Middleware can keep refreshing Supabase cookies as it does now.
- A private route layout or server helper can read the current user and redirect anonymous users.
- A later allowlist check can distinguish approved users from authenticated-but-blocked users.
- The dashboard should not query ledger tables until schema and RLS policies are in place.

## Migration plan

Break future migration work into small steps:

1. create tables and enable RLS
2. create helper functions
3. add policies
4. seed only approved emails
5. manually verify with SQL
6. then wire app reads/writes

Suggested sequencing:

- Migration 1: create tables, constraints, indexes, and enable RLS with no broad client policies.
- Migration 2: add helper functions.
- Migration 3: add narrowly scoped policies.
- Migration 4: seed `allowed_user_emails` and controlled initial household/member/category data after human decisions are available.
- App task 1 after migrations: route protection only.
- App task 2 after route protection: read-only dashboard data.
- App task 3 after read-only verification: write flows for records and splits.

## Manual verification checklist

Before wiring app reads/writes, manually verify:

- anonymous user cannot select any private tables
- unapproved authenticated user cannot select data
- approved user can select own household
- approved user cannot access another household
- ledger splits cannot point to users outside the household
- service role key is never used in browser code

Additional checks:

- `allowed_user_emails` is not readable from browser clients.
- each public app table has RLS enabled before production data exists.
- `household_members` cannot be mutated by normal client calls.
- `ledger_entries.paid_by` cannot reference a user outside the entry household.
- `ledger_entry_splits.user_id` cannot reference a user outside the parent entry household.
- browser code uses only public Supabase configuration.
- no table query depends on frontend-only email checks.

## Non-goals for this document

- no SQL execution
- no migration files
- no source code edits
- no route protection implementation
- no dashboard data wiring

Also out of scope:

- no Supabase project configuration changes
- no Auth user creation
- no seed data insertion
- no RLS policy implementation
- no RPC implementation
- no production deployment changes

## References

- Supabase Row Level Security documentation: https://supabase.com/docs/guides/database/postgres/row-level-security
