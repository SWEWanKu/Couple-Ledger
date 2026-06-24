-- Record Mutation V1 transaction-safe create RPC.
-- This migration adds one SECURITY INVOKER function only. It does not add app
-- routes, service-role behavior, hard-delete cleanup, settlement writes, or RLS
-- bypass behavior.

create or replace function public.create_ledger_record_v1(
  p_household_id uuid,
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
  v_note text;
  v_amount_cents bigint;
  v_member_count integer;
  v_base_share_cents bigint;
  v_last_share_cents bigint;
  v_entry_id uuid;
  v_split_count integer;
  v_split_total_cents bigint;
  v_insert_stage text := 'entry';
begin
  if v_actor_id is null or not coalesce(public.is_allowed_user(), false) then
    return jsonb_build_object('status', 'unauthenticated');
  end if;

  if p_household_id is null
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
    return jsonb_build_object('status', 'invalid_entry_type');
  end if;

  if p_split_mode not in ('equal', 'personal') then
    return jsonb_build_object('status', 'invalid_split_mode');
  end if;

  if p_amount <= 0
    or p_amount > 9999999999.99
    or p_amount <> trunc(p_amount, 2)
  then
    return jsonb_build_object('status', 'invalid_amount');
  end if;

  if not public.is_household_member(p_household_id) then
    return jsonb_build_object('status', 'not_household_member');
  end if;

  if not exists (
    select 1
    from public.categories category
    where category.id = p_category_id
      and category.household_id = p_household_id
  ) then
    return jsonb_build_object('status', 'invalid_category');
  end if;

  if not exists (
    select 1
    from public.household_members member
    where member.household_id = p_household_id
      and member.user_id = p_paid_by
  ) then
    return jsonb_build_object('status', 'invalid_handler');
  end if;

  select count(*)
  into v_member_count
  from public.household_members member
  where member.household_id = p_household_id;

  if v_member_count <= 0 then
    return jsonb_build_object('status', 'missing_members');
  end if;

  v_amount_cents := (p_amount * 100)::bigint;
  v_note := nullif(btrim(coalesce(p_note, '')), '');

  begin
    insert into public.ledger_entries (
      household_id,
      amount,
      entry_type,
      category_id,
      paid_by,
      split_mode,
      occurred_on,
      note,
      created_by
    )
    values (
      p_household_id,
      p_amount::numeric(12, 2),
      p_entry_type,
      p_category_id,
      p_paid_by,
      p_split_mode,
      p_occurred_on,
      v_note,
      v_actor_id
    )
    returning id
    into v_entry_id;

    if p_split_mode = 'personal' then
      v_insert_stage := 'split';

      insert into public.ledger_entry_splits (entry_id, user_id, share_amount)
      values (v_entry_id, p_paid_by, p_amount::numeric(12, 2));
    else
      v_insert_stage := 'split';

      v_base_share_cents := floor(v_amount_cents::numeric / v_member_count)::bigint;
      v_last_share_cents := v_amount_cents - (v_base_share_cents * (v_member_count - 1));

      insert into public.ledger_entry_splits (entry_id, user_id, share_amount)
      select
        v_entry_id,
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
        where member.household_id = p_household_id
      ) ordered_member;
    end if;

    select
      count(*)::integer,
      coalesce(sum((share_amount * 100)::bigint), 0)
    into v_split_count, v_split_total_cents
    from public.ledger_entry_splits
    where entry_id = v_entry_id;

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
      return jsonb_build_object(
        'status',
        case
          when v_insert_stage = 'split' then 'split_insert_failed'
          else 'entry_insert_failed'
        end
      );
  end;

  return jsonb_build_object(
    'status', 'created',
    'recordId', v_entry_id,
    'splitCount', v_split_count
  );
end;
$$;

revoke all on function public.create_ledger_record_v1(
  uuid,
  numeric,
  text,
  uuid,
  uuid,
  text,
  date,
  text
) from public;

revoke all on function public.create_ledger_record_v1(
  uuid,
  numeric,
  text,
  uuid,
  uuid,
  text,
  date,
  text
) from anon;

grant execute on function public.create_ledger_record_v1(
  uuid,
  numeric,
  text,
  uuid,
  uuid,
  text,
  date,
  text
) to authenticated;

comment on function public.create_ledger_record_v1(
  uuid,
  numeric,
  text,
  uuid,
  uuid,
  text,
  date,
  text
) is
  'Record Mutation V1 SECURITY INVOKER create RPC. Atomically inserts one ledger entry and matching equal/personal split rows under existing household-member RLS. It does not hard-delete ledger entries, mutate settlement snapshots, or use service-role behavior.';
