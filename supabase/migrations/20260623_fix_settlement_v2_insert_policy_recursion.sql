-- Fix Settlement V2 settlement_snapshots INSERT policy recursion.
-- The previous V2 INSERT policy queried public.settlement_snapshots from a
-- policy on public.settlement_snapshots, which can recurse under RLS during a
-- duplicate active snapshot insert.
--
-- This bugfix restores active V1-compatible snapshot inserts only. Inserting
-- pending_replacement snapshots is intentionally deferred to the future V2
-- replacement-write implementation, where it should get its own carefully
-- constrained non-recursive policy/helper design.

drop policy if exists "Household members can insert settlement snapshots"
on public.settlement_snapshots;

create policy "Household members can insert settlement snapshots"
on public.settlement_snapshots
for insert
to authenticated
with check (
  (select public.is_allowed_user())
  and created_by = (select auth.uid())
  and lifecycle_status = 'active'
  and replacement_of_snapshot_id is null
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
  'Allows authenticated household members to insert active V1-compatible settlement snapshots without self-referencing settlement_snapshots. Pending replacement inserts are deferred to a future constrained V2 replacement-write policy/helper.';
