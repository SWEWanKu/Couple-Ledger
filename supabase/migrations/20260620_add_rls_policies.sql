-- RLS policies for Couple Ledger.
-- This migration intentionally does not seed data.
-- This migration intentionally does not create helper functions.
-- public.allowed_user_emails intentionally has no client-facing policies.
-- Manage allowed_user_emails only via Supabase dashboard/admin SQL or future server-only tooling.

-- profiles

create policy "Allowed users can view own profile"
on public.profiles
for select
to authenticated
using (
  (select public.is_allowed_user())
  and id = (select auth.uid())
);

create policy "Allowed users can insert own profile"
on public.profiles
for insert
to authenticated
with check (
  (select public.is_allowed_user())
  and id = (select auth.uid())
);

create policy "Allowed users can update own profile"
on public.profiles
for update
to authenticated
using (
  (select public.is_allowed_user())
  and id = (select auth.uid())
)
with check (
  (select public.is_allowed_user())
  and id = (select auth.uid())
);

-- households

create policy "Household members can view households"
on public.households
for select
to authenticated
using (
  (select public.is_allowed_user())
  and (select public.is_household_member(id))
);

create policy "Household owners can update households"
on public.households
for update
to authenticated
using (
  (select public.is_allowed_user())
  and (select public.is_household_owner(id))
)
with check (
  (select public.is_allowed_user())
  and (select public.is_household_owner(id))
);

-- household_members

create policy "Household members can view household members"
on public.household_members
for select
to authenticated
using (
  (select public.is_allowed_user())
  and (select public.is_household_member(household_id))
);

-- categories

create policy "Household members can view categories"
on public.categories
for select
to authenticated
using (
  (select public.is_allowed_user())
  and (select public.is_household_member(household_id))
);

create policy "Household members can insert categories"
on public.categories
for insert
to authenticated
with check (
  (select public.is_allowed_user())
  and (select public.is_household_member(household_id))
);

create policy "Household members can update categories"
on public.categories
for update
to authenticated
using (
  (select public.is_allowed_user())
  and (select public.is_household_member(household_id))
)
with check (
  (select public.is_allowed_user())
  and (select public.is_household_member(household_id))
);

create policy "Household members can delete categories"
on public.categories
for delete
to authenticated
using (
  (select public.is_allowed_user())
  and (select public.is_household_member(household_id))
);

-- ledger_entries

create policy "Household members can view ledger entries"
on public.ledger_entries
for select
to authenticated
using (
  (select public.is_allowed_user())
  and (select public.is_household_member(household_id))
);

create policy "Household members can insert ledger entries"
on public.ledger_entries
for insert
to authenticated
with check (
  (select public.is_allowed_user())
  and (select public.is_household_member(household_id))
  and created_by = (select auth.uid())
  and exists (
    select 1
    from public.household_members member
    where member.household_id = ledger_entries.household_id
      and member.user_id = ledger_entries.paid_by
  )
);

create policy "Household members can update ledger entries"
on public.ledger_entries
for update
to authenticated
using (
  (select public.is_allowed_user())
  and (select public.is_household_member(household_id))
)
with check (
  (select public.is_allowed_user())
  and (select public.is_household_member(household_id))
  and exists (
    select 1
    from public.household_members member
    where member.household_id = ledger_entries.household_id
      and member.user_id = ledger_entries.paid_by
  )
);

create policy "Household members can delete ledger entries"
on public.ledger_entries
for delete
to authenticated
using (
  (select public.is_allowed_user())
  and (select public.is_household_member(household_id))
);

-- ledger_entry_splits

create policy "Household members can view ledger entry splits"
on public.ledger_entry_splits
for select
to authenticated
using (
  (select public.is_allowed_user())
  and (select public.is_entry_household_member(entry_id))
);

create policy "Household members can insert ledger entry splits"
on public.ledger_entry_splits
for insert
to authenticated
with check (
  (select public.is_allowed_user())
  and (select public.is_entry_household_member(entry_id))
  and exists (
    select 1
    from public.ledger_entries entry
    join public.household_members member
      on member.household_id = entry.household_id
    where entry.id = ledger_entry_splits.entry_id
      and member.user_id = ledger_entry_splits.user_id
  )
);

create policy "Household members can update ledger entry splits"
on public.ledger_entry_splits
for update
to authenticated
using (
  (select public.is_allowed_user())
  and (select public.is_entry_household_member(entry_id))
)
with check (
  (select public.is_allowed_user())
  and (select public.is_entry_household_member(entry_id))
  and exists (
    select 1
    from public.ledger_entries entry
    join public.household_members member
      on member.household_id = entry.household_id
    where entry.id = ledger_entry_splits.entry_id
      and member.user_id = ledger_entry_splits.user_id
  )
);

create policy "Household members can delete ledger entry splits"
on public.ledger_entry_splits
for delete
to authenticated
using (
  (select public.is_allowed_user())
  and (select public.is_entry_household_member(entry_id))
);

-- No policies are intentionally created for public.allowed_user_emails.
-- Seed data is intentionally omitted.
-- Manual/admin setup will add the two approved emails and initial household/member rows later.
