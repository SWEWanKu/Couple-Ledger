# Private App Release Regression Checklist

This is the final manual/Codex regression checklist for the private 小岛账本
app. It ties together local smoke, dashboard, records, settlement, monthly
reports, record mutation flows, and the private island trail navigation.

This document does not replace the more detailed module-specific regression
docs:

- `LOCAL_SMOKE_GUIDE.md`
- `SETTLEMENT_V1_REGRESSION.md`
- `SETTLEMENT_V2_REGRESSION.md`
- `RECORD_MUTATION_V1_REGRESSION.md`
- `RECORD_MUTATION_PLAN.md`
- `SETTLEMENT_V2_CHANGE_PLAN.md`

Use those documents when a specific module needs deeper verification. Use this
file as the final private-app release pass.

## Environment Assumptions

- Project path: `E:\Couple Ledger`.
- Main branch: `master`.
- Supabase project: `xveqdtvfgnmungycmwjq`.
- `.env.local` is git ignored.
- `SUPABASE_DB_URL` may remain in ignored `.env.local` by user preference.
- Do not print `SUPABASE_DB_URL`.
- Do not commit `.env.local`.
- `package.json` currently only has these scripts:
  - `dev`
  - `build`
  - `start`
- Dev Login is needed for authenticated browser smoke.
- Use `LOCAL_SMOKE_GUIDE.md` for Windows/Next stale process handling.

## Preflight Checklist

- [ ] Start from `E:\Couple Ledger`.
- [ ] Confirm the worktree is clean:

  ```powershell
  git status --short --branch
  ```

- [ ] Update from remote without creating a merge commit:

  ```powershell
  git pull --ff-only origin master
  ```

- [ ] Run the production build:

  ```powershell
  npm run build
  ```

- [ ] Clear stale Next.js project processes, or use a confirmed clean port.
- [ ] Use production HTTP route smoke before Playwright when useful.
- [ ] Use a dev server for Dev Login smoke.
- [ ] After smoke, confirm no stale project process remains on ports
      `3000`, `3006`, `3010`, `3014`, `3015`, or `3016`.

## Auth And Privacy Checklist

- [ ] Anonymous `/dashboard` redirects or is protected.
- [ ] Anonymous `/records` redirects or is protected.
- [ ] Anonymous `/records/new` redirects or is protected.
- [ ] Anonymous `/settlement` redirects or is protected.
- [ ] Anonymous `/settlement/history` redirects or is protected.
- [ ] Anonymous `/reports/monthly?month=2026-06` redirects or is protected.
- [ ] Primary `/dev-login` reaches the private app when configured.
- [ ] Partner `/dev-login?persona=partner` works when configured.
- [ ] Missing partner Dev Login config fails safely without printing secrets.
- [ ] `/not-invited` remains a safe private blocked state.

## Dashboard Checklist

- [ ] `/dashboard` renders after authenticated Dev Login.
- [ ] `PrivateIslandTrail` renders.
- [ ] Monthly summary renders.
- [ ] The monthly report link works.
- [ ] Recent activity renders non-voided records.
- [ ] Recent activity record links open record details.
- [ ] Settlement teaser renders the fully confirmed state for `2026-06`.
- [ ] Dashboard has no new write buttons.

## Records List Checklist

- [ ] `/records?month=2026-06` renders.
- [ ] `PrivateIslandTrail` renders.
- [ ] Month navigation works:
  - previous month
  - current month
  - next month
  - manual month input
- [ ] Records are grouped by date.
- [ ] Daily totals render for expense, income, net, and count.
- [ ] Type filter works.
- [ ] Category filter works.
- [ ] Member filter works.
- [ ] Keyword `q` filter works.
- [ ] Clear filters works.
- [ ] Monthly summary renders.
- [ ] Summary stickers link to filtered records.
- [ ] Settlement awareness renders.
- [ ] Monthly report link works.
- [ ] Voided records are excluded from the normal list.
- [ ] Filtered empty state uses `NotebookEmptyState` and 小岛手账-style copy.

## New Record Checklist

- [ ] `/records/new?month=2026-06` renders.
- [ ] `PrivateIslandTrail` renders.
- [ ] Default date uses the selected month.
- [ ] Return link preserves safe records context:
  - `month`
  - `type`
  - `category`
  - `member`
  - `q`
- [ ] Passive settlement reminder appears for a settled month.
- [ ] Create flow still uses the existing semantics and `createRecord` helper.
- [ ] `created=1` success sticker appears after a successful create.
- [ ] No `localStorage` or `sessionStorage` is used as a data source.

## Record Detail Checklist

- [ ] Valid record detail renders.
- [ ] `PrivateIslandTrail` renders.
- [ ] Return link preserves safe filter context.
- [ ] Previous/next navigation works within the selected list context.
- [ ] Monthly report and records links keep safe month context.
- [ ] Edit entry appears when the record is editable.
- [ ] Soft void area appears.
- [ ] Settled month warning appears when applicable.
- [ ] Nonexistent or bad record shows a safe not-found/unavailable state.
- [ ] Voided record does not render as an ordinary detail.

## Record Edit Checklist

- [ ] `/records/[id]/edit` is protected.
- [ ] `PrivateIslandTrail` renders.
- [ ] The form pre-fills current record values.
- [ ] Settled month warning appears when applicable.
- [ ] Edit uses the `update_ledger_record_v1` RPC path.
- [ ] Updated record sets `updated_at`.
- [ ] Updated record sets `updated_by`.
- [ ] Split rows remain consistent with the edited amount and split mode.
- [ ] A month with `pending_replacement` blocks edit.
- [ ] Custom split edit is not present in V1.
- [ ] Restore is not present in V1.
- [ ] Hard delete is not present in V1.

## Soft Void Checklist

- [ ] The `作废这笔账` flow works through the existing soft-void path.
- [ ] `voided_at` is set.
- [ ] `voided_by` is set.
- [ ] `updated_at` is set.
- [ ] `updated_by` is set.
- [ ] `ledger_entries` is not hard-deleted.
- [ ] `ledger_entry_splits` remain attached.
- [ ] The voided record disappears from normal records list.
- [ ] The voided record disappears from monthly summary.
- [ ] The voided record disappears from live settlement.
- [ ] A month with `pending_replacement` blocks void.
- [ ] Stored settlement snapshots are not mutated.

## Settlement V1 Checklist

- [ ] `/settlement?month=2026-06` renders.
- [ ] `PrivateIslandTrail` renders.
- [ ] Live calculation renders.
- [ ] Active snapshot renders.
- [ ] `2026-06` shows `fully_confirmed / 2/2`.
- [ ] No extra confirmation button appears after `2/2`.
- [ ] False outdated warning does not appear for unchanged `2026-06`.
- [ ] Duplicate propose returns `already_exists`.
- [ ] Duplicate confirm returns `already_confirmed`.

## Settlement V2 Checklist

- [ ] `active` lifecycle labels remain supported.
- [ ] `pending_replacement` lifecycle labels remain supported.
- [ ] `superseded` lifecycle labels remain supported.
- [ ] Replacement proposal UI appears only when the active snapshot is genuinely outdated.
- [ ] No replacement proposal UI appears for unchanged `2026-06`.
- [ ] Pending replacement, if present, is shown separately from active snapshot.
- [ ] Replacement confirmation uses the existing RPC/helper path.
- [ ] No payment or real transfer behavior appears.
- [ ] Snapshot amount fields are not mutated.

## Settlement History And Detail Checklist

- [ ] `/settlement/history` renders.
- [ ] `PrivateIslandTrail` renders.
- [ ] `2026-06` appears when the dev/private database contains the known snapshot.
- [ ] Snapshot detail opens from history.
- [ ] Snapshot detail is read-only.
- [ ] Immutable stored values are shown.
- [ ] `active` labels render when applicable.
- [ ] `superseded` labels render when applicable.
- [ ] `pending_replacement` labels render when applicable.
- [ ] Bad snapshot id shows a safe unavailable state.

## Monthly Report Checklist

- [ ] `/reports/monthly?month=2026-06` renders.
- [ ] `PrivateIslandTrail` renders.
- [ ] Month navigation works:
  - previous
  - current
  - next
- [ ] Expense total renders.
- [ ] Income total renders.
- [ ] Net total renders.
- [ ] Record count renders.
- [ ] Category stickers render.
- [ ] Member/payer summary renders.
- [ ] Recent records render.
- [ ] Settlement status renders.
- [ ] Links to records work.
- [ ] Links to settlement work.
- [ ] No writes are available from the monthly report page.

## Visual Consistency Checklist

- [ ] `PrivateIslandTrail` appears on all key private pages:
  - `/dashboard`
  - `/records`
  - `/records/new`
  - `/records/[id]`
  - `/records/[id]/edit`
  - `/settlement`
  - `/settlement/history`
  - `/settlement/history/[snapshotId]`
  - `/reports/monthly`
- [ ] `NotebookEmptyState` appears for empty, not-found, or unavailable states.
- [ ] UI stays 小岛手账 / 贴纸 / 便签 / 羊皮纸.
- [ ] No SaaS, admin, or back-office visual regression.
- [ ] Mobile layout remains usable.
- [ ] `animal-island-ui` props are documented/existing only.
- [ ] `animal-island-ui/style` remains imported only through the app entry path.

## Security And Safety Checklist

- [ ] No service role in app code.
- [ ] No Supabase admin API in app code.
- [ ] No RLS bypass.
- [ ] No `localStorage` or `sessionStorage` as a data source.
- [ ] No `.env.local` commit.
- [ ] No `SUPABASE_DB_URL` printing.
- [ ] No invented generated DB types.
- [ ] No hard delete user flow.
- [ ] No DELETE policy on `ledger_entries` for the V1 app flow.
- [ ] No mutation of settlement snapshot amounts or snapshot JSON.
- [ ] No payment provider behavior.
- [ ] No real transfer behavior.

## Static Repository Checklist

- [ ] `npm run build` passes.
- [ ] `git diff --check` passes.
- [ ] `git diff --cached --check` passes before committing.
- [ ] No unintended diff in `src/lib/supabase/**`.
- [ ] No unintended diff in `supabase/migrations/**`.
- [ ] No unintended diff in `package.json`.
- [ ] No unintended diff in `package-lock.json`.
- [ ] No `.env.local` diff is staged or committed.
- [ ] No generated type files are added.
- [ ] No unexpected `insert`, `update`, `delete`, or `upsert` paths beyond known helpers:
  - create record
  - edit record RPC helper
  - soft void helper
  - settlement create helper
  - settlement confirm helper
  - settlement replacement helpers

Useful static commands:

```powershell
npm run build
git diff --name-only
git diff --check
git diff --cached --check
git status --short -- .env.local package.json package-lock.json supabase src
git check-ignore -v .env.local
```

For future code changes, inspect changed app files in context before treating
keyword matches as failures. Existing mutation helpers are allowed only in their
known scoped flows.

## Safe Write Smoke Guidance

- [ ] Use far-future test months such as `2099-10`.
- [ ] Prefer creating temporary records through the normal UI.
- [ ] Edit the temporary record through `/records/[id]/edit`.
- [ ] Soft-void the same temporary record afterward.
- [ ] Do not cleanup-delete temporary records.
- [ ] Do not edit or void important real `2026-06` data.
- [ ] Do not create fake settlement rows unless using rollback transaction smoke
      as documented in the settlement regression docs.
- [ ] Do not run SQL for a release checklist pass unless a separate task
      explicitly asks for that verification.

## Known Limitations

- No formal test script exists yet.
- No Playwright dependency or script is committed.
- Browser smoke is manual/Codex-run using `LOCAL_SMOKE_GUIDE.md`.
- Custom split edit is deferred.
- Restore voided record is deferred.
- Voided history/audit view is deferred.
- Real replacement UI full flow waits for a genuine outdated month or an
  approved safe data path.
- Generated Supabase Database types are not used in this project.

## When To Update This File

- A new private page is added.
- Record mutation behavior changes.
- Settlement V2 replacement behavior changes.
- A new smoke/test runner is introduced.
- Schema/RLS changes affect records or settlement.
- `package.json` gains dedicated `lint`, `typecheck`, or `test` scripts.
