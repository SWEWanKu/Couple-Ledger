# Record Mutation Plan

> Planning document only. This file does not implement record edit, record
> void/delete, schema changes, RLS changes, API routes, server actions, helpers,
> UI controls, SQL execution, service role usage, payment behavior, or
> `localStorage` data authority. Future work must treat every implementation
> step below as a separate focused task.

## Goal

Define the future behavior for correcting ledger records in Couple Ledger,
especially when the record belongs to a month with Settlement V1/V2 snapshots.

Users will eventually need to correct wrong records: amount typos, wrong date,
wrong category, wrong payer, wrong note, or a record that should no longer count
in normal ledger views. A record mutation affects more than the record detail
page:

- `/records` filters, month navigation, date groups, daily totals, and monthly
  summary chips.
- `/records/new` return context and settled-month reminders.
- `/records/[id]` detail, split breakdown, and previous/next navigation.
- `/dashboard` monthly ledger summary.
- `/settlement` live calculation from `getSettlementSummary`.
- Settlement V1 immutable snapshots and Settlement V2 lifecycle state.
- Records settlement awareness shown on list, detail, and new-record pages.

The plan should let corrections feel like fixing a shared island notebook, not
like operating an admin finance system.

## Current Baseline Inspected

Current implementation facts:

- Record creation lives in `src/app/records/new/page.tsx` as a server action
  that calls `createRecord`.
- `createRecord` inserts one `ledger_entries` row, builds split rows, then
  inserts `ledger_entry_splits`.
- If split insert fails, `createRecord` attempts to delete the just-created
  parent `ledger_entries` row. That is current create rollback behavior, not
  the future V1 user-facing deletion model.
- Current creation supports `entry_type = expense | income`.
- Current creation supports `split_mode = equal | personal`; the schema also
  allows `custom`, but the current UI/action does not create custom splits.
- Record list and monthly summary read `ledger_entries`.
- Record detail reads one `ledger_entries` row plus its `ledger_entry_splits`.
- Settlement read logic uses expense entries only and treats split rows as the
  amount source of truth.
- `calculateSettlement` converts money to cents internally, checks split totals,
  and returns `incomplete` when split rows are missing or inconsistent.
- `buildSettlementSnapshotPayload` stores immutable snapshot amounts and a
  calculation-relevant `source_fingerprint`.
- `/settlement` compares the live source fingerprint with the stored active
  snapshot and shows an outdated warning when they differ.
- Settlement V1 snapshots and confirmations have no normal update/delete policy;
  amounts and snapshot JSON are immutable from browser clients.
- Settlement V2 lifecycle uses `active`, `pending_replacement`, and
  `superseded`; stored amount fields and snapshot JSON still remain immutable.
- The committed V2 recursion fix restores active-only `settlement_snapshots`
  inserts and explicitly defers pending replacement inserts to a future
  constrained policy/helper path.
- Current `ledger_entries` and `ledger_entry_splits` RLS includes
  household-member-scoped UPDATE and DELETE policies.
- Current schema has `ledger_entries.updated_at`, but no `updated_by`,
  `voided_at`, `voided_by`, `void_reason`, delete reason, edit history, or
  immutable record revision table.

## Non-Goals

This plan does not add:

- record edit implementation
- record void/delete implementation
- schema migrations
- RLS changes
- SQL execution
- API routes
- server actions
- helper files
- UI controls
- dashboard changes
- records page changes
- settlement page changes
- package changes
- generated Supabase types
- changes to `calculateSettlement`
- changes to `getSettlementSummary`
- service role usage
- Supabase admin API usage
- RLS bypass
- localStorage/sessionStorage data authority
- payment provider behavior
- real money transfer behavior

## V1 Locked Decisions

These decisions are locked for the first record edit/void implementation unless
a later decision document explicitly changes them before code work begins.

1. V1 uses soft delete / void, not hard delete.
   - Do not physically delete `ledger_entries` in the V1 app flow.
   - Do not physically delete `ledger_entry_splits` in the V1 app flow.
   - Future UI copy should say `作废这笔账`, not `永久删除`.
   - Hard delete is deferred beyond V1.

2. Voided records remain stored but are excluded from normal reads and
   calculations.
   - Future `/records`, monthly dashboard summaries, record pagers, and live
     settlement reads should exclude voided records by default.
   - Settlement snapshot history remains immutable and keeps describing what was
     accepted when the snapshot was created.
   - A voided record can be shown only in a future audit/history view, not in the
     V1 normal records list unless a later decision explicitly adds that view.

3. V1 adds minimal mutation metadata in a future schema task.
   - `ledger_entries.updated_at` already exists and should be kept current.
   - Proposed future `ledger_entries` metadata:
     - `updated_at`
     - `updated_by`
     - `voided_at`
     - `voided_by`
     - `void_reason`, optional
   - If split rows need metadata too, prefer deriving it from the parent
     `ledger_entries` row unless implementation proves split-level metadata is
     necessary.

4. V1 allows both household members to edit and void household records.
   - Do not restrict V1 mutation to the original creator.
   - Reason: this is a private two-person ledger and both members share the same
     household notebook responsibility.
   - All mutations still require authenticated household membership through RLS.
   - Preserve the original `created_by`; do not overwrite it during edit/void.
   - Record the acting member through future `updated_by` / `voided_by`.

5. Settled-month edit/void is allowed but must warn strongly.
   - Do not block editing or voiding solely because a month has a proposed,
     partially confirmed, or fully confirmed active settlement snapshot.
   - Show an extra settled-month warning before saving.
   - Stored settlement snapshots must never be rewritten.
   - Stored settlement confirmations must never be rewritten.
   - After mutation, live settlement may become outdated; the replacement
     settlement flow handles realignment later.

6. Pending replacement months are blocked for V1 record mutation.
   - If the selected month has a `pending_replacement` settlement snapshot,
     disable record edit/void and show a blocking warning until the replacement
     is resolved.
   - Reason: a pending replacement is already a draft based on a specific live
     fingerprint. Editing records while it waits for confirmation can stale both
     the active snapshot and the pending replacement.
   - Do not implement "mark pending replacement outdated" or replacement
     cancellation as part of V1 record mutation.

7. V1 edit scope follows the existing record creation model.
   - Support editing:
     - amount
     - `occurred_on` / date
     - category
     - note / description
     - entry type: `expense` or `income`
     - payer / member: `paid_by`
     - split mode and split rows through the existing `equal` and `personal`
       model
   - Rebuild split rows from the same validated model used by `createRecord`.
   - Defer `custom` split editing until custom split creation is designed.

8. Record update and split replacement must be atomic.
   - Treat `ledger_entries` and `ledger_entry_splits` as one logical unit.
   - Prefer a database RPC or transaction-safe server helper if ordinary server
     actions cannot guarantee consistency.
   - Avoid partial writes where the parent record updates but split replacement
     fails.
   - Do not use client-side multi-step writes.

9. Future edit/void actions must be safe under accidental duplicate submission.
   - Void is idempotent: voiding an already voided record returns an
     `already_voided` style result.
   - Edit uses server-side validation and redirects or result feedback.
   - Double-submit must not create duplicate split rows or inconsistent totals.

10. V1 RLS direction is narrow household-member mutation, with no app hard
    delete path.
    - Only authenticated household members can update/void records in their
      household.
    - Do not use service role.
    - Do not use Supabase admin APIs.
    - Do not bypass RLS.
    - Do not trust client-supplied `householdId`, `userId`, `updatedBy`, or
      `voidedBy`.
    - Future UPDATE policies should be narrow and validate household ownership,
      payer membership, and void metadata shape.
    - Prefer no DELETE policy for the V1 app flow. The current schema has DELETE
      policies, but V1 implementation must not rely on them for normal user
      record removal.

11. V1 UI direction stays scrapbook / island notebook.
    - `/records/[id]` may show `修改这笔账` and `作废这笔账`.
    - Edit UI should reuse the `/records/new` hand-account style.
    - Settled-month warning copy should include:
      `这笔账所在月份已经留下结算便签，修改后不会改写旧便签。`
    - Void confirmation should be gentle but explicit.
    - No admin/SaaS style.
    - No real payment, bank transfer, or settlement-as-payment language.

12. Rollout order is fixed for V1 unless a later plan changes it.
    - Step 1: decision lock doc.
    - Step 2: schema/RLS migration for soft void/update metadata only.
    - Step 3: read helpers exclude voided records.
    - Step 4: edit/void validation helpers.
    - Step 5: server action/RPC for edit.
    - Step 6: server action/RPC for void.
    - Step 7: detail page UI.
    - Step 8: records/monthly summary/settlement regression.
    - Step 9: update regression docs.

## V1 Mutation Scope

Future edit behavior should support the same form-level data shape as record
creation, with stricter atomicity:

- Edit amount.
- Edit entry type (`expense` or `income`).
- Edit date / `occurred_on`.
- Edit category.
- Edit note / description.
- Edit payer / member (`paid_by`) if the selected payer is still a household
  member.
- Edit split mode within the current creation model:
  - `equal`
  - `personal`
- Void a record.

Do not support `custom` split editing in V1. Current UI creates only `equal` and
`personal`, so exposing custom split controls would be a new feature rather than
record-correction polish.

Do not physically delete records in V1. The future user-facing removal action is
voiding.

## Soft Void Model

Soft void means keeping the parent `ledger_entries` row and excluding it from
normal reads, summaries, pagers, and live settlement calculations.

Minimal future schema direction:

- Keep `updated_at timestamptz not null default now()`.
- Add `updated_by uuid null references auth.users(id)`.
- Add `voided_at timestamptz null`.
- Add `voided_by uuid null references auth.users(id)`.
- Add `void_reason text null`, optional.
- Add a shape check requiring `voided_at` and `voided_by` to appear together.
- Keep `ledger_entry_splits` attached to the parent row for detail/history.

Read-helper implications:

- `/records` excludes voided rows by default.
- `/records/[id]` can show voided rows only if a future audit/history route
  explicitly links to them.
- `getMonthlyLedgerSummary` excludes voided rows.
- `getLedgerRecords` excludes voided rows.
- `getSettlementSummary` excludes voided expense rows.
- Record pagers exclude voided rows in normal browsing.

Why V1 chooses soft void:

- It preserves the household notebook history.
- It keeps settled-month corrections explainable without rewriting old
  snapshots.
- It lets future replacement settlement realign a month while old notes stay
  readable.
- It avoids making "delete" feel like an irreversible finance-admin operation.

Hard delete is deferred beyond V1 and should require a separate decision update
before any user-facing implementation.

## Settled Month Rules

### Month Has No Settlement Snapshot

Edit/void can behave normally after standard validation:

- Recalculate records list and dashboard summaries on next render.
- Recalculate live settlement on next `/settlement` render.
- No snapshot warning is needed because there is no stored snapshot to compare.
- Keep split rows consistent and writes atomic.

### Month Has Proposed, Partial, Or Fully Confirmed Active Snapshot

Before mutation, show a clear warning:

> 这笔账所在月份已经留下结算便签，修改后不会改写旧便签。

Rules:

- Allow the edit/void after the stronger warning.
- Do not change `settlement_snapshots`.
- Do not change `settlement_confirmations`.
- Do not delete or rewrite stored snapshot JSON.
- Do not update snapshot amount columns.
- Perform only the record correction.
- After mutation, `/settlement` should show the active snapshot as outdated if
  the live source fingerprint differs.
- Records pages should keep warning that old snapshot notes do not change
  automatically.
- A later replacement settlement flow can create a new note and eventually
  supersede the old active snapshot after both members confirm.

### Month Has Pending Replacement

V1 record mutation is blocked while a pending replacement exists.

Blocking warning copy:

> 这个月正在等一张新的结算便签确认。先不要改这笔账，等新便签处理完后再回来修正会更稳。

Rules:

- Do not edit records in that month.
- Do not void records in that month.
- Do not mutate the pending replacement.
- Do not attempt to regenerate or abandon the pending replacement from the
  record edit/void flow.

Future alternatives such as canceling a pending replacement, marking it
outdated, or regenerating it belong to a later Settlement V2 change-management
task.

## RLS And Security Direction

Record mutation must stay under the same app security posture:

- Only authenticated allowed users can mutate.
- Only household members can update/void records from their household.
- Do not use service role in app code.
- Do not use Supabase admin APIs.
- Do not bypass RLS.
- Do not trust client-provided `householdId`, `createdBy`, `updatedBy`,
  `voidedBy`, or `userId`.
- Derive the authenticated user server-side through the existing server
  Supabase client.
- Derive household membership server-side, the same way private pages do.
- Validate category, payer, and split users against server-read household
  members/categories.

Current RLS already includes UPDATE/DELETE policies for `ledger_entries` and
`ledger_entry_splits`, but V1 implementation should be designed around UPDATE
for edit/void, not DELETE for user-facing removal:

- Soft void needs UPDATE policy coverage for the new void columns.
- Future UPDATE policies should be narrow and should preserve household
  membership, payer membership, and metadata shape.
- If edits replace split rows, `ledger_entry_splits` mutation must be covered by
  the same atomic server path.
- Prefer no normal client DELETE policy in the V1 app flow.
- If an RPC is used, it should be `SECURITY INVOKER` or otherwise explicitly
  justified; do not jump to `SECURITY DEFINER` as a shortcut.

## Data Integrity Rules

Record edit/void must treat `ledger_entries` and `ledger_entry_splits` as one
logical unit.

### Editing Amount

- Rebuild split rows from the normalized amount and selected split mode.
- Keep amount units consistent with current `createRecord`: parse to cents, then
  store a two-decimal string or numeric-compatible value.
- Do not let split totals drift from the parent amount.

### Editing Type

- Expense/income changes affect settlement because settlement ignores income.
- Rebuild split rows transactionally for both directions, using the same
  split-mode rules as creation.
- If the type changes from `expense` to `income`, live settlement should stop
  including that row after the edit.
- If the type changes from `income` to `expense`, live settlement should include
  the rebuilt split rows after the edit.

### Editing Date

- Moving a record across months can affect two months:
  - the old month loses the record
  - the new month gains the record
- If either month has an active proposed, partial, or fully confirmed snapshot,
  show the settled-month warning for that month.
- If either month has a pending replacement, block the edit until that
  replacement is resolved.

### Editing Payer / Member

- `paid_by` must remain a member of the same household.
- Rebuild split rows if split mode is `personal`.
- If split mode is `equal`, payer changes paid totals but not shares.

### Editing Split / Share

- V1 supports `equal` and `personal`.
- V1 does not support `custom` split editing.
- For `equal`, rebuild split rows for all current household members using the
  same cent-remainder handling as creation.
- For `personal`, create one split row assigned to the selected payer.
- Validate that every split user belongs to the household, split totals equal
  the parent amount in cents, and no share is negative.

### Void

- Mark the parent `ledger_entries` row as voided.
- Leave split rows attached for future detail/history.
- Normal readers must exclude voided parent rows.
- Settlement readers must exclude voided parent rows.
- Voiding an already voided record returns an `already_voided` style result.

### Atomicity

Avoid partial writes. Updating the parent and replacing split rows must be one
atomic operation.

Recommended implementation direction:

- Use a database RPC or explicit transaction-capable server path for complex
  edit/void.
- If Supabase client operations cannot be made atomic from the server action,
  add a constrained SQL RPC in a dedicated migration task.
- The RPC must validate household membership under RLS and must not mutate
  settlement snapshots.

## UI Direction

Future UI should follow the existing scrapbook / island notebook style.

Potential `/records/[id]` actions:

- `修改这笔账`
- `作废这笔账`

Edit UI:

- Reuse the `/records/new` hand-account form language.
- Keep the selected month/list return context.
- Use the same validation copy as create where possible.
- Clearly show when changing date moves the record to another month.
- No admin table.
- No SaaS dashboard panel.

Void UI:

- Use gentle but clear confirmation copy.
- Use `作废这笔账`, not `永久删除`.
- Avoid scary enterprise audit language.
- Avoid payment/transfer language.
- Mention settled-month impact when relevant.

Settled-month warning copy:

> 这笔账所在月份已经留下结算便签，修改后不会改写旧便签。实时结算可能会变成新的结果，之后可以用新的结算便签重新对齐。

Pending-replacement blocking copy:

> 这个月正在等一张新的结算便签确认。先不要改这笔账，等新便签处理完后再回来修正会更稳。

Visual direction:

- Parchment note / memo card.
- Sticker-like warning strip.
- Animal-Island-style buttons when UI is implemented.
- No admin table.
- No SaaS dashboard panel.
- No "payment succeeded", "transfer complete", or bank/payment provider copy.

## Rollout Plan

1. Lock product/data decisions in docs.
   - Soft void, settled-month behavior, pending-replacement behavior, edit
     scope, RLS direction, and rollout order are decided in this document.
2. Add schema/RLS migration for soft void/update metadata only.
   - Keep or use `updated_at`.
   - Add `updated_by`, `voided_at`, `voided_by`, and optional `void_reason`.
   - Add shape checks and narrow policies.
   - Prefer no user-facing DELETE path.
3. Update read helpers to exclude voided records.
   - `getLedgerRecords`
   - `getMonthlyLedgerSummary`
   - `getRecordDetail` normal access rules
   - `getSettlementSummary`
   - record detail pager
4. Add pure edit/void validation helpers.
   - Reuse creation normalization where possible.
   - Keep amount parsing in cents.
   - Keep allowed edit scope to the V1 model.
5. Add server action/RPC for edit.
   - Derive auth user and household server-side.
   - Validate record belongs to household.
   - Rebuild splits atomically.
6. Add server action/RPC for void.
   - Mark parent row voided.
   - Keep split rows attached.
   - Keep settled snapshot immutable.
   - Return `already_voided` style feedback on duplicate submission.
7. Add detail page UI.
   - Keep scrapbook style.
   - Preserve return context.
   - Use `修改这笔账` and `作废这笔账`.
8. Smoke records/monthly summary/settlement awareness.
   - Verify records list, dashboard, detail, and settlement pages all reflect
     edit/void consistently.
9. Update regression docs.
   - Add normal month, settled month, and pending replacement edit/void checks.

Each step should be a focused branch with its own verification.

## Test Plan

Future implementation should verify:

- Edit a normal unsettled month record.
- Void a normal unsettled month record.
- Edit a fully confirmed month record after settled-month warning.
- Void a fully confirmed month record after settled-month warning.
- Verify stored settlement snapshot amount fields are unchanged.
- Verify stored settlement snapshot JSON is unchanged.
- Verify live settlement differs when the correction changes paid/share/net.
- Verify `/settlement` shows an outdated warning when fingerprint differs.
- Verify records awareness remains visible for settled months.
- Verify replacement flow can later realign the month.
- Verify edit/void is blocked when a pending replacement exists.
- Verify non-member cannot edit/void.
- Verify both household members can edit/void household records.
- Verify service role and RLS bypass are not used.
- Verify split rows stay consistent after amount, payer, type, date, or split
  mode changes.
- Verify date changes across months update both month contexts correctly.
- Verify duplicate edit submissions are safe.
- Verify void is idempotent and returns an `already_voided` style result.
- Verify record creation behavior is unchanged.
- Verify `calculateSettlement` amount rules are unchanged.
- Verify `getSettlementSummary` read semantics are unchanged except for the
  future explicit exclusion of voided records after the soft-void schema exists.

Suggested future static checks:

- Search changed mutation files for service role, admin auth, direct
  `allowed_user_emails`, localStorage/sessionStorage, broad settlement snapshot
  updates, hard-delete record paths, and payment-provider language.
- Confirm only the intended ledger mutation files and UI files changed.
- Confirm no migration is mixed into helper/UI tasks unless the task explicitly
  asks for that migration.

## Decision Status

### Resolved For V1

1. V1 uses soft delete / void, not hard delete.
2. V1 does not physically delete `ledger_entries`.
3. V1 does not physically delete `ledger_entry_splits`.
4. Normal record lists, monthly summaries, pagers, and live settlement exclude
   voided rows by default.
5. Snapshot history remains immutable.
6. V1 future schema uses minimal parent-row metadata: `updated_at`,
   `updated_by`, `voided_at`, `voided_by`, and optional `void_reason`.
7. Split-row metadata is deferred unless implementation proves it is needed.
8. Both household members may edit/void household records.
9. V1 does not restrict edit/void to the original creator.
10. `created_by` is preserved.
11. Settled-month edit/void is allowed after a strong warning.
12. Stored settlement snapshots and confirmations are never rewritten by record
    mutation.
13. Pending replacement months block V1 record edit/void.
14. V1 edit supports amount, date, category, note, entry type, payer, and the
    existing `equal` / `personal` split model.
15. `custom` split editing is not part of V1.
16. Parent entry updates and split replacement must be atomic.
17. Void is idempotent.
18. Future mutation uses authenticated household membership, narrow RLS, no
    service role, no admin API, and no RLS bypass.
19. Future UI uses `修改这笔账` and `作废这笔账`.
20. Rollout order is schema/RLS, read exclusions, validation, edit write path,
    void write path, detail UI, regression.

### Deferred Beyond V1

1. Hard delete as a user-facing action.
2. Permanent deletion copy or irreversible deletion UX.
3. Showing voided records in normal `/records` list.
4. A dedicated audit/history view for voided records.
5. Restore/unvoid behavior.
6. Split-level mutation metadata.
7. Custom split creation and custom split editing.
8. Pending replacement cancellation, abandonment, regeneration, or "outdated
   pending replacement" states.
9. Month locking that blocks all edits after a month is settled.
10. Restricting mutation to the original creator.
11. Any payment provider, real transfer, or bank-transfer confirmation behavior.

### Still Needs Human Decision

1. Should `void_reason` be required or optional in the first void UI?
2. Should voided records be directly viewable from old bookmarked detail links,
   or only from a future explicit history/audit surface?
3. What exact final Chinese microcopy should appear on the edit confirmation,
   void confirmation, success, and error states?
4. Should the future edit page reuse `/records/new` as a shared form component,
   or stay as a separate page with copied field semantics?
5. Should a settled-month correction merely offer replacement settlement later,
   or actively guide the user back to `/settlement` after save?

## Future Stop Conditions

Stop and write a follow-up decision note instead of implementing if:

- the task would mutate settlement snapshots directly
- the task would rewrite settlement confirmations directly
- the task would hard-delete `ledger_entries` or `ledger_entry_splits` in V1
- the task would require service role or Supabase admin API in app code
- the task would bypass RLS
- parent entry and split rows cannot be updated atomically
- pending replacement handling requires cancellation/regeneration behavior
- exact soft-void schema or RLS shape conflicts with the current database
- the implementation would change `calculateSettlement` amount rules
- the implementation would rewrite `getSettlementSummary` read semantics beyond
  the explicit future voided-row exclusion
- the implementation would add payment-provider or real money transfer behavior

## Current Documentation Task Verification

This documentation task is complete only if:

- `RECORD_MUTATION_PLAN.md` is the only changed file.
- No `src/**` file changed.
- No `supabase/**` file changed.
- No SQL was executed.
- No RLS was changed.
- No API route or server action was added.
- No helper was changed.
- No `package.json` or `package-lock.json` change exists.
- No generated Supabase Database types were created.
- No `.env.local` change is staged or committed.
- No service role, Supabase admin API, RLS bypass, localStorage/sessionStorage,
  payment-provider behavior, or real-transfer behavior was introduced.
- `calculateSettlement` remains unchanged.
- `getSettlementSummary` remains unchanged.
- Record write behavior remains unchanged.
- Settlement behavior remains unchanged.
- Doc-only/static safety checks pass.
- `npm run build` may be skipped because this is Markdown-only; if it is run,
  report the result.
