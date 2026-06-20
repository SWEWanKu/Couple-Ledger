-- Helper functions for future RLS policies.
-- This migration intentionally does not create policies or seed data.

create or replace function public.current_user_email()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select lower(nullif(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.is_allowed_user()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.allowed_user_emails allowed
    where lower(allowed.email) = public.current_user_email()
  );
$$;

create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.household_members member
    where member.household_id = target_household_id
      and member.user_id = auth.uid()
  );
$$;

create or replace function public.is_household_owner(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.household_members member
    where member.household_id = target_household_id
      and member.user_id = auth.uid()
      and member.role = 'owner'
  );
$$;

create or replace function public.is_entry_household_member(target_entry_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.ledger_entries entry
    where entry.id = target_entry_id
      and public.is_household_member(entry.household_id)
  );
$$;

comment on function public.current_user_email() is
  'Returns the lower-cased email from the current auth JWT for allowlist checks.';

comment on function public.is_allowed_user() is
  'Returns true when the current auth JWT email exists in public.allowed_user_emails.';

comment on function public.is_household_member(uuid) is
  'Returns true when auth.uid() is a member of the target household.';

comment on function public.is_household_owner(uuid) is
  'Returns true when auth.uid() is an owner of the target household.';

comment on function public.is_entry_household_member(uuid) is
  'Returns true when auth.uid() is a member of the household that owns the target ledger entry.';

-- Keep execute grants explicit for authenticated clients and future RLS policy use.
grant execute on function public.current_user_email() to authenticated;
grant execute on function public.is_allowed_user() to authenticated;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.is_household_owner(uuid) to authenticated;
grant execute on function public.is_entry_household_member(uuid) to authenticated;

-- RLS policies are intentionally omitted in this migration.
-- Seed data is intentionally omitted in this migration.
