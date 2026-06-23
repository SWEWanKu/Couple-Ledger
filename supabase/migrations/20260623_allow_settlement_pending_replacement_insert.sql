-- Allow Settlement V2 pending replacement snapshot inserts without
-- self-referencing settlement_snapshots from settlement_snapshots RLS.
--
-- This migration intentionally adds no UPDATE/DELETE policy, no functions,
-- no triggers, and no changes to money columns or snapshot JSON.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'settlement_snapshots_id_household_month_unique'
      and conrelid = 'public.settlement_snapshots'::regclass
  ) then
    alter table public.settlement_snapshots
      add constraint settlement_snapshots_id_household_month_unique
      unique (id, household_id, month_start);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'settlement_snapshots_replacement_same_household_month_fk'
      and conrelid = 'public.settlement_snapshots'::regclass
  ) then
    alter table public.settlement_snapshots
      add constraint settlement_snapshots_replacement_same_household_month_fk
      foreign key (replacement_of_snapshot_id, household_id, month_start)
      references public.settlement_snapshots(id, household_id, month_start);
  end if;
end $$;

drop policy if exists "Household members can insert settlement snapshots"
on public.settlement_snapshots;

create policy "Household members can insert settlement snapshots"
on public.settlement_snapshots
for insert
to authenticated
with check (
  (select public.is_allowed_user())
  and created_by = (select auth.uid())
  and superseded_by_snapshot_id is null
  and superseded_at is null
  and status_updated_at is null
  and status_updated_by is null
  and exists (
    select 1
    from public.household_members member
    where member.household_id = settlement_snapshots.household_id
      and member.user_id = (select auth.uid())
  )
  and (
    (
      lifecycle_status = 'active'
      and replacement_of_snapshot_id is null
    )
    or
    (
      lifecycle_status = 'pending_replacement'
      and replacement_of_snapshot_id is not null
    )
  )
  and (
    transfer_from_user_id is null
    or exists (
      select 1
      from public.household_members payer
      where payer.household_id = settlement_snapshots.household_id
        and payer.user_id = settlement_snapshots.transfer_from_user_id
    )
  )
  and (
    transfer_to_user_id is null
    or exists (
      select 1
      from public.household_members receiver
      where receiver.household_id = settlement_snapshots.household_id
        and receiver.user_id = settlement_snapshots.transfer_to_user_id
    )
  )
);

comment on policy "Household members can insert settlement snapshots"
on public.settlement_snapshots is
  'Allows authenticated household members to insert V1 active snapshots and V2 pending replacement snapshots without querying settlement_snapshots from its own INSERT policy. Same household/month replacement lineage is enforced by a composite foreign key.';
