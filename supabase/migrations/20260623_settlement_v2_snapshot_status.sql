-- Settlement V2 snapshot lifecycle metadata.
-- This migration is schema/RLS only. It is not applied by committing this file.
-- It does not add application code, API routes, server actions, service role
-- usage, payment-provider behavior, delete behavior, or generated types.

alter table public.settlement_snapshots
  add column lifecycle_status text not null default 'active',
  add column replacement_of_snapshot_id uuid null references public.settlement_snapshots(id),
  add column superseded_by_snapshot_id uuid null references public.settlement_snapshots(id),
  add column superseded_at timestamptz null,
  add column status_updated_at timestamptz null,
  add column status_updated_by uuid null references auth.users(id);

comment on column public.settlement_snapshots.lifecycle_status is
  'V2 settlement lifecycle status. active = current stored snapshot for a household/month; pending_replacement = proposed replacement waiting for confirmations; superseded = historical snapshot replaced by a fully confirmed replacement. voided is reserved future vocabulary and is not enabled in V2 initial schema.';

comment on column public.settlement_snapshots.replacement_of_snapshot_id is
  'For pending replacement snapshots, references the currently active snapshot being replaced. This lineage may remain after the replacement later becomes active.';

comment on column public.settlement_snapshots.superseded_by_snapshot_id is
  'For superseded snapshots, references the fully confirmed replacement snapshot that became active.';

comment on column public.settlement_snapshots.superseded_at is
  'Timestamp recorded when an active snapshot is moved to superseded by a future constrained status transition.';

comment on column public.settlement_snapshots.status_updated_at is
  'Timestamp for future lifecycle metadata transitions. V2 initial app code does not update this column yet.';

comment on column public.settlement_snapshots.status_updated_by is
  'Authenticated household member who performed a future lifecycle metadata transition. V2 initial app code does not update this column yet.';

alter table public.settlement_snapshots
  add constraint settlement_snapshots_lifecycle_status_check check (
    lifecycle_status in ('active', 'pending_replacement', 'superseded')
  ),
  add constraint settlement_snapshots_lifecycle_shape_check check (
    (
      lifecycle_status = 'active'
      and superseded_by_snapshot_id is null
    )
    or
    (
      lifecycle_status = 'pending_replacement'
      and replacement_of_snapshot_id is not null
      and superseded_by_snapshot_id is null
    )
    or
    (
      lifecycle_status = 'superseded'
      and superseded_by_snapshot_id is not null
    )
  ),
  add constraint settlement_snapshots_lifecycle_no_self_reference_check check (
    (replacement_of_snapshot_id is null or replacement_of_snapshot_id <> id)
    and (superseded_by_snapshot_id is null or superseded_by_snapshot_id <> id)
  ),
  add constraint settlement_snapshots_status_update_pair_check check (
    (
      status_updated_at is null
      and status_updated_by is null
    )
    or
    (
      status_updated_at is not null
      and status_updated_by is not null
    )
  );

create unique index if not exists settlement_snapshots_one_active_per_month_idx
  on public.settlement_snapshots(household_id, month_start)
  where lifecycle_status = 'active';

create unique index if not exists settlement_snapshots_one_pending_replacement_per_month_idx
  on public.settlement_snapshots(household_id, month_start)
  where lifecycle_status = 'pending_replacement';

create index if not exists settlement_snapshots_lifecycle_status_idx
  on public.settlement_snapshots(lifecycle_status);

create index if not exists settlement_snapshots_replacement_of_snapshot_id_idx
  on public.settlement_snapshots(replacement_of_snapshot_id);

create index if not exists settlement_snapshots_superseded_by_snapshot_id_idx
  on public.settlement_snapshots(superseded_by_snapshot_id);

do $$
declare
  v_constraint_name text;
begin
  select constraint_info.conname
  into v_constraint_name
  from (
    select
      constraint_record.conname,
      array_agg(attribute_record.attname order by key_record.ordinality) as constrained_columns
    from pg_constraint constraint_record
    join pg_class table_record
      on table_record.oid = constraint_record.conrelid
    join pg_namespace schema_record
      on schema_record.oid = table_record.relnamespace
    join unnest(constraint_record.conkey) with ordinality as key_record(attnum, ordinality)
      on true
    join pg_attribute attribute_record
      on attribute_record.attrelid = table_record.oid
     and attribute_record.attnum = key_record.attnum
    where schema_record.nspname = 'public'
      and table_record.relname = 'settlement_snapshots'
      and constraint_record.contype = 'u'
    group by constraint_record.conname
  ) constraint_info
  where constraint_info.constrained_columns = array['household_id', 'month_start']::name[]
  limit 1;

  if v_constraint_name is not null then
    execute format('alter table public.settlement_snapshots drop constraint %I', v_constraint_name);
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
  and (select public.is_household_member(household_id))
  and created_by = (select auth.uid())
  and status_updated_at is null
  and status_updated_by is null
  and (
    (
      lifecycle_status = 'active'
      and replacement_of_snapshot_id is null
      and superseded_by_snapshot_id is null
    )
    or
    (
      lifecycle_status = 'pending_replacement'
      and replacement_of_snapshot_id is not null
      and superseded_by_snapshot_id is null
      and exists (
        select 1
        from public.settlement_snapshots replaced_snapshot
        where replaced_snapshot.id = settlement_snapshots.replacement_of_snapshot_id
          and replaced_snapshot.household_id = settlement_snapshots.household_id
          and replaced_snapshot.month_start = settlement_snapshots.month_start
          and replaced_snapshot.lifecycle_status = 'active'
      )
    )
  )
  and (
    transfer_from_user_id is null
    or exists (
      select 1
      from public.household_members member
      where member.household_id = settlement_snapshots.household_id
        and member.user_id = settlement_snapshots.transfer_from_user_id
    )
  )
  and (
    transfer_to_user_id is null
    or exists (
      select 1
      from public.household_members member
      where member.household_id = settlement_snapshots.household_id
        and member.user_id = settlement_snapshots.transfer_to_user_id
    )
  )
);

comment on table public.settlement_snapshots is
  'Immutable monthly settlement snapshots. V2 lifecycle metadata can identify active, pending replacement, and superseded snapshots; amount columns and snapshot JSON remain immutable from browser clients.';

-- Existing V1 rows become lifecycle_status = 'active' through the non-null
-- default. Existing confirmation rows continue to belong to the exact snapshot
-- id they confirmed.
-- No UPDATE or DELETE policy is added in this migration. Future V2 status
-- transitions need a dedicated constrained helper/action before metadata writes
-- are exposed.
