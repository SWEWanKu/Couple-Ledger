-- Record Mutation V1 soft-void/update metadata foundation.
-- This migration is schema/RLS only. It does not implement app edit/void UI,
-- helpers, API routes, server actions, RPCs, SQL execution, or data backfill.

alter table public.ledger_entries
  add column if not exists updated_at timestamptz,
  add column if not exists updated_by uuid references auth.users(id),
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users(id),
  add column if not exists void_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ledger_entries_void_actor_pair_check'
      and conrelid = 'public.ledger_entries'::regclass
  ) then
    alter table public.ledger_entries
      add constraint ledger_entries_void_actor_pair_check check (
        (
          voided_at is null
          and voided_by is null
        )
        or
        (
          voided_at is not null
          and voided_by is not null
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ledger_entries_void_reason_requires_void_check'
      and conrelid = 'public.ledger_entries'::regclass
  ) then
    alter table public.ledger_entries
      add constraint ledger_entries_void_reason_requires_void_check check (
        void_reason is null
        or voided_at is not null
      );
  end if;
end $$;

comment on column public.ledger_entries.updated_at is
  'Record Mutation V1 metadata timestamp. Existing rows remain active/non-voided; future app edit helpers should keep this current.';

comment on column public.ledger_entries.updated_by is
  'Record Mutation V1 metadata actor for future household-member edits. created_by remains preserved.';

comment on column public.ledger_entries.voided_at is
  'Soft-void timestamp. Voided records remain stored but future normal reads, summaries, pagers, and live settlement calculations should exclude them.';

comment on column public.ledger_entries.voided_by is
  'Soft-void actor. V1 voiding is household-member scoped and does not physically delete ledger entries or split rows.';

comment on column public.ledger_entries.void_reason is
  'Optional future soft-void note. Snapshot history remains immutable; old settlement snapshots are not rewritten when records are voided later.';

drop policy if exists "Household members can update ledger entries"
on public.ledger_entries;

create policy "Household members can update ledger entries"
on public.ledger_entries
for update
to authenticated
using (
  (select auth.uid()) is not null
  and (select public.is_allowed_user())
  and (select public.is_household_member(household_id))
)
with check (
  (select auth.uid()) is not null
  and (select public.is_allowed_user())
  and (select public.is_household_member(household_id))
  and (
    updated_by is null
    or updated_by = (select auth.uid())
  )
  and (
    voided_at is null
    or voided_by = (select auth.uid())
  )
  and exists (
    select 1
    from public.household_members member
    where member.household_id = ledger_entries.household_id
      and member.user_id = ledger_entries.paid_by
  )
);

comment on policy "Household members can update ledger entries"
on public.ledger_entries is
  'Record Mutation V1 update policy. Keeps household-member scope, requires optional updated_by to be the current user, and requires voided_by to be the current user when soft-void metadata is set. No DELETE policy is added here; hard delete remains deferred beyond V1.';
