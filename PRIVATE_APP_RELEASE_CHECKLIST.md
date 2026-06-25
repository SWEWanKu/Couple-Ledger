# Private App Release Regression Checklist

This is the final manual/Codex regression checklist for the private 小岛账本
app. It ties together local smoke, dashboard, records, settlement, monthly
reports, Import Review / `共同对账模式`, record mutation flows, and the private
island trail navigation.

This document does not replace the more detailed module-specific regression
docs:

- `LOCAL_SMOKE_GUIDE.md`
- `SETTLEMENT_V1_REGRESSION.md`
- `SETTLEMENT_V2_REGRESSION.md`
- `RECORD_MUTATION_V1_REGRESSION.md`
- `RECORD_MUTATION_PLAN.md`
- `SETTLEMENT_V2_CHANGE_PLAN.md`
- `IMPORT_REVIEW_V1_REGRESSION.md`

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
- [ ] Anonymous `/imports` redirects to `/login`.
- [ ] Anonymous `/imports/new` redirects to `/login`.
- [ ] Anonymous `/imports/[batchId]/review` redirects to `/login`.
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
- [ ] The `共同对账模式` entry appears.
- [ ] If unfinished import batches exist, the dashboard `继续对账` entry appears.
- [ ] The dashboard `继续对账` link opens
      `/imports/[batchId]/review?status=pending` when pending items exist.
- [ ] If no pending items remain but need-discussion items exist, the dashboard
      `继续对账` link opens a safe `status=need_discussion` queue.
- [ ] The dashboard import review entry links to `/imports`.
- [ ] The dashboard import review entry links to `/imports/new`.
- [ ] Viewing or clicking dashboard import review links does not write import,
      ledger, or settlement data.
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
- [ ] The records import review entry appears.
- [ ] The records import review entry links to `/imports`.
- [ ] The records import review entry links to `/imports/new`.
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
- [ ] The monthly report import review entry appears.
- [ ] The monthly report import review entry links to `/imports`.
- [ ] The monthly report import review entry links to `/imports/new`.
- [ ] No writes are available from the monthly report page.

## Import Review / 共同对账模式 Checklist

- [ ] `/imports` is protected and renders after authenticated Dev Login.
- [ ] `/imports/new` is protected and renders after authenticated Dev Login.
- [ ] `/imports/[batchId]/review` is protected and renders for an existing
      import batch.
- [ ] Dashboard, records list, and monthly report entry points appear.
- [ ] Dashboard, records list, and monthly report entry points link correctly to
      `/imports` and `/imports/new`.
- [ ] If unfinished import batches exist, the dashboard entry shows
      `继续对账`.
- [ ] If unfinished import batches exist, `/imports` shows a top `继续对账`
      section.
- [ ] Continue links open `/imports/[batchId]/review?status=pending` when
      pending items exist.
- [ ] Continue links open a safe
      `/imports/[batchId]/review?status=need_discussion` queue if no pending
      items remain but need-discussion items exist.
- [ ] Viewing or clicking continue links does not write import, ledger, or
      settlement data.
- [ ] Parser verification passes for WeChat `.xlsx`, Alipay UTF-8 `.csv`, and
      Alipay GBK/GB18030-compatible `.csv` fixtures:

  ```powershell
  npx --yes tsx scripts/verify-import-review-parsers.ts
  ```

- [ ] Parser verification reports only aggregate fixture results and does not
      print real transaction details.
- [ ] Upload sends parsed rows to the pending review pool.
- [ ] Upload/parse does not create official `ledger_entries`.
- [ ] `/imports` batch list shows progress counts and completion state.
- [ ] `/imports/[batchId]/review` shows one source transaction card at a time.
- [ ] Existing review actions and filters still work after landing from a
      continue link.
- [ ] Status filters work:
  - `pending`
  - `imported`
  - `skipped`
  - `need_discussion`
  - `all`
- [ ] Suggestion filter chip row appears on `/imports/[batchId]/review`.
- [ ] `suggestion=skip` filter works.
- [ ] `suggestion=need_discussion` filter works.
- [ ] `suggestion=review` filter works.
- [ ] Suggestion filters combine with status filters.
- [ ] `direction=expense` filter works.
- [ ] `direction=income` filter works when data exists.
- [ ] `direction=refund` filter works when data exists.
- [ ] `direction=transfer` filter works when data exists.
- [ ] `direction=unknown` empty or populated state is friendly.
- [ ] Direction filters combine with status and suggestion filters.
- [ ] Previous/next links stay within the active suggestion queue.
- [ ] Previous/next links stay within the active direction queue.
- [ ] `J` opens the next item and `K` opens the previous item when links are
      available.
- [ ] `J` / `K` stay within the active suggestion queue when a suggestion filter
      is selected.
- [ ] `J` / `K` stay within the active direction queue when a direction filter
      is selected.
- [ ] Transfer/refund/unknown explanation copy renders when those rows are
      available.
- [ ] `4` submits only the existing skip form when available.
- [ ] `5` submits only the existing need-discussion form when available.
- [ ] `1` focuses or highlights the common-expense confirmation area when
      available.
- [ ] `Enter` submits confirm-to-ledger only when the existing confirm form is
      valid and available.
- [ ] `Esc` blurs the active editable field where applicable.
- [ ] Shortcuts do not fire while typing in an input, textarea, select, or
      contenteditable element.
- [ ] `skipped` action creates no `ledger_entries` row.
- [ ] `skipped` action creates no `ledger_entry_splits` rows.
- [ ] `need_discussion` action creates no `ledger_entries` row.
- [ ] `need_discussion` action creates no `ledger_entry_splits` rows.
- [ ] Suggested `skip` quick apply works.
- [ ] Suggested `need_discussion` quick apply works.
- [ ] Suggested quick apply creates no `ledger_entries` row.
- [ ] Suggested quick apply creates no `ledger_entry_splits` rows.
- [ ] Quick-applied items can reopen to `pending`.
- [ ] Empty suggestion queues show a friendly notebook empty state.
- [ ] Empty direction queues show a friendly notebook empty state.
- [ ] Manual status, personal, and common-expense controls still work.
- [ ] Quick-apply and manual controls still work inside filtered direction
      queues.
- [ ] Keyboard shortcuts still work after suggested quick-apply polish.
- [ ] `我的个人` personal skip works for an eligible non-imported item.
- [ ] `她的个人` / `对方个人` personal skip works for an eligible non-imported
      item when the other household member is available.
- [ ] Personal skip stores `final_owner_user_id`.
- [ ] Personal skip stores `final_split_type = 'personal'`.
- [ ] Personal skip creates no `ledger_entries` row.
- [ ] Personal skip creates no `ledger_entry_splits` rows.
- [ ] Personal skipped item can reopen to `pending`.
- [ ] Imported items cannot be personal-skipped.
- [ ] `skipped -> pending` reopen works.
- [ ] `need_discussion -> pending` reopen works.
- [ ] Imported items cannot be reopened.
- [ ] Reopen actions do not create, update, unlink, or delete ledger records.
- [ ] Reopen actions do not mutate settlement data.
- [ ] Common expense confirm creates exactly one official `ledger_entries` row.
- [ ] Common expense confirm creates equal-split `ledger_entry_splits` rows.
- [ ] Imported item links to its official ledger record.
- [ ] Ledger record detail shows the `来自共同对账导入` source card.
- [ ] The ledger record import source card links back to the related review
      item.
- [ ] Completed batch state is clear.
- [ ] Pending-empty state is clear and offers useful next-step links.
- [ ] Review UI remains a scrapbook / island notebook flow, not an admin table.

## Visual Consistency Checklist

- [ ] `PrivateIslandTrail` appears on all key private pages:
  - `/dashboard`
  - `/records`
  - `/records/new`
  - `/records/[id]`
  - `/records/[id]/edit`
  - `/imports`
  - `/imports/new`
  - `/imports/[batchId]/review`
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
- [ ] Import Review confirm-to-ledger does not mutate settlement snapshots.
- [ ] Import Review confirm-to-ledger does not mutate settlement confirmations.
- [ ] No real bill files are committed.
- [ ] Import Review does not dump `raw_json` into the UI.
- [ ] Parser validation does not print transaction details, merchants, notes,
      transaction ids, or real file names.
- [ ] Import tables have no DELETE policy.
- [ ] Upload does not store original bill files long-term.
- [ ] Import Review has no one-click batch confirm-all behavior.
- [ ] Import Review has no AI final decision.
- [ ] Import Review has no voice recognition.
- [ ] Import Review continue-entry overview is SELECT/read-only derived UI.
- [ ] Import Review continue-entry filtering/navigation does not change
      `ledger_entries` count.
- [ ] Import Review continue-entry filtering/navigation does not update
      `import_items` or `import_batches`.
- [ ] Import Review direction filters are SELECT/read-only derived UI.
- [ ] Import Review direction filtering does not change `ledger_entries` count.
- [ ] Import Review direction filtering does not update `import_items` rows.
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
  - import batch creation RPC helper
  - import item status RPC helper
  - import item personal skip RPC helper
  - import confirm-to-ledger RPC helper

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
- [ ] Use only sanitized Import Review fixtures for import smoke.
- [ ] Use only sanitized import items for reopen smoke.
- [ ] Use only sanitized import items for personal skip smoke.
- [ ] Use only sanitized import items for suggested quick-apply smoke.
- [ ] Use only sanitized import items for suggestion filter smoke.
- [ ] Use only sanitized import items for direction filter smoke.
- [ ] Do not use real bill exports for committed tests.
- [ ] Do not test imported undo as a user flow; imported item undo remains
      deferred.
- [ ] Prefer creating temporary records through the normal UI.
- [ ] Importing sanitized fixtures may leave harmless `import_batches` and
      `import_items` rows.
- [ ] Personal skip smoke verifies `ledger_entries` count does not increase.
- [ ] Personal skip smoke verifies settlement rows do not change.
- [ ] Suggested quick-apply smoke verifies `ledger_entries` count does not
      increase for `skip` or `need_discussion`.
- [ ] Suggested quick-apply smoke verifies settlement rows do not change.
- [ ] Suggestion filter smoke verifies `ledger_entries` count does not change.
- [ ] Suggestion filter smoke verifies no `import_items` row is updated just by
      filtering.
- [ ] Suggestion filters are SELECT/read-only derived UI only.
- [ ] Direction filter smoke verifies `ledger_entries` count does not change.
- [ ] Direction filter smoke verifies no `import_items` row is updated just by
      filtering.
- [ ] Direction filters are SELECT/read-only derived UI only.
- [ ] Do not cleanup-delete import rows.
- [ ] Test ledger entries created through Import Review confirm-to-ledger should
      be soft-voided through the existing record detail flow.
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
- Personal ledger records are deferred.
- Importing personal expenses into official ledger records is deferred.
- Import Review custom split is deferred.
- Refund auto-linking is deferred.
- Import Review batch confirm-all is deferred.
- Undo/reopen imported items is deferred.
- Realtime Import Review collaboration is deferred.
- Import Review AI final decision is unsupported.
- Import Review voice recognition is unsupported.
- No original bill file archive is stored by Import Review V1.
- Restore voided record is deferred.
- Voided history/audit view is deferred.
- Real replacement UI full flow waits for a genuine outdated month or an
  approved safe data path.
- Generated Supabase Database types are not used in this project.

## When To Update This File

- A new private page is added.
- Import Review parser, upload, review, shortcut, or confirm behavior changes.
- Record mutation behavior changes.
- Settlement V2 replacement behavior changes.
- A new smoke/test runner is introduced.
- Schema/RLS changes affect records or settlement.
- `package.json` gains dedicated `lint`, `typecheck`, or `test` scripts.
