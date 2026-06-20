# Supabase Admin Initialization Runbook

## Purpose

This runbook initializes the private two-person Couple Ledger environment after the database migrations are applied.

It covers:

- allowed user emails
- profiles
- one household
- two household members
- default categories

This is manual admin SQL for the project owner/admin. It is not browser/client code, and it is not a committed real-data seed migration.

## Important safety rules

- Do not commit real emails.
- Do not commit real Supabase Auth user IDs.
- Do not commit service role keys.
- Do not run this from browser/client code.
- Run this only in Supabase SQL Editor or trusted admin tooling.
- Confirm Auth users already exist before running member/profile setup.
- Keep `allowed_user_emails` admin-managed because it has no client-facing RLS policies.
- Replace placeholders only inside your private Supabase admin session, not in committed files.

## Required human inputs

Use placeholders only in committed docs and scripts:

- `OWNER_EMAIL`
- `PARTNER_EMAIL`
- `OWNER_USER_ID`
- `PARTNER_USER_ID`
- `OWNER_DISPLAY_NAME`
- `PARTNER_DISPLAY_NAME`
- `HOUSEHOLD_NAME`
- default currency, likely `CNY`

The current schema does not include a `currency` column on `public.households`. Keep the default currency as an admin decision for now, and do not add it to SQL unless a later migration adds a column for it.

## Step 1: Confirm migrations are applied

Confirm these migrations exist in the Supabase project before running any initialization SQL:

- `20260620_create_initial_schema_enable_rls.sql`: initial schema and RLS enabled
- `20260620_add_rls_helper_functions.sql`: helper functions for future and current RLS checks
- `20260620_add_rls_policies.sql`: client-facing RLS policies for app tables

Do not continue if any of these migrations are missing in the target Supabase database.

## Step 2: Create or confirm Supabase Auth users

The app uses `shouldCreateUser: false`, so login does not create new Auth users automatically.

Before profile and membership setup:

- create or invite both users through Supabase Dashboard Authentication -> Users
- confirm both Auth users exist
- copy each user's UUID from the dashboard
- do not paste real UUIDs into committed code or docs
- keep the UUIDs only in your private admin session while running the SQL below

## Step 3: Insert allowed emails

Run this only from Supabase SQL Editor or trusted admin tooling after replacing placeholders in your private admin session.

```sql
insert into public.allowed_user_emails (email, intended_display_name)
values
  (lower('OWNER_EMAIL'), 'OWNER_DISPLAY_NAME'),
  (lower('PARTNER_EMAIL'), 'PARTNER_DISPLAY_NAME')
on conflict (email) do update
set intended_display_name = excluded.intended_display_name;
```

## Step 4: Upsert profiles

Run this only after both Auth users exist and their UUIDs have been copied from Supabase Dashboard Authentication -> Users.

```sql
insert into public.profiles (id, display_name, avatar_key)
values
  ('OWNER_USER_ID'::uuid, 'OWNER_DISPLAY_NAME', 'owner'),
  ('PARTNER_USER_ID'::uuid, 'PARTNER_DISPLAY_NAME', 'partner')
on conflict (id) do update
set
  display_name = excluded.display_name,
  avatar_key = excluded.avatar_key;
```

## Step 5: Create shared household

This SQL creates or reuses one household for `HOUSEHOLD_NAME` and `OWNER_USER_ID`, then upserts two household members.

There is no unique constraint on household name or owner in the current schema, so this is only as idempotent as the schema allows. Run it once, then verify manually. If you rerun it, it will try to reuse the first matching household for the same name and owner.

```sql
with existing_household as (
  select id
  from public.households
  where name = 'HOUSEHOLD_NAME'
    and created_by = 'OWNER_USER_ID'::uuid
  order by created_at
  limit 1
),
inserted_household as (
  insert into public.households (name, created_by)
  select 'HOUSEHOLD_NAME', 'OWNER_USER_ID'::uuid
  where not exists (select 1 from existing_household)
  returning id
),
target_household as (
  select id from existing_household
  union all
  select id from inserted_household
  limit 1
)
insert into public.household_members (household_id, user_id, role)
select id, 'OWNER_USER_ID'::uuid, 'owner'
from target_household
union all
select id, 'PARTNER_USER_ID'::uuid, 'partner'
from target_household
on conflict (household_id, user_id) do update
set role = excluded.role;
```

## Step 6: Add default categories

Suggested default categories:

- 餐饮
- 交通
- 购物
- 房租
- 水电
- 娱乐
- 旅行
- 医疗
- 其他

This SQL inserts missing category names for the household created above. Because the current schema has no unique constraint on `(household_id, name)`, avoid running this repeatedly after manual edits unless you verify the result.

```sql
with target_household as (
  select id
  from public.households
  where name = 'HOUSEHOLD_NAME'
    and created_by = 'OWNER_USER_ID'::uuid
  order by created_at
  limit 1
),
default_categories (name, icon, color, sort_order) as (
  values
    ('餐饮', 'utensils', '#f2b36d', 10),
    ('交通', 'bus', '#77b7d9', 20),
    ('购物', 'shopping-bag', '#e68aa5', 30),
    ('房租', 'home', '#b8946b', 40),
    ('水电', 'zap', '#72c7a0', 50),
    ('娱乐', 'sparkles', '#d6a5f2', 60),
    ('旅行', 'map', '#84b86f', 70),
    ('医疗', 'heart-pulse', '#ef8f8f', 80),
    ('其他', 'more-horizontal', '#a8a29e', 90)
)
insert into public.categories (household_id, name, icon, color, sort_order)
select household.id, category.name, category.icon, category.color, category.sort_order
from target_household household
cross join default_categories category
where not exists (
  select 1
  from public.categories existing
  where existing.household_id = household.id
    and existing.name = category.name
);
```

## Step 7: Manual verification SQL

Use read-only checks after initialization. Keep real values in your private admin session only.

```sql
select email, intended_display_name, created_at
from public.allowed_user_emails
order by email;
```

```sql
select id, display_name, avatar_key, created_at
from public.profiles
where id in ('OWNER_USER_ID'::uuid, 'PARTNER_USER_ID'::uuid)
order by display_name;
```

```sql
select
  household.id as household_id,
  household.name as household_name,
  member.user_id,
  member.role,
  member.joined_at
from public.households household
join public.household_members member
  on member.household_id = household.id
where household.name = 'HOUSEHOLD_NAME'
  and household.created_by = 'OWNER_USER_ID'::uuid
order by member.role;
```

```sql
select category.name, category.icon, category.color, category.sort_order
from public.categories category
join public.households household
  on household.id = category.household_id
where household.name = 'HOUSEHOLD_NAME'
  and household.created_by = 'OWNER_USER_ID'::uuid
order by category.sort_order, category.name;
```

```sql
select
  household.id as household_id,
  count(member.user_id) as member_count
from public.households household
join public.household_members member
  on member.household_id = household.id
where household.name = 'HOUSEHOLD_NAME'
  and household.created_by = 'OWNER_USER_ID'::uuid
group by household.id
having count(member.user_id) = 2;
```

The final query should return exactly one row for the initialized household.

## Step 8: Security verification checklist

After initialization, verify the security boundary from browser or API clients that use normal authenticated/anonymous client credentials:

- anonymous user should not read app tables
- unapproved authenticated user should not read household data
- approved household member can read household categories
- approved household member can insert category
- approved user cannot access another household
- `allowed_user_emails` is not readable by browser client

Use admin SQL only to inspect setup state. Do not use admin credentials in browser code.

## Non-goals

- no source code changes
- no committed real emails
- no committed real UUIDs
- no service role key usage in browser
- no migration execution in this task
- no committed real-data seed migration
- no Supabase project changes from this repository task
