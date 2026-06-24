# Record Mutation Plan

> Planning document only. This file does not implement record edit, record
> delete, schema changes, RLS changes, API routes, server actions, helpers, UI
> controls, SQL execution, service role usage, payment behavior, or
> `localStorage` data authority. Future work must treat every implementation
> step below as a separate task.

## Goal

Define the future behavior for correcting ledger records in Couple Ledger,
especially when the record belongs to a month with Settlement V1/V2 snapshots.

Users will eventually need to correct wrong records: amount typos, wrong date,
wrong category, wrong payer, wrong note, or a record that should not exist. A
record mutation affects more than the record detail page:

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
  parent `ledger_entries` row.
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
- Settlement V1 snapshots and confirmations have no normal update/delete
  policy; amounts and snapshot JSON are immutable from browser clients.
- Settlement V2 lifecycle uses `active`, `pending_replacement`, and
  `superseded`; stored amount fields and snapshot JSON still remain immutable.
- The committed V2 recursion fix restores active-only `settlement_snapshots`
  inserts and explicitly defers pending replacement inserts to a future
  constrained policy/helper path.
- Current `ledger_entries` and `ledger_entry_splits` RLS includes
  household-member-scoped UPDATE and DELETE policies.
- Current schema has no `deleted_at`, `voided_at`, `updated_by`, delete reason,
  edit history, or immutable record revision table.

## Non-Goals

This plan does not add:

- record edit implementation
- record delete implementation
- void/restore implementation
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

## V1 Scope Recommendation

For the first record mutation version, prefer explicit user actions:

- `Edit record`
- `Delete record` or, if the chosen data model is soft delete, `Void record`

Do not silently mutate settlement snapshots. A saved settlement snapshot is a
historical note that records what the two people accepted at that time.

If a record belongs to a month with an active, proposed, partially confirmed,
fully confirmed, or replacement-related settlement snapshot:

1. The mutation can change the live ledger calculation.
2. The existing snapshot stays immutable.
3. `/settlement?month=YYYY-MM` should compare the new live calculation with the
   stored source fingerprint.
4. If they differ, `/settlement` should show the outdated active snapshot
   warning.
5. A future replacement settlement flow should realign the month, not an
   automatic snapshot rewrite.

Recommended V1 behavior:

- Allow normal edits/deletes for months with no settlement snapshot.
- Allow settled-month corrections only after a stronger confirmation.
- Keep old snapshots readable and unchanged.
- Prefer creating or confirming a replacement settlement later, once that path
  is safe and available.
- Do not lock all ledger edits in V1 unless the human explicitly chooses month
  locking later.

## Allowed Mutation Types

Future edit behavior may support the following, but only after validation and
split handling are designed:

- Edit amount.
- Edit entry type (`expense` or `income`) only if the action can safely rebuild
  affected split rows and preserve settlement semantics.
- Edit date / `occurred_on`.
- Edit category.
- Edit note / description.
- Edit payer / member (`paid_by`) if the selected payer is still a household
  member.
- Edit split/share only if the current split model supports it safely.
- Delete record.
- Mark a record as voided instead of hard deleting it, if the chosen data model
  supports soft delete.

Do not support `custom` split editing in V1 unless custom split creation is also
designed. Current UI creates only `equal` and `personal`, so exposing custom
split edit controls would be a new feature, not a correction polish.

## Hard Delete Vs Soft Delete

### Hard Delete

Hard delete means removing the `ledger_entries` row. Current schema cascades
`ledger_entry_splits` through `entry_id references ledger_entries(id) on delete
cascade`.

Benefits:

- Matches current schema without migration.
- Keeps list and settlement queries simple.
- A deleted wrong record disappears from monthly totals, records filters, and
  live settlement calculations.
- Existing settlement snapshots remain as the immutable historical reference.
- Outdated snapshot warnings explain when a settled month changed later.

Costs:

- The app loses the deleted record's old details unless a snapshot happened to
  include the settlement outcome.
- There is no built-in undo, delete reason, or local audit trail.
- In a settled month, a deleted record can make history feel surprising unless
  the UI copy is very clear.
- The current `updated_at` column does not record who deleted anything.

### Soft Delete / Void

Soft delete means keeping the row and excluding it from normal records,
dashboard, and settlement reads by marking it voided.

Minimal future schema direction, if chosen:

- Add `voided_at timestamptz null`.
- Add `voided_by uuid null references auth.users(id)`.
- Add `void_reason text null`, optional.
- Add a shape check requiring `voided_at` and `voided_by` to appear together.
- Update all normal read helpers to exclude voided rows.
- Decide whether record detail can open a voided row directly from history.

Benefits:

- Preserves the household notebook history.
- Makes settled-month corrections easier to explain.
- Enables future undo/restore or visible correction notes.
- Avoids losing context when a record was part of an already confirmed month.

Costs:

- Requires schema, RLS, helper, query, UI, and smoke updates.
- Every read path must remember to exclude voided records.
- Settlement live calculation must exclude voided rows consistently.
- More product copy is needed so the app does not feel like an audit system.
- Restore behavior becomes another decision.

### Initial Recommendation

Recommend soft delete / void as the initial product direction, but do not
implement it before a focused schema/RLS task.

Reasoning:

- Couple Ledger is a private two-person app, so the tone should stay gentle,
  but settled months are agreements. Keeping a small correction trail is useful.
- Settlement snapshots are immutable. A voided record can explain why the live
  month now differs without rewriting the old snapshot.
- Future replacement settlement flow can realign the month while preserving the
  old note.
- Hard delete is technically simpler, but it makes old-month corrections harder
  to reason about once snapshots exist.

Fallback if the human wants the smallest implementation first:

- Start with hard delete only for months with no settlement snapshot.
- Disable delete for months with any active or pending settlement snapshot until
  soft delete is designed.
- Still allow edit for unsettled months through a transactional helper.

## Settled Month Rules

### Month Has No Settlement Snapshot

Edit/delete can behave normally after standard validation:

- Recalculate records list and dashboard summaries on next render.
- Recalculate live settlement on next `/settlement` render.
- No snapshot warning is needed because there is no stored snapshot to compare.
- Still keep split rows consistent and writes atomic.

### Month Has Proposed, Partial, Or Fully Confirmed Active Snapshot

Before mutation, show a clear warning:

> 这笔账所在月份已经留下结算便签，修改后不会改写旧便签。

Rules:

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

Recommended safe V1 behavior: block edit/delete while a pending replacement
exists for that month.

Reasoning:

- A pending replacement is itself a draft based on a specific live
  fingerprint.
- Editing records while that draft waits for confirmation can make both the
  active snapshot and pending replacement stale.
- Current V2 insert policy history shows this area needs constrained,
  non-recursive handling; record mutation should not add more moving parts.

Future alternative:

- Allow edit/delete with an even stronger warning.
- Mark the pending replacement outdated too.
- Require the user to abandon or regenerate the pending replacement before
  confirming it.

Do not implement that alternative until V2 replacement cancellation/voiding is
designed.

## RLS And Security Direction

Record mutation must stay under the same app security posture:

- Only authenticated allowed users can mutate.
- Only household members can mutate records from their household.
- Do not use service role in app code.
- Do not use Supabase admin APIs.
- Do not bypass RLS.
- Do not trust client-provided `householdId`, `createdBy`, or `updatedBy`.
- Derive the authenticated user server-side through the existing server
  Supabase client.
- Derive household membership server-side, the same way private pages do.
- Validate category, payer, and split users against the server-read household
  members/categories.

Current RLS already includes UPDATE/DELETE policies for `ledger_entries` and
`ledger_entry_splits`, but future implementation must confirm whether those
policies are still sufficient after the chosen delete model:

- Hard delete can use existing DELETE policy if app-level validation is enough.
- Soft delete needs UPDATE policy coverage for the new void columns.
- If edits replace split rows, `ledger_entry_splits` DELETE/INSERT policies must
  cover the whole operation safely.
- If an RPC is used, it should be `SECURITY INVOKER` or otherwise explicitly
  justified; do not jump to `SECURITY DEFINER` as a shortcut.

## Data Integrity Rules

Record edit/delete must treat `ledger_entries` and `ledger_entry_splits` as one
logical unit.

### Editing Amount

- Rebuild split rows from the normalized amount and selected split mode.
- Keep amount units consistent with current `createRecord`: parse to cents, then
  store a two-decimal string or numeric-compatible value.
- Do not let split totals drift from the parent amount.

### Editing Type

- Expense/income changes affect settlement because settlement ignores income.
- If changing `expense` to `income`, confirm whether existing split rows should
  remain for display only or be rebuilt for consistency.
- Recommendation: rebuild split rows transactionally for both directions, using
  the same split-mode rules as creation.

### Editing Date

- Moving a record across months can affect two months:
  - the old month loses the record
  - the new month gains the record
- If either month has a snapshot, show warnings for both months.
- If either month has pending replacement, block until replacement handling is
  designed.

### Editing Payer / Member

- `paid_by` must remain a member of the same household.
- Rebuild or validate split rows if split mode is `personal`.
- If split mode is `equal`, payer changes paid totals but not shares.

### Editing Split / Share

- Current product supports `equal` and `personal`.
- Custom split editing should remain future work unless custom split creation
  is implemented first.
- If custom splits are added later, validate:
  - every split user belongs to the household
  - no duplicate split users per entry unless intentionally supported
  - split total equals parent amount in cents
  - no negative shares

### Delete / Void

Hard delete:

- Parent delete cascades split rows.
- Use only after settled-month warning and server validation.

Soft delete:

- Prefer voiding the parent only.
- Leave split rows attached for record detail/history.
- Normal readers must exclude voided parent rows.
- Settlement readers must exclude voided parent rows.

### Atomicity

Avoid partial writes. Updating the parent and replacing split rows should be
one atomic operation.

Recommended implementation direction:

- Use a database RPC or explicit transaction-capable server path for complex
  edit/delete.
- If Supabase client operations cannot be made atomic from the server action,
  add a constrained SQL RPC in a dedicated migration task.
- The RPC must validate household membership under RLS and must not mutate
  settlement snapshots.

## UI Direction

Future UI should follow the existing scrapbook / island notebook style.

Potential `/records/[id]` actions:

- `修改这笔账`
- `删除这笔账` or `作废这笔账`

Edit UI:

- Reuse the `/records/new` hand-account form language.
- Keep the selected month/list return context.
- Use the same validation copy as create where possible.
- Clearly show when changing date moves the record to another month.

Delete/void UI:

- Use gentle but clear confirmation copy.
- Avoid scary enterprise audit language.
- Avoid payment/transfer language.
- Mention settled-month impact when relevant.

Settled-month warning copy:

> 这笔账所在月份已经留下结算便签，修改后不会改写旧便签。实时结算可能会变成新的结果，之后可以用新的结算便签重新对齐。

Pending-replacement warning copy:

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
   - Decide hard delete vs soft delete/void.
   - Decide settled-month warning and pending-replacement behavior.
2. Inspect current ledger schema/RLS and decide whether existing UPDATE/DELETE
   policies are enough.
3. If needed, add schema/RLS migration only.
   - For soft delete, add void metadata.
   - For audit metadata, add `updated_by` / `updated_at` behavior if chosen.
4. Add pure validation/normalization helpers.
   - Reuse creation normalization where possible.
   - Keep amount parsing in cents.
5. Add server action/helper for edit.
   - Derive auth user and household server-side.
   - Validate record belongs to household.
   - Rebuild splits atomically.
6. Add server action/helper for delete/void.
   - Keep settled snapshot immutable.
   - Block or warn according to settled/pending state.
7. Add detail page edit/delete UI.
   - Keep scrapbook style.
   - Preserve return context.
8. Smoke records/monthly summary/settlement awareness.
   - Verify records list, dashboard, detail, and settlement pages all reflect
     the mutation correctly.
9. Update regression checklist.
   - Add normal month and settled month edit/delete/void checks.

Each step should be a focused branch with its own verification.

## Test Plan

Future implementation should verify:

- Edit a normal un-settled month record.
- Delete or void a normal un-settled month record.
- Edit a fully confirmed month record after settled-month warning.
- Delete or void a fully confirmed month record after settled-month warning.
- Verify stored settlement snapshot amount fields are unchanged.
- Verify stored settlement snapshot JSON is unchanged.
- Verify live settlement differs when the correction changes paid/share/net.
- Verify `/settlement` shows an outdated warning when fingerprint differs.
- Verify records awareness remains visible for settled months.
- Verify replacement flow can later realign the month.
- Verify non-member cannot edit/delete/void.
- Verify service role and RLS bypass are not used.
- Verify split rows stay consistent after amount, payer, type, or split changes.
- Verify date changes across months update both month contexts correctly.
- Verify duplicate submissions are safe.
- Verify a pending replacement month is blocked or handled according to the
  final product decision.
- Verify record creation behavior is unchanged.
- Verify `calculateSettlement` amount rules are unchanged.
- Verify `getSettlementSummary` read semantics are unchanged.

Suggested future static checks:

- Search changed mutation files for service role, admin auth, direct
  `allowed_user_emails`, localStorage/sessionStorage, broad settlement snapshot
  updates, and payment-provider language.
- Confirm only the intended ledger mutation files and UI files changed.
- Confirm no migration is mixed into helper/UI tasks unless the task explicitly
  asks for that migration.

## Open Questions Needing Human Decision

1. Should V1 use hard delete, or soft delete / void?
2. Should settled-month edit/delete require extra confirmation?
3. Should deleting records from fully confirmed months be allowed at all?
4. Should edit/delete be disabled when a pending replacement exists?
5. Should amount/date/type changes require re-entering splits?
6. Should record edit preserve original `created_by`?
7. Should `updated_by` / `updated_at` be tracked and shown?
8. Should delete/void require a reason or note?
9. Should V1 support edit only and defer delete/void?
10. Should edit/delete be available to both members or only the original
    creator?
11. Should moving a record between months require separate confirmation when
    either month is settled?
12. Should custom split editing wait until custom split creation exists?
13. Should a voided record remain directly viewable from old detail links?
14. Should replacement settlement be required immediately after a settled-month
    correction, or simply offered as the next step?

## Future Stop Conditions

Stop and write a follow-up decision note instead of implementing if:

- the task would mutate settlement snapshots directly
- the task would require service role or Supabase admin API in app code
- the task would bypass RLS
- parent entry and split rows cannot be updated atomically
- settled-month copy or pending-replacement behavior is undecided
- hard delete vs soft delete is still undecided and the implementation needs
  that choice
- the implementation would change `calculateSettlement` amount rules
- the implementation would rewrite `getSettlementSummary` read semantics
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
- `npm run build` passes, or any failure is reported with evidence.
