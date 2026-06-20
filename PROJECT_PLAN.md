# Couple Ledger Implementation Plan

> For future agentic workers: execute this plan one focused change at a time. Do not implement multiple product areas in one pass, and do not create ledger data flows before Supabase Auth and RLS are in place.

**Goal:** Turn the current Couple Ledger skeleton into a private, two-person couple accounting web app with warm Animal-Island-style UI, Supabase-backed auth/data, and Vercel deployment.

**Architecture:** Keep the existing Next.js App Router project instead of migrating to Vite, because the workspace is already an app repo with routes, layout components, Tailwind, `package-lock.json`, and installed dependencies. Add `animal-island-ui` as the UI component library, import `animal-island-ui/style` exactly once in `src/app/layout.tsx`, and use Supabase Auth plus Postgres RLS as the real security boundary.

**Tech Stack:** npm, Next.js 15 App Router, React 19, TypeScript, Tailwind CSS already present, future `animal-island-ui`, future `@supabase/supabase-js`, future `@supabase/ssr`, Supabase Postgres/RLS, Vercel.

---

## Detected Workspace Summary

Workspace path: `C:\Users\WanKu\Documents\Couple Ledger`

Inspection commands run:

```powershell
Get-Location
Get-ChildItem -Force
rg --files -g '!node_modules' -g '!dist' -g '!build' -g '!coverage' | Select-Object -First 200
Get-Content -LiteralPath 'package.json'
Get-Content -LiteralPath 'README.md'
Get-Content -LiteralPath 'src\app\layout.tsx'
Get-Content -LiteralPath 'src\app\page.tsx'
Get-Content -LiteralPath 'src\app\login\page.tsx'
Get-Content -LiteralPath 'src\app\dashboard\page.tsx'
rg -n "animal-island-ui|Animal|animal|supabase|localStorage|ledger" -g '!node_modules' -g '!\.next'
Get-Content -LiteralPath 'tailwind.config.ts'
Get-Content -LiteralPath 'tsconfig.json'
Get-Content -LiteralPath '.env.example'
Get-Content -LiteralPath 'src\types\ledger.ts'
Get-Content -LiteralPath 'src\lib\dashboard-mock.ts'
git status --short
node --version
npm --version
npm pkg get scripts dependencies devDependencies
if (Test-Path -LiteralPath 'AI_USAGE.md') { 'AI_USAGE.md exists' } else { 'AI_USAGE.md missing' }
if (Test-Path -LiteralPath '.gitignore') { Get-Content -LiteralPath '.gitignore' } else { '.gitignore missing' }
Get-Content -LiteralPath 'package-lock.json' -TotalCount 20
Get-Content -LiteralPath 'src\app\globals.css'
Get-Content -LiteralPath 'src\components\layout\AppShell.tsx'
Get-Content -LiteralPath 'src\components\layout\Sidebar.tsx'
Get-Content -LiteralPath 'src\components\layout\Topbar.tsx'
Get-Content -LiteralPath 'src\components\StatCard.tsx'
Get-ChildItem -Recurse -File -Depth 2 | Where-Object { $_.FullName -notmatch '\\node_modules\\|\\.next\\|\\.git\\' } | Select-Object -First 200 -ExpandProperty FullName
```

Key findings:

- Package manager: npm, proven by `package-lock.json` lockfile version 3 and npm `11.9.0`.
- Runtime available: Node `v24.14.0`.
- Framework: existing Next.js App Router app, not Vite.
- Existing scripts: `npm run dev`, `npm run build`, `npm run start`.
- Current dependencies: `next`, `react`, `react-dom`, `lucide-react`.
- Current dev dependencies: TypeScript, Tailwind CSS, PostCSS, Autoprefixer, React/Node types.
- Source layout:
  - `src/app/layout.tsx`: root layout and current global CSS import.
  - `src/app/page.tsx`: landing/product entry page.
  - `src/app/login/page.tsx`: placeholder email login page.
  - `src/app/dashboard/page.tsx`: mock/fallback dashboard page.
  - `src/app/globals.css`: Tailwind directives plus app-level base styling.
  - `src/components/layout/*`: desktop app shell, sidebar, topbar.
  - `src/components/StatCard.tsx`: dashboard stat card.
  - `src/lib/dashboard-mock.ts`: mock dashboard data.
  - `src/types/ledger.ts`: simple display-only mock types.
- This is already an app repo named `couple-ledger`; it is not an `animal-island-ui` library clone.
- `animal-island-ui` is not currently installed and is not referenced in the workspace.
- `AI_USAGE.md` is not present in the workspace. After installing `animal-island-ui`, inspect the package docs or bundled `AI_USAGE.md` before using component props.
- `.env.example` exists with Supabase placeholders, but current Supabase docs now prefer `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for new projects.
- `.gitignore` is missing.
- `git status --short` reports all current files as untracked, including `.next/` and `node_modules/`. Do not commit generated folders.

External references checked:

- `animal-island-ui` GitHub README: confirms `npm install animal-island-ui` and the required `import 'animal-island-ui/style'`.
- Supabase SSR docs: confirm `@supabase/supabase-js` plus `@supabase/ssr` for cookie-based clients in Next.js.
- Supabase Next.js Auth docs: confirm App Router auth flow and publishable key naming for new projects.

## Chosen Architecture

Use the current Next.js app as the product repository.

Reasoning:

- The existing workspace strongly suggests an app repo: it has `src/app`, route files, app components, Tailwind config, `.env.example`, `README.md`, and a private `couple-ledger` package.
- Migrating to Vite now would delete or rewrite working project structure without adding security or product value.
- Vercel deploys Next.js directly, and Supabase's current Next.js guidance fits App Router with cookie-based auth.

Decision:

- Keep Next.js App Router.
- Add `animal-island-ui` into this app rather than copying its styles or editing a library source tree.
- Keep Tailwind because it already exists, but use Tailwind mainly for layout glue while using `animal-island-ui` components for the visible Animal-Island UI surface.
- Use Supabase Auth and Postgres RLS before replacing mock ledger data with real data.

Do not create `apps/couple-ledger` in this workspace, because this is already the app repo. A monorepo app folder would only be safer if the workspace turned out to be the `animal-island-ui` library repo, which it did not.

## Directory Plan

Recommended future structure inside the existing app:

```text
.
├── PROJECT_PLAN.md
├── .env.example
├── package.json
├── src
│   ├── app
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── login
│   │   │   └── page.tsx
│   │   ├── dashboard
│   │   │   └── page.tsx
│   │   ├── records
│   │   │   └── page.tsx
│   │   ├── records
│   │   │   └── new
│   │   │       └── page.tsx
│   │   ├── settlement
│   │   │   └── page.tsx
│   │   └── settings
│   │       └── page.tsx
│   ├── components
│   │   ├── layout
│   │   ├── ledger
│   │   └── ui
│   ├── lib
│   │   ├── supabase
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   └── auth.ts
│   │   ├── ledger
│   │   │   ├── calculations.ts
│   │   │   ├── filters.ts
│   │   │   └── validation.ts
│   │   └── formatters.ts
│   └── types
│       ├── database.ts
│       └── ledger.ts
└── supabase
    └── migrations
```

Notes:

- `src/app/layout.tsx` is the app entry for global style imports in this Next app. Import `animal-island-ui/style` exactly once there.
- `src/lib/dashboard-mock.ts` should remain until real Supabase reads are implemented and verified, then be removed in the same change that replaces it.
- `src/types/database.ts` should be generated or maintained from the Supabase schema after the schema exists.
- `supabase/migrations` should be added only when schema work begins.

## Dependency Plan

Current package manager: npm.

Future runtime dependencies:

```bash
npm install animal-island-ui @supabase/supabase-js @supabase/ssr
```

Future test/dev dependencies, added only when testable domain logic begins:

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

Rules:

- Do not hand-copy or reimplement `animal-island-ui` styles.
- Do not import `animal-island-ui/style` more than once.
- Do not invent component props. Inspect the installed package exports and `AI_USAGE.md` before using components.
- Do not add another styling framework. Tailwind is already present and can stay.
- Do not use `localStorage` as the final cloud data source.

## Environment Variables Plan

Current `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Recommended future `.env.example` for new Supabase projects:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Operational rules:

- Keep real values in `.env.local` locally and Vercel environment settings in production.
- Never commit `.env`, `.env.local`, `.env.production`, or any file containing real keys.
- Never expose a Supabase secret key or service role key to browser code.
- Do not rely on frontend email checks for privacy. Allowed-user rules must exist in Supabase Auth configuration and database/RLS design.
- If using a legacy Supabase project that only exposes an anon key, choose one variable name before implementing clients and document the choice in `.env.example`.

## Supabase Data Model Draft

Use the suggested model with one security addition: an allowlist table for the two permitted emails.

```sql
allowed_user_emails (
  email text primary key,
  intended_display_name text,
  created_at timestamptz not null default now()
)

profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_key text,
  created_at timestamptz not null default now()
)

households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
)

household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'partner')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
)

categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  icon text,
  color text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
)

ledger_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  entry_type text not null check (entry_type in ('expense', 'income')),
  category_id uuid references categories(id) on delete set null,
  paid_by uuid not null references auth.users(id),
  split_mode text not null check (split_mode in ('equal', 'custom', 'personal')),
  occurred_on date not null,
  note text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)

ledger_entry_splits (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references ledger_entries(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  share_amount numeric(12,2) not null check (share_amount >= 0)
)
```

Data rules:

- `allowed_user_emails` contains exactly the two approved email addresses.
- The first household can be seeded manually after both Auth users exist.
- App UI should not expose public registration or member invitation.
- `ledger_entry_splits` must sum to `ledger_entries.amount` for shared expenses. Enforce this in application validation first; add a database trigger when the insert/update path is stable.
- `paid_by`, `created_by`, and split `user_id` must belong to the same household as the entry. Enforce in server-side validation and RLS helper checks.

## RLS And Security Plan

Security target:

- Anonymous visitors can view only the public landing/login screens.
- Authenticated users who are not in `allowed_user_emails` cannot see or mutate ledger data.
- The two allowed users can see only their shared household data.
- Frontend route guards improve UX, but database RLS is the real data boundary.

Database helper functions:

```sql
is_allowed_user() -> boolean
  returns true when lower(auth.jwt() ->> 'email') exists in allowed_user_emails

is_household_member(target_household_id uuid) -> boolean
  returns true when household_members contains (target_household_id, auth.uid())
```

RLS policy outline:

- Enable RLS on every public table listed above.
- `allowed_user_emails`: no client read/write policy. Manage manually in Supabase SQL editor or admin tooling.
- `profiles`:
  - Insert own row only when `id = auth.uid()` and `is_allowed_user()`.
  - Select own profile and profiles of members in the same household.
  - Update own `display_name` and `avatar_key` only.
- `households`:
  - Select only when `is_household_member(id)`.
  - Insert only for an allowed user during controlled setup.
  - Update only by a member with role `owner`.
- `household_members`:
  - Select only rows in households where the caller is a member.
  - Insert/update/delete only through controlled setup or an owner-only RPC, not through open client writes.
- `categories`:
  - Select/insert/update/delete only when `is_household_member(household_id)`.
- `ledger_entries`:
  - Select/insert/update/delete only when `is_household_member(household_id)`.
  - Check `paid_by` and `created_by` are household members.
- `ledger_entry_splits`:
  - Select/insert/update/delete only when the parent entry belongs to a household where `is_household_member(household_id)` is true.
  - Check `user_id` is a member of the parent entry household.

Auth flow:

- No public registration route in the app.
- Supabase Auth users should be created or invited manually for the two approved emails.
- Login page may use email OTP or magic link, but the callback must verify `is_allowed_user()` through the database before showing private pages.
- Server-side route protection should use Supabase SSR clients and token validation, not only a client-side redirect.

## UI Page Map

- `/`: Warm public entry page with app name, couple ledger positioning, and login entry. It must not reveal ledger data.
- `/login`: Email login page only. No sign-up CTA, no public registration language.
- `/dashboard`: Private dashboard with this month's expense, income, balance, who paid more, recent records, and settlement hint.
- `/records/new`: Private add-record flow with amount, type, category, paid by, date, note, and split mode.
- `/records`: Private record list with month, category, payer, and keyword filters.
- `/settlement`: Private couple settlement page showing who should transfer how much.
- `/settings`: Private settings page for display names, couple name, and category list.

UI rules:

- Use `animal-island-ui` components for the visible cute/warm interface once installed.
- Keep layout dense enough for daily accounting. Avoid making the app a marketing landing page after login.
- Use icons for navigation and tool actions where available.
- Keep monetary values readable on desktop and mobile.
- Do not expose mock data as if it were real data.

## Step-By-Step Implementation Sequence

### Step 1: Repository Safety Baseline

Focused change:

- Add `.gitignore` before any feature work so `.env*`, `.next/`, `node_modules/`, logs, and build artifacts are not committed.
- Keep `.env.example` tracked.

Verification:

```powershell
git status --short
```

Expected result:

- `.next/` and `node_modules/` are no longer listed as commit candidates.
- App source files remain visible as untracked or modified until intentionally staged.

### Step 2: UI And Supabase Dependencies

Focused change:

- Install only the required app dependencies:

```bash
npm install animal-island-ui @supabase/supabase-js @supabase/ssr
```

Verification:

```powershell
npm ls animal-island-ui @supabase/supabase-js @supabase/ssr --depth=0
npm run build
```

Expected result:

- The three packages are installed at the app root.
- `npm run build` succeeds before any UI conversion begins.

### Step 3: Animal UI Style Entry

Focused change:

- Inspect the installed `animal-island-ui` package docs and `AI_USAGE.md` if present.
- Add `import "animal-island-ui/style";` exactly once in `src/app/layout.tsx`.
- Keep `import "./globals.css";` in the same root layout.
- Do not convert pages yet.

Verification:

```powershell
rg -n "animal-island-ui/style" src package.json
npm run build
```

Expected result:

- Exactly one source import of `animal-island-ui/style`.
- Build succeeds.

### Step 4: Supabase Client Utilities

Focused change:

- Update `.env.example` to use the selected public key variable name.
- Add Supabase SSR client utilities under `src/lib/supabase`.
- Add server-side auth helpers that can read the current user and require a user for private pages.
- Do not query ledger tables yet.

Verification:

```powershell
rg -n "SUPABASE|createBrowserClient|createServerClient|getClaims|getUser" src .env.example
npm run build
```

Expected result:

- Supabase utilities compile.
- No secret keys appear in source files.

### Step 5: Database Schema And RLS

Focused change:

- Add the initial Supabase migration for `allowed_user_emails`, `profiles`, `households`, `household_members`, `categories`, `ledger_entries`, and `ledger_entry_splits`.
- Enable RLS on all public tables.
- Add helper functions and policies described in this plan.
- Seed only the two approved emails and the initial household after the human provides both email addresses or Auth user IDs.

Verification:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

Expected result:

- All app tables report `rowsecurity = true`.

Manual security checks:

```sql
select * from allowed_user_emails;
select * from household_members;
```

Expected result:

- Only the two approved emails exist in `allowed_user_emails`.
- Only the two approved users are members of the private household.

### Step 6: Private Auth Flow

Focused change:

- Replace the login placeholder with a real Supabase email login flow.
- Add logout.
- Protect `/dashboard`, `/records`, `/records/new`, `/settlement`, and `/settings` on the server side.
- Keep `/` and `/login` public.

Verification:

```powershell
npm run build
npm run dev
```

Manual browser checks:

- Logged-out visit to `/dashboard` redirects to `/login`.
- Approved user can log in and reach `/dashboard`.
- Unknown email cannot view private data even if a Supabase Auth user exists.

### Step 7: Dashboard From Supabase

Focused change:

- Replace `src/lib/dashboard-mock.ts` usage with Supabase reads scoped to the current user's household.
- Show this month's total expense, income, balance, who paid more, and recent records.
- Keep empty states warm and useful when no records exist.

Verification:

```powershell
npm run build
```

Manual browser checks:

- With no entries, dashboard shows empty state and zero totals.
- With seeded entries, totals match the database rows for the selected month.

### Step 8: Add Record

Focused change:

- Implement `/records/new` for amount, type, category, paid by, date, note, and split mode.
- Validate amount, date, payer, category, split mode, and split totals before insert.
- Insert `ledger_entries` and `ledger_entry_splits` in one server action or route handler.

Verification:

```powershell
npm run build
```

Manual browser checks:

- Equal split creates two split rows whose shares sum to amount.
- Personal split creates a single responsible share or two shares matching the selected rule.
- Custom split rejects totals that do not match the entry amount.

### Step 9: Record List And Filters

Focused change:

- Implement `/records` with filters for month, category, payer, and keyword.
- Keep filters in URL search params so refresh/share keeps the current view.
- Scope all reads to the current user's household.

Verification:

```powershell
npm run build
```

Manual browser checks:

- Month filter returns only records in that calendar month.
- Keyword filter searches note and category display name.
- Payer filter returns only entries paid by the selected household member.

### Step 10: Settlement Calculation

Focused change:

- Add pure settlement calculation in `src/lib/ledger/calculations.ts`.
- Add tests for common cases before wiring UI:
  - both paid equal amounts,
  - one person paid all shared expenses,
  - income entries do not incorrectly increase shared expense debt,
  - personal expenses do not create settlement debt.
- Implement `/settlement` from the tested calculation.

Verification:

```powershell
npm run test
npm run build
```

Expected result:

- Settlement tests pass.
- Build succeeds.

### Step 11: Settings

Focused change:

- Implement `/settings` for display names, couple name, and categories.
- Keep membership management out of the UI.
- Allow category add/edit/reorder only for current household members.

Verification:

```powershell
npm run build
```

Manual browser checks:

- Updating display name changes profile display but not Auth identity.
- Updating couple name changes only the current household.
- Category edits are visible in add-record and filters.

### Step 12: Vercel Deployment

Focused change:

- Configure Vercel project environment variables.
- Set Supabase Auth redirect URLs for local and production domains.
- Deploy after build and auth checks pass locally.

Verification:

```powershell
npm run build
```

Production checks:

- Public `/` and `/login` load.
- Private pages require login.
- Approved user can create and view records.
- Unknown user cannot read rows through the UI or direct Supabase client calls.

## Risks, Questions, And Human Decisions

- The current project is Next.js, while the initial target stack mentioned Vite. Recommendation: keep Next.js. Human decision needed only if Vite is still mandatory.
- `.gitignore` is missing and generated folders are untracked. Add `.gitignore` before staging or committing.
- `animal-island-ui` README includes style import and AI usage docs. The implementation must inspect the actual installed package before choosing component props.
- The `animal-island-ui` README includes non-commercial/project disclaimer language in addition to MIT license text. Private personal use appears aligned with the stated product, but commercial/public use should be reviewed separately.
- Supabase project details are not in the repo. Human needs to provide or configure the project URL, publishable key, and the two approved emails.
- The current `.env.example` uses `NEXT_PUBLIC_SUPABASE_ANON_KEY`; current Supabase docs prefer `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for new projects. Pick one before writing client utilities.
- Auth sign-up must not be open to arbitrary people. Use manual invited users plus database allowlist/RLS. Frontend hiding alone is not enough.
- Currency, category defaults, and split-mode semantics need product choices before polishing the add-record form. A safe default is CNY, common daily categories, equal/custom/personal split modes.
- Existing files contain Chinese UI copy. Some PowerShell reads displayed mojibake in terminal output, so use an editor or UTF-8-aware read before treating source text as corrupted.

## Next Single Task

Add `.gitignore` as the next single task. This protects `.env*`, `.next/`, and `node_modules/` before dependency, auth, or deployment work begins.
