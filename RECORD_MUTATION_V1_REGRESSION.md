# Record Mutation V1 Regression Checklist

This document is a documentation-only regression checklist for the completed
Record Mutation V1 soft-void and edit flows. It does not add product behavior,
schema changes, RLS changes, SQL execution, API routes, helpers, UI, package
changes, or persistent test data.

## Scope

- Guard the completed V1 record correction paths:
  - soft void through `voidLedgerRecord`;
  - edit through `update_ledger_record_v1`;
  - records list/detail/monthly summary/live settlement read behavior after a
    mutation.
- Keep routine smoke data safe. Use a far-future month such as `2099`, then
  soft-void the same temporary record as cleanup.
- Do not edit or void important real `2026-06` records during routine smoke.

## Current Verified Status

- Soft-void metadata exists on `ledger_entries`:
  - `updated_at`;
  - `updated_by`;
  - `voided_at`;
  - `voided_by`;
  - `void_reason`.
- `ledger_entries` has no DELETE policy for the V1 app flow.
- Normal read helpers exclude voided records:
  - records list;
  - record detail;
  - monthly ledger summary;
  - live settlement summary.
- Record detail has the `作废这笔账` soft-void surface.
- Record detail has the `修改这笔账` edit entry.
- The edit page is `/records/[id]/edit`.
- Edit submits through the `update_ledger_record_v1` RPC.
- Soft void updates parent-row metadata only.
- Soft void preserves `ledger_entry_splits`.
- Edit atomically updates the parent entry and rebuilds split rows through the
  RPC.
- Stored settlement snapshots and confirmations are not mutated by record edit
  or void.

## Soft Void Regression Checklist

### UI And Access

- [ ] Record detail renders `作废这笔账`.
- [ ] Anonymous users remain protected from private record detail routes.
- [ ] The soft-void form preserves safe return context:
      `month`, `type`, `category`, `member`, and `q`.
- [ ] `voided=1` renders the success sticker on `/records`.
- [ ] `voided=already_voided` renders the already-voided feedback.
- [ ] `voided=blocked_pending_replacement` renders the pending-replacement
      feedback.

### Settlement-Aware Behavior

- [ ] A settled month shows the stronger warning before void.
- [ ] A month with `pending_replacement` blocks void.
- [ ] Stored settlement snapshots remain immutable.
- [ ] Stored settlement history and snapshot detail remain immutable.
- [ ] `/settlement` live calculation naturally excludes the voided record on the
      next read.
- [ ] No replacement settlement behavior is changed by the void path.

### Data Integrity

- [ ] Void sets `voided_at`.
- [ ] Void sets `voided_by`.
- [ ] Void sets `updated_at`.
- [ ] Void sets `updated_by`.
- [ ] Void stores optional `void_reason` when provided.
- [ ] Void does not hard-delete `ledger_entries`.
- [ ] Void does not delete `ledger_entry_splits`.
- [ ] Voided records disappear from the normal records list.
- [ ] Voided records disappear from normal record detail.
- [ ] Voided records disappear from monthly summary.
- [ ] Voided expense records disappear from live settlement.

## Edit Regression Checklist

### UI And Access

- [ ] Record detail renders `修改这笔账`.
- [ ] `/records/[id]/edit` is protected for anonymous users.
- [ ] The edit page pre-fills current values.
- [ ] The edit page keeps safe return context:
      `month`, `type`, `category`, `member`, and `q`.
- [ ] `updated=1` renders the update success sticker on record detail.
- [ ] The edit page uses the same island notebook / scrapbook language as
      records pages.

### Settlement-Aware Behavior

- [ ] A settled month shows the edit warning.
- [ ] A month with `pending_replacement` blocks edit.
- [ ] Editing a settled month does not mutate stored settlement snapshots.
- [ ] Editing a settled month does not mutate stored confirmations.
- [ ] Live settlement may change after edit; immutable snapshot/history/detail
      stay unchanged.

### Allowed V1 Fields

- [ ] Amount.
- [ ] Date / `occurred_on`.
- [ ] Category.
- [ ] Note.
- [ ] Type: `expense` or `income`.
- [ ] Payer/member: `paid_by`.
- [ ] Split mode: `equal`.
- [ ] Split mode: `personal`.

### Deferred Or Unsupported In V1

- [ ] Custom split edit is not supported in V1.
- [ ] Restore / unvoid is not supported in V1.
- [ ] Hard delete is not supported in V1.
- [ ] No payment, real transfer, or mark-paid behavior is added.

### Data Integrity

- [ ] Edit updates `updated_at`.
- [ ] Edit updates `updated_by`.
- [ ] Edit keeps split rows consistent with the edited amount.
- [ ] `personal` split has exactly one split row assigned to the payer.
- [ ] `equal` split has one split row per current household member.
- [ ] Split total equals parent entry amount in cents.
- [ ] Edit does not mutate settlement snapshots.
- [ ] Edit does not mutate settlement confirmations.
- [ ] Edit returns `already_voided` or an equivalent blocked result for voided
      records.

## Safe Write Smoke Procedure

Use `LOCAL_SMOKE_GUIDE.md` first, especially the Windows stale-process and
secret-handling notes.

### Before Smoke

- [ ] Confirm repository state:

```powershell
git status --short --branch
git rev-parse --short HEAD
git log -1 --oneline
```

- [ ] Confirm the intended dev port is not occupied by a stale Next.js process.
- [ ] Do not print `.env.local` values.
- [ ] Do not print `SUPABASE_DB_URL`.
- [ ] Do not use service role or Supabase admin APIs.

### Temporary Record Path

- [ ] Use a far-future test month such as `2099-10`.
- [ ] Create one temporary record through the normal `/records/new` create flow.
- [ ] Use a unique note marker such as `record-edit-v1-smoke-<timestamp>`.
- [ ] Open the created record from `/records?month=2099-10&q=<marker>`.
- [ ] Edit that record through `/records/[id]/edit`.
- [ ] Verify detail reflects the edited values:
      amount, date, category, type, payer, note, and split mode as applicable.
- [ ] Verify the list reflects the edited values.
- [ ] Verify the monthly summary reflects the edited values.

### Read-Only Data Verification

Use only a normal authenticated user session under RLS or a read-only database
check. Do not use service role and do not bypass RLS.

- [ ] Verify `ledger_entries.updated_at` is set.
- [ ] Verify `ledger_entries.updated_by` is set.
- [ ] Verify the edited amount/date/type/category/payer/note are stored.
- [ ] Verify split row count matches `split_mode`.
- [ ] Verify split row total equals the parent amount.

### Cleanup

- [ ] Soft-void the same temporary record through the existing record detail UI.
- [ ] Verify the temporary record is excluded from normal `/records` list.
- [ ] Verify the parent row still exists as a soft-voided record.
- [ ] Verify split rows remain attached after soft void.
- [ ] Do not edit or void important real `2026-06` records.

## Settlement Regression Checklist

- [ ] `/settlement?month=2026-06` remains `fully_confirmed / 2/2`.
- [ ] `/settlement?month=2026-06` shows no false outdated warning when no real
      settled-month mutation was intentionally performed.
- [ ] `/settlement?month=2026-06` shows no unexpected replacement proposal UI
      when the month is unchanged.
- [ ] `/settlement/history` renders.
- [ ] Settlement snapshot detail renders.
- [ ] Stored snapshots remain immutable.
- [ ] Stored confirmations remain immutable.
- [ ] Replacement flow remains unchanged.
- [ ] If a real settled-month mutation is intentionally performed, verify the
      existing outdated/replacement behavior rather than rewriting old snapshots.

## Records UI Regression Checklist

- [ ] `/records` grouped date sections still render.
- [ ] Type filter still works.
- [ ] Category filter still works.
- [ ] Member filter still works.
- [ ] Keyword `q` filter still works.
- [ ] Month navigation still works.
- [ ] Monthly summary links still work.
- [ ] `/records/new` context preservation still works.
- [ ] Record detail return link still works.
- [ ] Record detail previous/next navigation still works.
- [ ] `created=1` feedback sticker renders on `/records`.
- [ ] `updated=1` feedback sticker renders on record detail.
- [ ] `voided=1` feedback sticker renders on `/records`.
- [ ] Settled-month awareness remains visible on list, new, and detail pages for
      `2026-06` when the data exists.

## Security And Forbidden Behavior

Record Mutation V1 regression work must not introduce:

- hard delete;
- a `ledger_entries` DELETE policy;
- service role usage;
- Supabase admin API usage;
- RLS bypass;
- `localStorage` or `sessionStorage` as a data source;
- settlement snapshot mutation;
- settlement confirmation mutation;
- payment provider behavior;
- real transfer behavior;
- generated Supabase Database types;
- `.env.local` commits;
- `SUPABASE_DB_URL` printing;
- package changes;
- app-code changes during documentation-only checklist updates.

For future code tasks, explicitly inspect changed files for:

```powershell
rg -n -e "\.insert\(" -e "\.update\(" -e "\.delete\(" -e "\.upsert\(" -e "service_role" -e "serviceRole" -e "SUPABASE_SERVICE" -e "localStorage" -e "sessionStorage" -e "settlement_snapshots" -e "settlement_confirmations" src
```

Interpret the results in context. The V1 edit RPC intentionally updates one
entry and rebuilds split rows inside `update_ledger_record_v1`; the app helper
must not bypass that RPC for edit.

## Known Limitations

- Custom split edit is deferred beyond V1.
- Restore / unvoid is deferred beyond V1.
- A dedicated voided-record history or audit view is deferred.
- Hard delete is deferred.
- Editing real fully settled `2026-06` data should not be used for routine
  smoke.
- The `pending_replacement` edit/void block should be tested when a real pending
  replacement exists.
- Routine safe smoke should use a far-future temporary record and clean it up
  with soft void.

## Future Update Points

Update this document when:

- custom split creation or edit is added;
- restore / unvoid is added;
- voided-record history or audit views are added;
- hard delete receives a separate explicit product decision;
- edit or void behavior changes around `pending_replacement`;
- settlement replacement behavior changes in response to record mutation;
- a formal smoke or test runner is introduced;
- package scripts add dedicated `lint`, `typecheck`, or `test` commands.

## Verification Commands For This Document

For documentation-only updates to this checklist, run:

```powershell
npm run build
git diff --name-only
git diff --check
git diff --cached --check
git status --short -- .env.local package.json package-lock.json supabase src
```

Expected documentation-only result:

- only `RECORD_MUTATION_V1_REGRESSION.md` changes;
- no `src/**` changes;
- no `supabase/**` changes;
- no SQL execution;
- no RLS changes;
- no API route, server action, helper, UI, dashboard, records page, settlement
  page, or package change;
- no generated Supabase Database types;
- no `.env.local` commit;
- no service role, Supabase admin API, RLS bypass, `localStorage`,
  `sessionStorage`, payment-provider, or real-transfer change;
- no `calculateSettlement` change;
- no `getSettlementSummary` change;
- no record write behavior change;
- no settlement behavior change.
