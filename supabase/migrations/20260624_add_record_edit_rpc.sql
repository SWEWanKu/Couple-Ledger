-- Record Mutation V1 transaction-safe edit RPC.
-- This migration adds one SECURITY INVOKER function only. It does not add app
-- helpers, actions, UI, API routes, service-role behavior, settlement writes,
-- ledger entry hard delete behavior, or broad RLS policies.

create or replace function public.update_ledger_record_v1(
  p_record_id uuid,
  p_amount numeric,
  p_entry_type text,
  p_category_id uuid,
  p_paid_by uuid,
  p_split_mode text,
  p_occurred_on date,
  p_note text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  v_actor_id uuid := auth.uid();
  v_entry public.ledger_entries%rowtype;
  v_note text;
  v_amount_cents bigint;
  v_member_count integer;
  v_base_share_cents bigint;
  v_last_share_cents bigint;
  v_original_month_start date;
  v_target_month_start date;
  v_updated_id uuid;
  v_split_count integer;
  v_split_total_cents bigint;
begin
  if v_actor_id is null or not coalesce(public.is_allowed_user(), false) then
    return jsonb_build_object('status', 'unauthenticated');
  end if;

  if p_record_id is null
    or p_amount is null
    or p_entry_type is null
    or p_category_id is null
    or p_paid_by is null
    or p_split_mode is null
    or p_occurred_on is null
  then
    return jsonb_build_object('status', 'invalid_input');
  end if;

  if p_entry_type not in ('expense', 'income') then
    return jsonb_build_object('status', 'invalid_input');
  end if;

  if p_split_mode not in ('equal', 'personal') then
    return jsonb_build_object('status', 'invalid_input');
  end if;

  if p_amount <= 0
    or p_amount > 9999999999.99
    or p_amount <> trunc(p_amount, 2)
  then
    return jsonb_build_object('status', 'invalid_input');
  end if;

  v_amount_cents := (p_amount * 100)::bigint;
  v_note := nullif(btrim(coalesce(p_note, '')), '');

  select *
  into v_entry
  from public.ledger_entries
  where id = p_record_id
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if not public.is_household_member(v_entry.household_id) then
    return jsonb_build_object('status', 'not_household_member');
  end if;

  if v_entry.voided_at is not null then
    return jsonb_build_object(
      'status', 'already_voided',
      'recordId', v_entry.id
    );
  end if;

  if not exists (
    select 1
    from public.categories category
    where category.id = p_category_id
      and category.household_id = v_entry.household_id
  ) then
    return jsonb_build_object('status', 'invalid_input');
  end if;

  if not exists (
    select 1
    from public.household_members member
    where member.household_id = v_entry.household_id
      and member.user_id = p_paid_by
  ) then
    return jsonb_build_object('status', 'invalid_input');
  end if;

  select count(*)
  into v_member_count
  from public.household_members member
  where member.household_id = v_entry.household_id;

  if v_member_count <= 0 then
    return jsonb_build_object('status', 'invalid_input');
  end if;

  v_original_month_start := date_trunc('month', v_entry.occurred_on::timestamp)::date;
  v_target_month_start := date_trunc('month', p_occurred_on::timestamp)::date;

  if exists (
    select 1
    from public.settlement_snapshots snapshot
    where snapshot.household_id = v_entry.household_id
      and snapshot.month_start in (v_original_month_start, v_target_month_start)
      and snapshot.lifecycle_status = 'pending_replacement'
  ) then
    return jsonb_build_object(
      'status', 'blocked_pending_replacement',
      'recordId', v_entry.id,
      'originalMonthStart', v_original_month_start,
      'targetMonthStart', v_target_month_start
    );
  end if;

  begin
    update public.ledger_entries
    set amount = p_amount::numeric(12, 2),
        entry_type = p_entry_type,
        category_id = p_category_id,
        paid_by = p_paid_by,
        split_mode = p_split_mode,
        occurred_on = p_occurred_on,
        note = v_note,
        updated_at = now(),
        updated_by = v_actor_id
    where id = v_entry.id
      and voided_at is null
    returning id
    into v_updated_id;

    if v_updated_id is null then
      return jsonb_build_object(
        'status', 'already_voided',
        'recordId', v_entry.id
      );
    end if;

    delete from public.ledger_entry_splits
    where entry_id = v_entry.id;

    if p_split_mode = 'personal' then
      insert into public.ledger_entry_splits (entry_id, user_id, share_amount)
      values (v_entry.id, p_paid_by, p_amount::numeric(12, 2));
    else
      v_base_share_cents := floor(v_amount_cents::numeric / v_member_count)::bigint;
      v_last_share_cents := v_amount_cents - (v_base_share_cents * (v_member_count - 1));

      insert into public.ledger_entry_splits (entry_id, user_id, share_amount)
      select
        v_entry.id,
        ordered_member.user_id,
        (
          case
            when ordered_member.member_index = ordered_member.member_count then v_last_share_cents
            else v_base_share_cents
          end
        )::numeric / 100
      from (
        select
          member.user_id,
          row_number() over (order by member.joined_at asc nulls last, member.user_id asc) as member_index,
          count(*) over () as member_count
        from public.household_members member
        where member.household_id = v_entry.household_id
      ) ordered_member;
    end if;

    select
      count(*)::integer,
      coalesce(sum((share_amount * 100)::bigint), 0)
    into v_split_count, v_split_total_cents
    from public.ledger_entry_splits
    where entry_id = v_entry.id;

    if v_split_total_cents <> v_amount_cents then
      raise exception 'record split total mismatch';
    end if;

    if (p_split_mode = 'personal' and v_split_count <> 1)
      or (p_split_mode = 'equal' and v_split_count <> v_member_count)
    then
      raise exception 'record split count mismatch';
    end if;
  exception
    when others then
      return jsonb_build_object('status', 'error');
  end;

  return jsonb_build_object(
    'status', 'updated',
    'recordId', v_entry.id,
    'householdId', v_entry.household_id,
    'originalMonthStart', v_original_month_start,
    'targetMonthStart', v_target_month_start,
    'splitCount', v_split_count
  );
end;
$$;

revoke all on function public.update_ledger_record_v1(
  uuid,
  numeric,
  text,
  uuid,
  uuid,
  text,
  date,
  text
) from public;

revoke all on function public.update_ledger_record_v1(
  uuid,
  numeric,
  text,
  uuid,
  uuid,
  text,
  date,
  text
) from anon;

grant execute on function public.update_ledger_record_v1(
  uuid,
  numeric,
  text,
  uuid,
  uuid,
  text,
  date,
  text
) to authenticated;

comment on function public.update_ledger_record_v1(
  uuid,
  numeric,
  text,
  uuid,
  uuid,
  text,
  date,
  text
) is
  'Record Mutation V1 SECURITY INVOKER edit RPC. Atomically updates one non-voided ledger entry and rebuilds equal/personal split rows under existing household-member RLS. It blocks pending replacement months and does not mutate settlement snapshots or confirmations.';
