-- Import Review V1 lightweight review-status RPC.
-- This migration adds one SECURITY INVOKER function only. It lets authenticated
-- household members mark import_items as skipped or need_discussion, recomputes
-- import_batches counters in the same transaction, and does not create ledger
-- entries, mutate settlements, add DELETE policies, or use service-role behavior.

create or replace function public.update_import_item_review_status_v1(
  p_batch_id uuid,
  p_item_id uuid,
  p_review_status text,
  p_note text default null
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
  v_reviewed_count integer;
  v_imported_count integer;
  v_skipped_count integer;
  v_need_discussion_count integer;
  v_batch_status text;
  v_next_item_id uuid;
begin
  if v_actor_id is null or not coalesce(public.is_allowed_user(), false) then
    return jsonb_build_object('status', 'unauthenticated');
  end if;

  if p_batch_id is null or p_item_id is null or p_review_status is null then
    return jsonb_build_object('status', 'invalid_input');
  end if;

  if p_review_status not in ('skipped', 'need_discussion') then
    return jsonb_build_object('status', 'invalid_status');
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

  if v_item.review_status = 'imported' or v_item.ledger_entry_id is not null then
    return jsonb_build_object(
      'status', 'already_imported',
      'batch_id', v_batch.id,
      'item_id', v_item.id
    );
  end if;

  if v_item.review_status not in ('pending', 'skipped', 'need_discussion') then
    return jsonb_build_object(
      'status', 'invalid_transition',
      'batch_id', v_batch.id,
      'item_id', v_item.id
    );
  end if;

  update public.import_items
  set review_status = p_review_status,
      reviewed_by = v_actor_id,
      reviewed_at = now(),
      updated_at = now()
  where id = v_item.id
    and batch_id = v_batch.id
    and household_id = v_batch.household_id
    and ledger_entry_id is null
    and review_status in ('pending', 'skipped', 'need_discussion');

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

  update public.import_batches
  set reviewed_count = v_reviewed_count,
      imported_count = v_imported_count,
      skipped_count = v_skipped_count,
      need_discussion_count = v_need_discussion_count,
      status = v_batch_status,
      updated_at = now()
  where id = v_batch.id
    and household_id = v_batch.household_id;

  select item.id
  into v_next_item_id
  from public.import_items item
  where item.batch_id = v_batch.id
    and item.household_id = v_batch.household_id
    and item.review_status = 'pending'
  order by item.transaction_time desc, item.created_at asc
  limit 1;

  return jsonb_build_object(
    'status', 'updated',
    'batch_id', v_batch.id,
    'item_id', v_item.id,
    'review_status', p_review_status,
    'next_item_id', v_next_item_id,
    'reviewed_count', v_reviewed_count,
    'imported_count', v_imported_count,
    'skipped_count', v_skipped_count,
    'need_discussion_count', v_need_discussion_count,
    'batch_status', v_batch_status
  );
end;
$$;

revoke all on function public.update_import_item_review_status_v1(
  uuid,
  uuid,
  text,
  text
) from public;

revoke all on function public.update_import_item_review_status_v1(
  uuid,
  uuid,
  text,
  text
) from anon;

grant execute on function public.update_import_item_review_status_v1(
  uuid,
  uuid,
  text,
  text
) to authenticated;

comment on function public.update_import_item_review_status_v1(
  uuid,
  uuid,
  text,
  text
) is
  'Import Review V1 SECURITY INVOKER review-status RPC. Marks one household-scoped import item as skipped or need_discussion, recomputes import batch counters atomically, and does not create ledger entries, mutate settlements, add delete behavior, or use service-role behavior.';
