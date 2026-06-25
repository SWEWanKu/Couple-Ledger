-- Import Review V1 personal-skip RPC.
-- This migration adds one SECURITY INVOKER personal outcome function and
-- tightens the existing lightweight reopen function so skipped personal source
-- trails are cleared when an item returns to pending. It does not create ledger
-- entries, mutate settlements, add DELETE policies, or use service-role
-- behavior.

create or replace function public.mark_import_item_personal_v1(
  p_batch_id uuid,
  p_item_id uuid,
  p_owner_user_id uuid,
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
  v_note text;
begin
  if v_actor_id is null or not coalesce(public.is_allowed_user(), false) then
    return jsonb_build_object('status', 'unauthenticated');
  end if;

  if p_batch_id is null or p_item_id is null or p_owner_user_id is null then
    return jsonb_build_object('status', 'invalid_input');
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

  if not exists (
    select 1
    from public.household_members owner_member
    where owner_member.household_id = v_batch.household_id
      and owner_member.user_id = p_owner_user_id
  ) then
    return jsonb_build_object(
      'status', 'invalid_owner',
      'batch_id', v_batch.id,
      'item_id', p_item_id,
      'owner_user_id', p_owner_user_id
    );
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

  v_note := nullif(left(btrim(coalesce(p_note, '')), 120), '');

  update public.import_items
  set review_status = 'skipped',
      final_owner_user_id = p_owner_user_id,
      final_paid_by_user_id = null,
      final_split_type = 'personal',
      final_note = coalesce(v_note, '个人支出，不进入共同账本'),
      reviewed_by = v_actor_id,
      reviewed_at = now(),
      updated_at = now()
  where id = v_item.id
    and batch_id = v_batch.id
    and household_id = v_batch.household_id
    and ledger_entry_id is null
    and review_status in ('pending', 'skipped', 'need_discussion');

  if not found then
    return jsonb_build_object(
      'status', 'invalid_transition',
      'batch_id', v_batch.id,
      'item_id', v_item.id
    );
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
    'status', 'personal_skipped',
    'batch_id', v_batch.id,
    'item_id', v_item.id,
    'owner_user_id', p_owner_user_id,
    'next_item_id', v_next_item_id,
    'reviewed_count', v_reviewed_count,
    'imported_count', v_imported_count,
    'skipped_count', v_skipped_count,
    'need_discussion_count', v_need_discussion_count,
    'batch_status', v_batch_status
  );
end;
$$;

revoke all on function public.mark_import_item_personal_v1(
  uuid,
  uuid,
  uuid,
  text
) from public;

revoke all on function public.mark_import_item_personal_v1(
  uuid,
  uuid,
  uuid,
  text
) from anon;

grant execute on function public.mark_import_item_personal_v1(
  uuid,
  uuid,
  uuid,
  text
) to authenticated;

comment on function public.mark_import_item_personal_v1(
  uuid,
  uuid,
  uuid,
  text
) is
  'Import Review V1 SECURITY INVOKER personal-skip RPC. Marks one household-scoped pending/skipped/need_discussion import item as a skipped personal expense for a household member, preserves source trail, recomputes batch counters atomically, and does not create ledger entries, mutate settlements, add delete behavior, or use service-role behavior.';

create or replace function public.reopen_import_item_to_pending_v1(
  p_batch_id uuid,
  p_item_id uuid
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
begin
  if v_actor_id is null or not coalesce(public.is_allowed_user(), false) then
    return jsonb_build_object('status', 'unauthenticated');
  end if;

  if p_batch_id is null or p_item_id is null then
    return jsonb_build_object('status', 'invalid_input');
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

  if v_item.review_status = 'pending' then
    return jsonb_build_object(
      'status', 'already_pending',
      'batch_id', v_batch.id,
      'item_id', v_item.id
    );
  end if;

  if v_item.review_status = 'imported' or v_item.ledger_entry_id is not null then
    return jsonb_build_object(
      'status', 'already_imported',
      'batch_id', v_batch.id,
      'item_id', v_item.id
    );
  end if;

  if v_item.review_status not in ('skipped', 'need_discussion') then
    return jsonb_build_object(
      'status', 'invalid_transition',
      'batch_id', v_batch.id,
      'item_id', v_item.id
    );
  end if;

  update public.import_items
  set review_status = 'pending',
      final_category = null,
      final_owner_user_id = null,
      final_paid_by_user_id = null,
      final_split_type = null,
      final_note = null,
      reviewed_by = null,
      reviewed_at = null,
      updated_at = now()
  where id = v_item.id
    and batch_id = v_batch.id
    and household_id = v_batch.household_id
    and ledger_entry_id is null
    and review_status in ('skipped', 'need_discussion');

  if not found then
    return jsonb_build_object(
      'status', 'invalid_transition',
      'batch_id', v_batch.id,
      'item_id', v_item.id
    );
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

  update public.import_batches
  set reviewed_count = v_reviewed_count,
      imported_count = v_imported_count,
      skipped_count = v_skipped_count,
      need_discussion_count = v_need_discussion_count,
      status = v_batch_status,
      updated_at = now()
  where id = v_batch.id
    and household_id = v_batch.household_id;

  return jsonb_build_object(
    'status', 'reopened',
    'batch_id', v_batch.id,
    'item_id', v_item.id,
    'reviewed_count', v_reviewed_count,
    'imported_count', v_imported_count,
    'skipped_count', v_skipped_count,
    'need_discussion_count', v_need_discussion_count,
    'batch_status', v_batch_status
  );
end;
$$;

revoke all on function public.reopen_import_item_to_pending_v1(
  uuid,
  uuid
) from public;

revoke all on function public.reopen_import_item_to_pending_v1(
  uuid,
  uuid
) from anon;

grant execute on function public.reopen_import_item_to_pending_v1(
  uuid,
  uuid
) to authenticated;

comment on function public.reopen_import_item_to_pending_v1(
  uuid,
  uuid
) is
  'Import Review V1 SECURITY INVOKER reopen RPC. Moves one household-scoped skipped or need_discussion import item back to pending, clears review actor metadata and final review fields, recomputes import batch counters atomically, and does not unlink imported items, create or delete ledger entries, mutate settlements, add delete behavior, or use service-role behavior.';
