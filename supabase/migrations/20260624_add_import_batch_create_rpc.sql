-- Import Review V1 transaction-safe batch creation RPC.
-- This migration adds one SECURITY INVOKER function only. It does not add
-- upload UI, import routes, server actions, service-role behavior, ledger
-- writes, settlement writes, DELETE policies, or RLS bypass behavior.

create or replace function public.create_import_batch_v1(
  p_household_id uuid,
  p_source text,
  p_file_name text,
  p_file_sha256 text,
  p_period_start date,
  p_period_end date,
  p_items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  v_actor_id uuid := auth.uid();
  v_item_count integer;
  v_batch_id uuid;
  v_existing_batch_id uuid;
  v_inserted_item_count integer;
  v_constraint_name text;
begin
  if v_actor_id is null or not coalesce(public.is_allowed_user(), false) then
    return jsonb_build_object('status', 'unauthenticated');
  end if;

  if p_household_id is null
    or p_source is null
    or p_file_name is null
    or p_file_sha256 is null
    or p_items is null
  then
    return jsonb_build_object('status', 'invalid_input');
  end if;

  if p_source not in ('wechat', 'alipay') then
    return jsonb_build_object('status', 'invalid_source');
  end if;

  if length(btrim(p_file_name)) = 0 or length(btrim(p_file_sha256)) = 0 then
    return jsonb_build_object('status', 'invalid_input');
  end if;

  if p_period_start is not null
    and p_period_end is not null
    and p_period_start > p_period_end
  then
    return jsonb_build_object('status', 'invalid_period');
  end if;

  if jsonb_typeof(p_items) <> 'array' then
    return jsonb_build_object('status', 'invalid_items');
  end if;

  v_item_count := jsonb_array_length(p_items);

  if v_item_count <= 0 then
    return jsonb_build_object('status', 'empty_items');
  end if;

  if not public.is_household_member(p_household_id) then
    return jsonb_build_object('status', 'not_household_member');
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as item(value)
    where jsonb_typeof(item.value) <> 'object'
      or not (item.value ? 'transactionTime')
      or not (item.value ? 'monthKey')
      or not (item.value ? 'direction')
      or not (item.value ? 'amountCents')
      or not (item.value ? 'rawJson')
      or jsonb_typeof(item.value -> 'rawJson') <> 'object'
      or coalesce(item.value ->> 'reviewStatus', 'pending') <> 'pending'
      or (
        item.value ? 'source'
        and item.value ->> 'source' <> p_source
      )
  ) then
    return jsonb_build_object('status', 'invalid_items');
  end if;

  select batch.id
  into v_existing_batch_id
  from public.import_batches batch
  where batch.household_id = p_household_id
    and batch.source = p_source
    and batch.file_sha256 = p_file_sha256
  limit 1;

  if v_existing_batch_id is not null then
    return jsonb_build_object(
      'status', 'already_exists',
      'batch_id', v_existing_batch_id,
      'item_count', 0,
      'message', 'import_batch_already_exists'
    );
  end if;

  begin
    insert into public.import_batches (
      household_id,
      uploaded_by,
      source,
      file_name,
      file_sha256,
      period_start,
      period_end,
      total_count,
      parsed_count,
      reviewed_count,
      imported_count,
      skipped_count,
      need_discussion_count,
      status
    )
    values (
      p_household_id,
      v_actor_id,
      p_source,
      btrim(p_file_name),
      btrim(p_file_sha256),
      p_period_start,
      p_period_end,
      v_item_count,
      v_item_count,
      0,
      0,
      0,
      0,
      'parsed'
    )
    returning id
    into v_batch_id;

    insert into public.import_items (
      batch_id,
      household_id,
      source,
      source_transaction_id,
      transaction_time,
      month_key,
      direction,
      amount_cents,
      counterparty,
      description,
      payment_method,
      source_category,
      source_status,
      raw_json,
      review_status,
      suggested_category
    )
    select
      v_batch_id,
      p_household_id,
      p_source,
      nullif(btrim(item.value ->> 'sourceTransactionId'), ''),
      (item.value ->> 'transactionTime')::timestamptz,
      item.value ->> 'monthKey',
      item.value ->> 'direction',
      (item.value ->> 'amountCents')::bigint,
      nullif(btrim(item.value ->> 'counterparty'), ''),
      nullif(btrim(item.value ->> 'description'), ''),
      nullif(btrim(item.value ->> 'paymentMethod'), ''),
      nullif(btrim(item.value ->> 'sourceCategory'), ''),
      nullif(btrim(item.value ->> 'sourceStatus'), ''),
      item.value -> 'rawJson',
      'pending',
      nullif(btrim(item.value ->> 'suggestedCategory'), '')
    from jsonb_array_elements(p_items) as item(value);

    get diagnostics v_inserted_item_count = row_count;

    if v_inserted_item_count <> v_item_count then
      raise exception 'import item insert count mismatch';
    end if;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint_name = constraint_name;

      if v_constraint_name = 'import_batches_household_source_file_sha256_unique' then
        select batch.id
        into v_existing_batch_id
        from public.import_batches batch
        where batch.household_id = p_household_id
          and batch.source = p_source
          and batch.file_sha256 = p_file_sha256
        limit 1;

        if v_existing_batch_id is not null then
          return jsonb_build_object(
            'status', 'already_exists',
            'batch_id', v_existing_batch_id,
            'item_count', 0,
            'message', 'import_batch_already_exists'
          );
        end if;
      end if;

      return jsonb_build_object(
        'status', 'item_insert_failed',
        'batch_id', null,
        'item_count', 0,
        'message', 'source_transaction_conflict_or_unique_violation'
      );
    when others then
      return jsonb_build_object(
        'status', 'insert_failed',
        'batch_id', null,
        'item_count', 0,
        'message', 'import_batch_or_items_insert_failed'
      );
  end;

  return jsonb_build_object(
    'status', 'created',
    'batch_id', v_batch_id,
    'item_count', v_inserted_item_count,
    'message', 'import_batch_created'
  );
end;
$$;

revoke all on function public.create_import_batch_v1(
  uuid,
  text,
  text,
  text,
  date,
  date,
  jsonb
) from public;

revoke all on function public.create_import_batch_v1(
  uuid,
  text,
  text,
  text,
  date,
  date,
  jsonb
) from anon;

grant execute on function public.create_import_batch_v1(
  uuid,
  text,
  text,
  text,
  date,
  date,
  jsonb
) to authenticated;

comment on function public.create_import_batch_v1(
  uuid,
  text,
  text,
  text,
  date,
  date,
  jsonb
) is
  'Import Review V1 SECURITY INVOKER batch creation RPC. Atomically inserts one import_batches row and matching pending import_items from normalized parser drafts under existing household-member RLS. It does not create ledger entries, mutate settlements, add upload behavior, or use service-role behavior.';
