create table if not exists public.allowed_user_emails (
  email text primary key,
  intended_display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_key text,
  created_at timestamptz not null default now()
);

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'partner')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  icon text,
  color text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  entry_type text not null check (entry_type in ('expense', 'income')),
  category_id uuid references public.categories(id) on delete set null,
  paid_by uuid not null references auth.users(id),
  split_mode text not null check (split_mode in ('equal', 'custom', 'personal')),
  occurred_on date not null,
  note text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ledger_entry_splits (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.ledger_entries(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  share_amount numeric(12,2) not null check (share_amount >= 0)
);

create index if not exists household_members_user_id_idx
  on public.household_members(user_id);

create index if not exists categories_household_id_idx
  on public.categories(household_id);

create index if not exists ledger_entries_household_occurred_on_idx
  on public.ledger_entries(household_id, occurred_on desc);

create index if not exists ledger_entries_paid_by_idx
  on public.ledger_entries(paid_by);

create index if not exists ledger_entry_splits_entry_id_idx
  on public.ledger_entry_splits(entry_id);

create index if not exists ledger_entry_splits_user_id_idx
  on public.ledger_entry_splits(user_id);

alter table public.allowed_user_emails enable row level security;
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.categories enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.ledger_entry_splits enable row level security;

-- RLS policies are intentionally omitted in this migration.
-- With RLS enabled and no policies, browser clients should not be able to access these tables.
-- Policies, helper functions, and seed data will be added in later focused migrations.
