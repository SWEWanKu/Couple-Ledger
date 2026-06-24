-- Import Review V1 schema and RLS.
-- This migration adds import_batches/import_items only. It does not add upload,
-- parser, UI, app helpers, API routes, server actions, RPCs, file storage,
-- generated types, service-role behavior, ledger writes, or settlement writes.

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id),
  source text not null,
  file_name text not null,
  file_sha256 text not null,
  period_start date,
  period_end date,
  total_count integer not null default 0,
  parsed_count integer not null default 0,
  reviewed_count integer not null default 0,
  imported_count integer not null default 0,
  skipped_count integer not null default 0,
  need_discussion_count integer not null default 0,
  status text not null default 'parsed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint import_batches_id_household_unique unique (id, household_id),
  constraint import_batches_household_source_file_sha256_unique unique (
    household_id,
    source,
    file_sha256
  ),
  constraint import_batches_source_check check (source in ('wechat', 'alipay')),
  constraint import_batches_status_check check (status in ('parsed', 'reviewing', 'completed')),
  constraint import_batches_file_name_not_blank_check check (length(btrim(file_name)) > 0),
  constraint import_batches_file_sha256_not_blank_check check (length(btrim(file_sha256)) > 0),
  constraint import_batches_period_order_check check (
    period_start is null
    or period_end is null
    or period_start <= period_end
  ),
  constraint import_batches_counter_nonnegative_check check (
    total_count >= 0
    and parsed_count >= 0
    and reviewed_count >= 0
    and imported_count >= 0
    and skipped_count >= 0
    and need_discussion_count >= 0
  ),
  constraint import_batches_counter_bounds_check check (
    parsed_count <= total_count
    and reviewed_count <= parsed_count
    and imported_count + skipped_count + need_discussion_count <= parsed_count
  )
);

create table if not exists public.import_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  source text not null,
  source_transaction_id text,
  transaction_time timestamptz not null,
  month_key text not null,
  direction text not null,
  amount_cents bigint not null,
  counterparty text,
  description text,
  payment_method text,
  source_category text,
  source_status text,
  raw_json jsonb not null default '{}'::jsonb,
  review_status text not null default 'pending',
  suggested_category text,
  final_category text,
  final_owner_user_id uuid references auth.users(id),
  final_paid_by_user_id uuid references auth.users(id),
  final_split_type text,
  final_note text,
  ledger_entry_id uuid references public.ledger_entries(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint import_items_batch_household_fk
    foreign key (batch_id, household_id)
    references public.import_batches(id, household_id)
    on delete cascade,
  constraint import_items_source_check check (source in ('wechat', 'alipay')),
  constraint import_items_source_transaction_not_blank_check check (
    source_transaction_id is null
    or length(btrim(source_transaction_id)) > 0
  ),
  constraint import_items_direction_check check (
    direction in ('expense', 'income', 'transfer', 'refund', 'unknown')
  ),
  constraint import_items_amount_cents_nonnegative_check check (amount_cents >= 0),
  constraint import_items_month_key_format_check check (
    month_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
  ),
  constraint import_items_raw_json_object_check check (jsonb_typeof(raw_json) = 'object'),
  constraint import_items_review_status_check check (
    review_status in ('pending', 'imported', 'skipped', 'need_discussion')
  ),
  constraint import_items_ledger_entry_status_check check (
    (
      review_status = 'imported'
      and ledger_entry_id is not null
    )
    or
    (
      review_status <> 'imported'
      and ledger_entry_id is null
    )
  ),
  constraint import_items_review_actor_pair_check check (
    (
      review_status = 'pending'
      and reviewed_by is null
      and reviewed_at is null
    )
    or
    (
      review_status <> 'pending'
      and reviewed_by is not null
      and reviewed_at is not null
    )
  ),
  constraint import_items_final_split_type_check check (
    final_split_type is null
    or final_split_type in ('equal', 'personal')
  )
);

comment on table public.import_batches is
  'Import Review V1 batch metadata for WeChat/Alipay source files. Rows are household-scoped review queues, not official ledger records.';

comment on table public.import_items is
  'Import Review V1 normalized source transactions. Rows preserve source data and review outcomes; only imported items may link to official ledger_entries.';

comment on column public.import_batches.file_sha256 is
  'Server-calculated source file hash used to prevent repeated batch/file imports for the same household and source.';

comment on column public.import_items.amount_cents is
  'Integer cents from the source transaction. Import rows allow zero-value source rows; future confirm-to-ledger code must still enforce existing ledger amount rules.';

comment on column public.import_items.raw_json is
  'Original normalized source row payload for private household audit/debugging. This migration does not store original uploaded files.';

comment on column public.import_items.source_transaction_id is
  'Stable source transaction id when provided by WeChat/Alipay. The partial unique index is best-effort and only applies when this id is present.';

create index if not exists import_batches_household_created_at_idx
  on public.import_batches(household_id, created_at desc);

create index if not exists import_items_household_batch_review_time_idx
  on public.import_items(household_id, batch_id, review_status, transaction_time desc);

create index if not exists import_items_household_month_key_idx
  on public.import_items(household_id, month_key);

create index if not exists import_items_ledger_entry_id_idx
  on public.import_items(ledger_entry_id)
  where ledger_entry_id is not null;

create unique index if not exists import_items_household_source_transaction_unique_idx
  on public.import_items(household_id, source, source_transaction_id)
  where source_transaction_id is not null;

comment on index public.import_items_household_source_transaction_unique_idx is
  'Import Review V1 best-effort dedupe for platforms that provide stable source transaction ids. Rows without source_transaction_id are not covered.';

alter table public.import_batches enable row level security;
alter table public.import_items enable row level security;

create policy "Household members can view import batches"
on public.import_batches
for select
to authenticated
using (
  (select auth.uid()) is not null
  and (select public.is_allowed_user())
  and (select public.is_household_member(household_id))
);

create policy "Household members can insert import batches"
on public.import_batches
for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and (select public.is_allowed_user())
  and (select public.is_household_member(household_id))
  and uploaded_by = (select auth.uid())
);

create policy "Household members can update import batches"
on public.import_batches
for update
to authenticated
using (
  (select auth.uid()) is not null
  and (select public.is_allowed_user())
  and (select public.is_household_member(household_id))
)
with check (
  (select auth.uid()) is not null
  and (select public.is_allowed_user())
  and (select public.is_household_member(household_id))
  and exists (
    select 1
    from public.household_members member
    where member.household_id = import_batches.household_id
      and member.user_id = import_batches.uploaded_by
  )
);

create policy "Household members can view import items"
on public.import_items
for select
to authenticated
using (
  (select auth.uid()) is not null
  and (select public.is_allowed_user())
  and (select public.is_household_member(household_id))
);

create policy "Household members can insert pending import items"
on public.import_items
for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and (select public.is_allowed_user())
  and (select public.is_household_member(household_id))
  and review_status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
  and ledger_entry_id is null
  and final_category is null
  and final_owner_user_id is null
  and final_paid_by_user_id is null
  and final_split_type is null
  and final_note is null
  and exists (
    select 1
    from public.import_batches batch
    where batch.id = import_items.batch_id
      and batch.household_id = import_items.household_id
      and batch.source = import_items.source
  )
);

create policy "Household members can update import items"
on public.import_items
for update
to authenticated
using (
  (select auth.uid()) is not null
  and (select public.is_allowed_user())
  and (select public.is_household_member(household_id))
)
with check (
  (select auth.uid()) is not null
  and (select public.is_allowed_user())
  and (select public.is_household_member(household_id))
  and exists (
    select 1
    from public.import_batches batch
    where batch.id = import_items.batch_id
      and batch.household_id = import_items.household_id
      and batch.source = import_items.source
  )
  and (
    review_status = 'pending'
    or reviewed_by = (select auth.uid())
  )
  and (
    final_owner_user_id is null
    or exists (
      select 1
      from public.household_members owner_member
      where owner_member.household_id = import_items.household_id
        and owner_member.user_id = import_items.final_owner_user_id
    )
  )
  and (
    final_paid_by_user_id is null
    or exists (
      select 1
      from public.household_members paid_by_member
      where paid_by_member.household_id = import_items.household_id
        and paid_by_member.user_id = import_items.final_paid_by_user_id
    )
  )
  and (
    ledger_entry_id is null
    or exists (
      select 1
      from public.ledger_entries entry
      where entry.id = import_items.ledger_entry_id
        and entry.household_id = import_items.household_id
    )
  )
);

comment on policy "Household members can view import batches"
on public.import_batches is
  'Import Review V1 SELECT policy. Authenticated allowed users can view batches only for households they belong to.';

comment on policy "Household members can insert import batches"
on public.import_batches is
  'Import Review V1 INSERT policy. The uploader must be the current authenticated user and a member of the target household.';

comment on policy "Household members can update import batches"
on public.import_batches is
  'Import Review V1 UPDATE policy for progress counters/status. It remains household-scoped and does not add delete behavior.';

comment on policy "Household members can view import items"
on public.import_items is
  'Import Review V1 SELECT policy. Authenticated allowed users can view items only for households they belong to.';

comment on policy "Household members can insert pending import items"
on public.import_items is
  'Import Review V1 INSERT policy for parser/upload output. Inserted items must start pending and cannot spoof review actors or ledger links.';

comment on policy "Household members can update import items"
on public.import_items is
  'Import Review V1 UPDATE policy for future review outcomes. Review actors must be the current authenticated user and linked users/records must stay in the same household.';

-- No DELETE policies are created for Import Review V1.
