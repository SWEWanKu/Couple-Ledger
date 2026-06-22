# Settlement V1 Regression Checklist

This checklist hardens the completed Settlement V1 flow without adding product
behavior. It is for local/manual release checks against the dev/private project.

## Scope

- Verify the existing Settlement V1 read/write confirmation flow still behaves as
  designed.
- Keep all checks read-only except when a separate task explicitly asks to create
  or confirm a settlement.
- Do not change runtime behavior, schema, RLS, auth, settlement math, records
  creation, or UI features while running this checklist.

## Preconditions

- Start the app locally with `npm run dev`.
- Verify production build with `npm run build`.
- The dev/private database is expected to already have a `2026-06` settlement
  snapshot in `fully_confirmed / 2/2` state.
- If the database state differs, adjust the expected assertions or skip the
  snapshot-specific checks for that run.
- Dev Login environment variable names used by this app:
  - `DEV_LOGIN_EMAIL`
  - `DEV_LOGIN_PASSWORD`
  - `DEV_LOGIN_PARTNER_EMAIL`
  - `DEV_LOGIN_PARTNER_PASSWORD`

## Tooling Decision

At this checkpoint the repository has no committed browser smoke convention:

- `package.json` only defines `dev`, `build`, and `start`.
- There is no Playwright/Vitest/Jest/Cypress config or test directory.
- A `package-lock.json` reference alone is not treated as an existing smoke
  framework.

For that reason, do not add a smoke runner or install a new test framework for
this checklist. Keep the task documentation-only unless a future task first
establishes a clean repo-owned test convention.

## Do Not Do This In Smoke

- Do not create fake users.
- Do not create fake household members.
- Do not create fake settlement rows.
- Do not run cleanup deletes.
- Do not execute SQL.
- Do not use service role credentials.
- Do not use Supabase admin APIs.
- Do not bypass RLS.
- Do not print environment variable values.

## Route Set

Check these routes during a Settlement V1 regression pass:

- `/dashboard`
- `/settlement?month=2026-06`
- `/settlement/history`
- `/settlement/history/<snapshotId>`
- `/records?month=2026-06`
- `/records/new?month=2026-06`
- `/records/<recordId>`

## Manual Checklist

### Auth and Privacy

- [ ] Anonymous `/settlement` redirects to `/login`.
- [ ] Anonymous `/settlement/history` redirects to `/login`.
- [ ] Anonymous `/settlement/history/<snapshotId>` redirects to `/login`.
- [ ] Anonymous records pages remain protected.

### Dev Login

- [ ] Primary `/dev-login` signs in when primary env is configured.
- [ ] Partner `/dev-login?persona=partner` signs in when partner env is
      configured.
- [ ] Missing partner config redirects safely back to the login page with a
      non-secret hint.

### Current Settlement Page

- [ ] `/settlement?month=2026-06` renders the live monthly calculation.
- [ ] The page shows `fully_confirmed / 2/2` for the saved snapshot.
- [ ] No extra confirmation button appears after `2/2`.
- [ ] No false outdated snapshot warning appears when the snapshot matches the
      unchanged month data.
- [ ] A link to the saved snapshot detail page exists.

### Settlement History

- [ ] `/settlement/history` renders for an authenticated household member.
- [ ] The `2026-06` settlement appears.
- [ ] The history row/card shows `fully_confirmed / 2/2`.
- [ ] A link to the snapshot detail page exists.

### Snapshot Detail

- [ ] `/settlement/history/<snapshotId>` renders the immutable stored snapshot.
- [ ] It shows total expense.
- [ ] It shows expense count.
- [ ] It shows each member's paid, share, and net amounts.
- [ ] It shows transfer suggestions or the balanced-state message.
- [ ] It shows confirmation stamps/progress.
- [ ] It has no forms, write buttons, payment buttons, transfer buttons, or
      edit/delete controls.

### Dashboard

- [ ] `/dashboard` shows the settlement teaser.
- [ ] The teaser shows the fully confirmed state for the relevant settled month.
- [ ] The teaser links to the current settlement page.
- [ ] The teaser links to settlement history.

### Records Awareness

- [ ] `/records?month=2026-06` shows the settled-month reminder.
- [ ] `/records/<recordId>` for a `2026-06` record shows the reminder.
- [ ] `/records/new?month=2026-06` shows only a passive reminder.
- [ ] Reminders link to `/settlement?month=2026-06`.
- [ ] Reminders link to the snapshot detail page when a snapshot is available.
- [ ] Record creation is not blocked or changed by the reminder.

## Static Safety Checks

Run these before merging Settlement V1 regression-only work:

```powershell
npm run build
git diff --check
git diff --name-only -- supabase src/app/api src/app/settlement/actions.ts src/lib/settlement/create-settlement-snapshot.ts src/lib/settlement/confirm-settlement-snapshot.ts src/lib/supabase src/lib/settlement/calculate-settlement.ts src/lib/settlement/get-settlement-summary.ts src/lib/ledger/create-record.ts package.json package-lock.json .env.local
git status --short -- .env.local package.json package-lock.json supabase
```

Expected result for a documentation-only checklist change:

- No migration added or edited.
- No SQL file added or edited.
- No RLS change.
- No API route added.
- No server action added.
- No write helper added.
- No service role usage.
- No Supabase admin API usage.
- No RLS bypass.
- No `localStorage` data source.
- No `.env.local` commit.
- No generated Supabase Database types.
- No `calculateSettlement` amount-rule change.
- No `getSettlementSummary` read-semantics change.
- No settlement write-helper semantic change.
- No payment provider behavior.
- No actual money transfer behavior.
- No settlement delete/edit/void/supersede behavior.
- No records write behavior change.

For code changes in future tasks, review the changed files directly for
unexpected `.update(`, `.delete(`, `.upsert(`, service role, admin auth,
`localStorage`, SQL, migration, and API route additions.
