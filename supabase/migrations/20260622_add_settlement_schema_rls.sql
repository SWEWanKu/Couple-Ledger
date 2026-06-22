-- V1 settlement snapshot + confirmation persistence.
-- This migration intentionally adds schema and RLS only.
-- It does not add app write code, API routes, server actions, seed data, or generated types.

create table if not exists public.settlement_snapshots (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  month_start date not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  total_expense_cents bigint not null check (total_expense_cents >= 0),
  transfer_from_user_id uuid references auth.users(id),
  transfer_to_user_id uuid references auth.users(id),
  transfer_amount_cents bigint not null default 0 check (transfer_amount_cents >= 0),
  expense_count int not null check (expense_count >= 0),
  calculation_version text not null default 'v1' check (calculation_version = 'v1'),
  calculation_status text not null check (calculation_status in ('ready', 'no_settlement_needed')),
  source_fingerprint text not null check (length(btrim(source_fingerprint)) > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  constraint settlement_snapshots_month_start_first_day check (
    date_trunc('month', month_start::timestamp)::date = month_start
  ),
  constraint settlement_snapshots_transfer_shape_check check (
    (
      transfer_from_user_id is null
      and transfer_to_user_id is null
      and transfer_amount_cents = 0
    )
    or
    (
      transfer_from_user_id is not null
      and transfer_to_user_id is not null
      and transfer_from_user_id <> transfer_to_user_id
      and transfer_amount_cents > 0
    )
  ),
  unique (household_id, month_start)
);

create table if not exists public.settlement_confirmations (
  id uuid primary key default gen_random_uuid(),
  settlement_snapshot_id uuid not null references public.settlement_snapshots(id) on delete cascade,
  confirmed_by uuid not null references auth.users(id),
  confirmed_at timestamptz not null default now(),
  unique (settlement_snapshot_id, confirmed_by)
);

create index if not exists settlement_snapshots_created_by_idx
  on public.settlement_snapshots(created_by);

create index if not exists settlement_snapshots_source_fingerprint_idx
  on public.settlement_snapshots(source_fingerprint);

create index if not exists settlement_confirmations_confirmed_by_idx
  on public.settlement_confirmations(confirmed_by);

alter table public.settlement_snapshots enable row level security;
alter table public.settlement_confirmations enable row level security;

create policy "Household members can view settlement snapshots"
on public.settlement_snapshots
for select
to authenticated
using (
  (select public.is_allowed_user())
  and (select public.is_household_member(household_id))
);

create policy "Household members can insert settlement snapshots"
on public.settlement_snapshots
for insert
to authenticated
with check (
  (select public.is_allowed_user())
  and (select public.is_household_member(household_id))
  and created_by = (select auth.uid())
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

create policy "Household members can view settlement confirmations"
on public.settlement_confirmations
for select
to authenticated
using (
  (select public.is_allowed_user())
  and exists (
    select 1
    from public.settlement_snapshots snapshot
    where snapshot.id = settlement_confirmations.settlement_snapshot_id
      and (select public.is_household_member(snapshot.household_id))
  )
);

create policy "Household members can insert own settlement confirmations"
on public.settlement_confirmations
for insert
to authenticated
with check (
  (select public.is_allowed_user())
  and confirmed_by = (select auth.uid())
  and exists (
    select 1
    from public.settlement_snapshots snapshot
    where snapshot.id = settlement_confirmations.settlement_snapshot_id
      and (select public.is_household_member(snapshot.household_id))
  )
);

comment on table public.settlement_snapshots is
  'Immutable V1 monthly settlement snapshots. Fully-settled state is derived from member confirmations, not by updating snapshot amounts.';

comment on table public.settlement_confirmations is
  'V1 member confirmations for settlement snapshots. Each user can confirm a snapshot once.';

-- No update or delete policies are created for settlement snapshots or confirmations in V1.
-- Snapshot amount data is immutable by default from browser clients.
