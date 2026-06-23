-- Settlement V2 pending_replacement confirmation transition RPC.
-- This migration adds a narrowly scoped UPDATE policy plus one SECURITY INVOKER
-- RPC. It does not add UI, API routes, server actions, service role usage,
-- DELETE policies, payment behavior, or changes to immutable money/snapshot
-- columns.

drop policy if exists "Settlement replacement transition updates lifecycle metadata"
on public.settlement_snapshots;

-- This UPDATE policy is intentionally gated by a transaction-local setting.
-- Normal browser/PostgREST table updates do not set this value; the
-- confirm_settlement_replacement_snapshot RPC sets it before taking row locks
-- because SELECT ... FOR UPDATE is also checked against UPDATE RLS policies.
-- The function still validates every business rule before any UPDATE
-- statement. The policy still requires authenticated household membership and
-- exists only so the SECURITY INVOKER RPC can update lifecycle metadata under
-- RLS.
create policy "Settlement replacement transition updates lifecycle metadata"
on public.settlement_snapshots
for update
to authenticated
using (
  current_setting('app.settlement_replacement_transition', true) = 'on'
  and (select public.is_allowed_user())
  and exists (
    select 1
    from public.household_members member
    where member.household_id = settlement_snapshots.household_id
      and member.user_id = (select auth.uid())
  )
)
with check (
  current_setting('app.settlement_replacement_transition', true) = 'on'
  and (select public.is_allowed_user())
  and exists (
    select 1
    from public.household_members member
    where member.household_id = settlement_snapshots.household_id
      and member.user_id = (select auth.uid())
  )
  and lifecycle_status in ('active', 'superseded')
);

comment on policy "Settlement replacement transition updates lifecycle metadata"
on public.settlement_snapshots is
  'Transition-scoped UPDATE policy for the SECURITY INVOKER replacement confirmation RPC. It is gated by a transaction-local app.settlement_replacement_transition setting and household membership; ordinary clients cannot use it for direct snapshot amount or JSON mutations.';

create or replace function public.confirm_settlement_replacement_snapshot(
  p_snapshot_id uuid
)
returns table (
  status text,
  snapshot_id uuid,
  replaced_snapshot_id uuid,
  confirmed_count integer,
  required_count integer
)
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_target public.settlement_snapshots%rowtype;
  v_replaced public.settlement_snapshots%rowtype;
  v_is_member boolean := false;
  v_inserted_confirmation_id uuid;
  v_already_confirmed boolean := false;
  v_confirmed_count integer := 0;
  v_required_count integer := 0;
  v_transitioned_at timestamptz := now();
begin
  if v_user_id is null then
    return query select
      'unauthenticated'::text,
      p_snapshot_id,
      null::uuid,
      0,
      0;
    return;
  end if;

  perform set_config('app.settlement_replacement_transition', 'on', true);

  select *
  into v_target
  from public.settlement_snapshots
  where id = p_snapshot_id
  for update;

  if not found then
    return query select
      'not_found'::text,
      p_snapshot_id,
      null::uuid,
      0,
      0;
    return;
  end if;

  select exists (
    select 1
    from public.household_members member
    where member.household_id = v_target.household_id
      and member.user_id = v_user_id
  )
  into v_is_member;

  if not v_is_member then
    return query select
      'not_household_member'::text,
      v_target.id,
      v_target.replacement_of_snapshot_id,
      0,
      0;
    return;
  end if;

  if v_target.lifecycle_status <> 'pending_replacement'
    or v_target.replacement_of_snapshot_id is null
  then
    return query select
      'not_pending_replacement'::text,
      v_target.id,
      v_target.replacement_of_snapshot_id,
      0,
      0;
    return;
  end if;

  select *
  into v_replaced
  from public.settlement_snapshots
  where id = v_target.replacement_of_snapshot_id
  for update;

  if not found then
    return query select
      'not_found'::text,
      v_target.id,
      v_target.replacement_of_snapshot_id,
      0,
      0;
    return;
  end if;

  if v_replaced.lifecycle_status <> 'active'
    or v_replaced.household_id <> v_target.household_id
    or v_replaced.month_start <> v_target.month_start
  then
    return query select
      'not_pending_replacement'::text,
      v_target.id,
      v_replaced.id,
      0,
      0;
    return;
  end if;

  insert into public.settlement_confirmations (
    settlement_snapshot_id,
    confirmed_by
  )
  values (
    v_target.id,
    v_user_id
  )
  on conflict (settlement_snapshot_id, confirmed_by) do nothing
  returning id
  into v_inserted_confirmation_id;

  if v_inserted_confirmation_id is null then
    select exists (
      select 1
      from public.settlement_confirmations confirmation
      where confirmation.settlement_snapshot_id = v_target.id
        and confirmation.confirmed_by = v_user_id
    )
    into v_already_confirmed;

    if not v_already_confirmed then
      return query select
        'error'::text,
        v_target.id,
        v_replaced.id,
        0,
        0;
      return;
    end if;
  end if;

  select count(distinct member.user_id)::integer
  into v_required_count
  from public.household_members member
  where member.household_id = v_target.household_id;

  select count(distinct confirmation.confirmed_by)::integer
  into v_confirmed_count
  from public.settlement_confirmations confirmation
  join public.household_members member
    on member.household_id = v_target.household_id
   and member.user_id = confirmation.confirmed_by
  where confirmation.settlement_snapshot_id = v_target.id;

  if v_required_count > 0 and v_confirmed_count >= v_required_count then
    update public.settlement_snapshots
    set
      lifecycle_status = 'superseded',
      superseded_by_snapshot_id = v_target.id,
      superseded_at = v_transitioned_at,
      status_updated_at = v_transitioned_at,
      status_updated_by = v_user_id
    where id = v_replaced.id
      and lifecycle_status = 'active';

    if not found then
      return query select
        'error'::text,
        v_target.id,
        v_replaced.id,
        v_confirmed_count,
        v_required_count;
      return;
    end if;

    update public.settlement_snapshots
    set
      lifecycle_status = 'active',
      status_updated_at = v_transitioned_at,
      status_updated_by = v_user_id
    where id = v_target.id
      and lifecycle_status = 'pending_replacement';

    if not found then
      return query select
        'error'::text,
        v_target.id,
        v_replaced.id,
        v_confirmed_count,
        v_required_count;
      return;
    end if;

    return query select
      'fully_confirmed'::text,
      v_target.id,
      v_replaced.id,
      v_confirmed_count,
      v_required_count;
    return;
  end if;

  return query select
    case
      when v_inserted_confirmation_id is null then 'already_confirmed'::text
      else 'confirmed'::text
    end,
    v_target.id,
    v_replaced.id,
    v_confirmed_count,
    v_required_count;
  return;
exception
  when others then
    return query select
      'error'::text,
      p_snapshot_id,
      null::uuid,
      0,
      0;
    return;
end;
$$;

comment on function public.confirm_settlement_replacement_snapshot(uuid) is
  'Confirms the current authenticated user for one pending_replacement settlement snapshot. When all current household members have confirmed that exact pending snapshot, atomically supersedes the previous active snapshot and promotes the pending snapshot to active under RLS.';

revoke all on function public.confirm_settlement_replacement_snapshot(uuid) from public;
revoke all on function public.confirm_settlement_replacement_snapshot(uuid) from anon;
grant execute on function public.confirm_settlement_replacement_snapshot(uuid) to authenticated;
