-- Import Review V1 common-expense confirmation RPC.
-- This migration adds one SECURITY INVOKER function only. It confirms a single
-- pending expense import item as one official shared ledger entry with equal
-- splits, links the import item, recomputes batch counters, and returns the
-- next pending item. It does not mutate settlement snapshots, add DELETE
-- behavior, support personal/custom splits, or use service-role behavior.

create or replace function public.confirm_import_item_to_ledger_v1(
  p_batch_id uuid,
  p_item_id uuid,
  p_category text,
  p_paid_by_user_id uuid,
  p_note text default null,
  p_split_type text default 'equal'
)
returns jsonb
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  v_actor_id uuid := auth.uid();
  v_batch public.import_batches%rowtype;
  v_item public.import_items%rowtype;
  v_category_id uuid;
  v_note text;
  v_amount numeric(12, 2);
  v_amount_cents bigint;
  v_occurred_on date;
  v_month_start date;
  v_member_count integer;
  v_base_share_cents bigint;
  v_last_share_cents bigint;
  v_entry_id uuid;
  v_split_count integer;
  v_split_total_cents bigint;
  v_updated_item_id uuid;
  v_reviewed_count integer;
  v_imported_count integer;
  v_skipped_count integer;
  v_need_discussion_count integer;
  v_batch_status text;
  v_next_item_id uuid;
  v_write_stage text := 'entry';
begin
  if v_actor_id is null or not coalesce(public.is_allowed_user(), false) then
    return jsonb_build_object('status', 'unauthenticated');
  end if;

  if p_batch_id is null
    or p_item_id is null
    or p_category is null
    or p_paid_by_user_id is null
    or p_split_type is null
  then
    return jsonb_build_object('status', 'invalid_input');
  end if;

  if p_split_type <> 'equal' then
    return jsonb_build_object('status', 'invalid_split_type');
  end if;

  begin
    v_category_id := nullif(btrim(p_category), '')::uuid;
  exception
    when invalid_text_representation then
      return jsonb_build_object('status', 'invalid_category');
  end;

  if v_category_id is null then
    return jsonb_build_object('status', 'invalid_category');
  end if;

  select *
  into v_batch
  from public.import_batches batch
  where batch.id = p_batch_id
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if not public.is_household_member(v_batch.household_id) then
    return jsonb_build_object('status', 'not_household_member');
  end if;

  select *
  into v_item
  from public.import_items item
  where item.id = p_item_id
    and item.batch_id = v_batch.id
    and item.household_id = v_batch.household_id
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_item.review_status <> 'pending' or v_item.ledger_entry_id is not null then
    return jsonb_build_object(
      'status', 'already_reviewed',
      'batch_id', v_batch.id,
      'item_id', v_item.id
    );
  end if;

  if v_item.direction <> 'expense' then
    return jsonb_build_object(
      'status', 'unsupported_direction',
      'batch_id', v_batch.id,
      'item_id', v_item.id
    );
  end if;

  if v_item.amount_cents <= 0 or v_item.amount_cents > 999999999999 then
    return jsonb_build_object(
      'status', 'invalid_amount',
      'batch_id', v_batch.id,
      'item_id', v_item.id
    );
  end if;

  if not exists (
    select 1
    from public.categories category
    where category.id = v_category_id
      and category.household_id = v_batch.household_id
  ) then
    return jsonb_build_object('status', 'invalid_category');
  end if;

  if not exists (
    select 1
    from public.household_members member
    where member.household_id = v_batch.household_id
      and member.user_id = p_paid_by_user_id
  ) then
    return jsonb_build_object('status', 'invalid_paid_by');
  end if;

  select count(*)::integer
  into v_member_count
  from public.household_members member
  where member.household_id = v_batch.household_id;

  if v_member_count <= 0 then
    return jsonb_build_object('status', 'missing_members');
  end if;

  v_month_start := (v_item.month_key || '-01')::date;

  if exists (
    select 1
    from public.settlement_snapshots snapshot
    where snapshot.household_id = v_batch.household_id
      and snapshot.month_start = v_month_start
      and snapshot.lifecycle_status = 'pending_replacement'
  ) then
    return jsonb_build_object(
      'status', 'blocked_pending_replacement',
      'batch_id', v_batch.id,
      'item_id', v_item.id,
      'month_start', v_month_start
    );
  end if;

  v_note := nullif(btrim(coalesce(p_note, '')), '');
  v_amount_cents := v_item.amount_cents;
  v_amount := (v_amount_cents::numeric / 100)::numeric(12, 2);
  v_occurred_on := (v_item.transaction_time at time zone 'UTC')::date;

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
      v_batch.household_id,
      v_amount,
      'expense',
      v_category_id,
      p_paid_by_user_id,
      'equal',
      v_occurred_on,
      v_note,
      v_actor_id
    )
    returning id
    into v_entry_id;

    v_write_stage := 'split';
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
      where member.household_id = v_batch.household_id
    ) ordered_member;

    select
      count(*)::integer,
      coalesce(sum((share_amount * 100)::bigint), 0)
    into v_split_count, v_split_total_cents
    from public.ledger_entry_splits
    where entry_id = v_entry_id;

    if v_split_total_cents <> v_amount_cents then
      raise exception 'import confirm split total mismatch';
    end if;

    if v_split_count <> v_member_count then
      raise exception 'import confirm split count mismatch';
    end if;

    v_write_stage := 'item';

    update public.import_items
    set review_status = 'imported',
        final_category = v_category_id::text,
        final_owner_user_id = null,
        final_paid_by_user_id = p_paid_by_user_id,
        final_split_type = 'equal',
        final_note = v_note,
        ledger_entry_id = v_entry_id,
        reviewed_by = v_actor_id,
        reviewed_at = now(),
        updated_at = now()
    where id = v_item.id
      and batch_id = v_batch.id
      and household_id = v_batch.household_id
      and review_status = 'pending'
      and ledger_entry_id is null
    returning id
    into v_updated_item_id;

    if v_updated_item_id is null then
      raise exception 'import confirm item update failed';
    end if;

    select
      count(*) filter (where item.review_status in ('imported', 'skipped', 'need_discussion'))::integer,
      count(*) filter (where item.review_status = 'imported')::integer,
      count(*) filter (where item.review_status = 'skipped')::integer,
      count(*) filter (where item.review_status = 'need_discussion')::integer
    into
      v_reviewed_count,
      v_imported_count,
      v_skipped_count,
      v_need_discussion_count
    from public.import_items item
    where item.batch_id = v_batch.id
      and item.household_id = v_batch.household_id;

    v_batch_status := case
      when v_batch.parsed_count > 0 and v_reviewed_count >= v_batch.parsed_count then 'completed'
      else 'reviewing'
    end;

    v_write_stage := 'batch';

    update public.import_batches
    set reviewed_count = v_reviewed_count,
        imported_count = v_imported_count,
        skipped_count = v_skipped_count,
        need_discussion_count = v_need_discussion_count,
        status = v_batch_status,
        updated_at = now()
    where id = v_batch.id
      and household_id = v_batch.household_id;

    if not found then
      raise exception 'import confirm batch update failed';
    end if;
  exception
    when others then
      return jsonb_build_object(
        'status',
        case
          when v_write_stage = 'split' then 'split_insert_failed'
          when v_write_stage = 'item' then 'item_update_failed'
          when v_write_stage = 'batch' then 'batch_update_failed'
          else 'entry_insert_failed'
        end,
        'batch_id', v_batch.id,
        'item_id', v_item.id
      );
  end;

  select item.id
  into v_next_item_id
  from public.import_items item
  where item.batch_id = v_batch.id
    and item.household_id = v_batch.household_id
    and item.review_status = 'pending'
  order by item.transaction_time desc, item.created_at asc
  limit 1;

  return jsonb_build_object(
    'status', 'confirmed',
    'batch_id', v_batch.id,
    'item_id', v_item.id,
    'ledger_entry_id', v_entry_id,
    'next_item_id', v_next_item_id,
    'reviewed_count', v_reviewed_count,
    'imported_count', v_imported_count,
    'skipped_count', v_skipped_count,
    'need_discussion_count', v_need_discussion_count,
    'batch_status', v_batch_status
  );
end;
$$;

revoke all on function public.confirm_import_item_to_ledger_v1(
  uuid,
  uuid,
  text,
  uuid,
  text,
  text
) from public;

revoke all on function public.confirm_import_item_to_ledger_v1(
  uuid,
  uuid,
  text,
  uuid,
  text,
  text
) from anon;

grant execute on function public.confirm_import_item_to_ledger_v1(
  uuid,
  uuid,
  text,
  uuid,
  text,
  text
) to authenticated;

comment on function public.confirm_import_item_to_ledger_v1(
  uuid,
  uuid,
  text,
  uuid,
  text,
  text
) is
  'Import Review V1 SECURITY INVOKER common-expense confirm RPC. Atomically creates one expense ledger entry with equal splits, marks one pending import item imported, recomputes batch counters, blocks pending replacement months, and does not mutate settlement snapshots or use service-role behavior.';
