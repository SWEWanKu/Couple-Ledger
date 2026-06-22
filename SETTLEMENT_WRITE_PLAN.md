# Settlement Write / Confirmation Plan

> **For agentic workers:** This document is a planning artifact only. Do not implement payment confirmation, marked-as-settled state, database changes, RLS changes, API routes, server actions, or UI write controls from this document unless a later task explicitly asks for that implementation step.

## Goal

Design a future settlement confirmation capability for the private two-person Couple Ledger app.

The feature should eventually let household members record that a monthly settlement suggestion was paid or otherwise resolved. This plan does not implement that capability. It documents the product behavior, data model direction, RLS direction, edge cases, tests, rollout steps, and open human decisions needed before implementation.

## Current Baseline Inspected

Files inspected for this plan:

- `AGENTS.md`
- `SETTLEMENT_READ_PLAN.md`
- `src/lib/settlement/calculate-settlement.ts`
- `src/lib/settlement/get-settlement-summary.ts`
- `src/types/settlement.ts`
- `src/app/settlement/page.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/records/page.tsx`
- `src/app/records/[id]/page.tsx`
- `src/app/records/new/page.tsx`
- `src/lib/ledger/create-record.ts`
- `src/lib/ledger/create-expense.ts`
- `src/lib/ledger/list-records.ts`
- `src/lib/ledger/get-record-detail.ts`
- `supabase/migrations/20260620_create_initial_schema_enable_rls.sql`
- `supabase/migrations/20260620_add_rls_helper_functions.sql`
- `supabase/migrations/20260620_add_rls_policies.sql`
- `SUPABASE_SECURITY_PLAN.md`
- `SUPABASE_ADMIN_INIT_RUNBOOK.md`

Current implementation facts:

- `/settlement` is a protected server page.
- `/settlement` calls `getSettlementSummary(supabase, { householdId, currentUserId, month })`.
- `getSettlementSummary` reads household members, profiles, monthly expense entries, and split rows.
- `calculateSettlement` is the only amount-rule authority for paid/share/net/transfer math.
- `calculateSettlement` converts money to integer cents internally and returns display strings with two decimals.
- Record creation writes `ledger_entries` plus `ledger_entry_splits`; settlement read logic treats split rows as the source of truth.
- Existing schema has no settlement table, settlement status, payment confirmation row, or settlement history table.
- Existing RLS policies scope app data by allowed users and household membership.
- `allowed_user_emails` is intentionally admin-managed and has no client-facing policies.

## Non-Goals For This Task

This document does not add:

- payment confirmation
- marked-as-settled behavior
- settlement tables
- migrations
- SQL execution
- RLS policies
- API routes
- server actions
- UI buttons
- changes to `/settlement`
- changes to `/dashboard`
- changes to `calculateSettlement`
- changes to `getSettlementSummary`
- service role usage
- localStorage data authority

## Desired Product Behavior

The future feature should feel like adding a stamped note to a monthly island ledger:

- A household member opens `/settlement?month=YYYY-MM`.
- The page still calculates the current read-only suggestion through `getSettlementSummary`.
- If the calculation is ready, the UI may show a future action such as recording that the suggested transfer was handled.
- When recorded, the app creates a durable settlement confirmation snapshot for that household and month.
- Later visits can show both:
  - the current live calculation for the month
  - the historical confirmation snapshot, if one exists
- The user-facing copy should make clear that this is an app note, not a bank transfer or payment provider integration.

The feature should not pretend to move money. It only records a household note that the two people consider the settlement handled.

## Definition Of Settled

Recommended definition:

> A month is settled when the household has a finalized settlement confirmation snapshot for that month, created from a ready calculation result, and the required confirmer rule for that snapshot has been satisfied.

This definition has several important consequences:

- Settled is a status of a settlement snapshot, not a status of individual ledger entries.
- A snapshot should contain the amount and direction that were accepted at that time.
- Later ledger edits should not silently mutate the already-confirmed historical result.
- The live read-only helper can still recalculate the month and warn that the current ledger no longer matches the settled snapshot.
- Settlement confirmation should be household-scoped and month-scoped.

Do not define settled as "all entries in this month are locked" unless a later product decision explicitly introduces ledger locking.

## Snapshot Versus Live Recalculation

Recommendation: confirmed settlements should be immutable snapshots with a separate live comparison.

Why snapshots:

- A confirmation is a historical agreement between the two people at a point in time.
- Live recalculation can change if someone adds, edits, or removes a record after confirmation.
- A historical page should answer "what did we agree was settled then?" without being rewritten by later ledger changes.
- Snapshot storage avoids arguing with old months when current data has changed.

What remains live:

- `/settlement` should continue to use `getSettlementSummary` for the current calculation.
- A future history section can compare `snapshot.totalExpense` and `snapshot.transferAmount` against the current helper result for the same month.
- If the live result differs from the snapshot, show a gentle "账本后来有变动" notice instead of mutating the snapshot.

## Proposed Future Data Model

No tables are created by this plan. The following is a future schema direction only.

### `settlement_periods`

Purpose:

- One durable monthly settlement snapshot per household and month.
- Stores the accepted calculation summary and lifecycle status.

Proposed columns:

| Column | Purpose |
| --- | --- |
| `id` | Primary identifier. |
| `household_id` | Household boundary and RLS scope. |
| `month` | Canonical `YYYY-MM` key. |
| `month_start` | Date-only start boundary used by the snapshot. |
| `next_month_start` | Date-only exclusive end boundary. |
| `status` | Suggested values: `draft`, `pending_partner`, `settled`, `voided`. |
| `total_expense_cents` | Snapshot of included expense total in integer cents. |
| `transfer_from_user_id` | Snapshot debtor, nullable when no transfer is needed. |
| `transfer_to_user_id` | Snapshot creditor, nullable when no transfer is needed. |
| `transfer_amount_cents` | Snapshot transfer amount in integer cents. |
| `calculation_status` | Snapshot of `calculateSettlement.status`. |
| `calculation_warnings` | Snapshot warnings as structured JSON. |
| `member_balances` | Snapshot paid/share/net by member as structured JSON using cents. |
| `source_entry_ids` | Included expense entry ids at confirmation time. |
| `source_entry_count` | Count of included expense entries. |
| `source_fingerprint` | Deterministic fingerprint of included entries and split amounts. |
| `created_by` | User who started the confirmation. |
| `created_at` | Creation timestamp. |
| `settled_at` | Timestamp when status becomes `settled`. |
| `voided_at` | Timestamp when a snapshot is explicitly voided, if supported later. |

Recommended constraints:

- One active non-voided settlement per `household_id` and `month`.
- `month_start` and `next_month_start` must match the canonical `month`.
- `transfer_amount_cents` must be non-negative.
- Transfer users, when present, must be members of the same household.
- `settled` snapshots should have `settled_at`.

### `settlement_confirmations`

Purpose:

- Records who confirmed a settlement snapshot.
- Supports either one-person mark-as-paid or two-person confirmation, depending on the human decision.

Proposed columns:

| Column | Purpose |
| --- | --- |
| `id` | Primary identifier. |
| `settlement_period_id` | Parent settlement snapshot. |
| `household_id` | Denormalized household scope for simpler checks and indexes. |
| `confirmed_by` | Household member who confirmed. |
| `confirmation_role` | Suggested values: `payer`, `receiver`, `member`. |
| `note` | Optional short household note. |
| `created_at` | Confirmation timestamp. |

Recommended constraints:

- A member can confirm the same settlement snapshot only once.
- `confirmed_by` must be a member of the parent household.
- The confirmation's `household_id` must match the parent snapshot.

### Optional Later Audit Table

If edits to old settled months become common, consider a later `settlement_events` table for a small audit trail:

- created
- partner_confirmed
- voided
- recalculation_mismatch_detected

Do not add this table in the first write implementation unless the product decision requires visible history from day one.

## RLS Direction

Future settlement tables should follow the same security posture as current household tables:

- authenticated users only
- allowed users only
- household membership is the app data boundary
- no client access to `allowed_user_emails`
- no service role in app code
- no bypass of existing RLS helpers

Suggested future helper needs:

- `is_household_member(household_id)` can cover most settlement snapshot reads and writes.
- A future helper may be needed to check that a user belongs to the household of a settlement parent row.
- If transfer users are checked in RLS, helper functions should verify both users belong to the same household.

Suggested policy behavior:

- Household members can read settlement snapshots and confirmations for their household.
- Household members can create a settlement snapshot only for their household.
- Household members can create their own confirmation rows only for their household.
- Normal clients should not hard-remove settled snapshots.
- Voiding, if supported, should be either owner-only or member-only with a separate confirmation rule.
- Cross-household rows must never be visible or mutable.

## Write Permissions

Recommended first implementation:

- Any household member may start a settlement confirmation snapshot for a ready monthly calculation.
- Any household member may add their own confirmation row.
- A member may not create a confirmation row for the other person.
- A member may not confirm a snapshot outside their household.
- A member may not change transfer amount, transfer direction, or member balances after the snapshot is created.

This mirrors the current app's simple two-person trust model while preserving database-level household boundaries.

## One-Person Versus Two-Person Confirmation

There are two viable product models.

### Option A: One-Person Mark-As-Handled

One household member records that the settlement was handled, and the snapshot becomes `settled` immediately.

Pros:

- Faster daily use.
- Fits the private two-person trust model.
- Less UI and fewer edge states.

Cons:

- The other person has no explicit acknowledgment in app history.
- Accidental confirmation needs a clear void path.

### Option B: Two-Person Confirmation

One member starts confirmation; the other member also confirms before the snapshot becomes `settled`.

Pros:

- Better shared accountability.
- More precise if the app later becomes the historical source of truth.

Cons:

- More UI complexity.
- More states: pending, confirmed by one side, fully settled, expired/voided.
- Requires careful copy so it does not feel like a corporate approval flow.

Recommendation for first write version:

- Choose Option A if this remains a private couple app with high trust.
- Choose Option B only if the user explicitly wants mutual acknowledgment.
- Until that decision is made, the implementation should not start.

## Idempotency And Duplicate Prevention

Future write code must prevent duplicate confirmations caused by double-clicks, retries, browser refreshes, or two tabs.

Recommended approach:

- Use `household_id + month + source_fingerprint` as the business identity for an active snapshot.
- Enforce one active non-voided settlement per household/month.
- Enforce one confirmation per member per settlement snapshot.
- If the same request is repeated, return the existing snapshot or confirmation rather than creating duplicates.
- Generate the snapshot fingerprint from the exact included expense ids, amounts, payer ids, and split rows.

Application behavior:

- The UI should disable the action while the request is pending.
- The server should still be safe if the user bypasses the UI or submits twice.
- If a duplicate is detected, show the existing settlement state instead of an error that sounds like data loss.

## Changed Ledger Entries After Confirmation

Recommended behavior:

- Do not mutate a confirmed settlement snapshot when ledger entries change.
- Keep the old snapshot as the historical agreement.
- Recompute the live month via `getSettlementSummary`.
- Compare the live result to the snapshot fingerprint.
- If different, show a "账本后来有变动" notice with a future option to create a new settlement snapshot or void the old one.

Potential later policies:

- Allow ledger edits after settlement, but show mismatch warnings.
- Or lock settled months from normal ledger edits.

Recommendation:

- Do not lock entries in the first settlement write version.
- Add mismatch detection first.
- Consider month locking only after real use shows that old-month edits cause confusion.

## Month Boundaries

Future write logic should reuse the same month metadata concept as `getSettlementSummary`:

- `month` accepts only canonical `YYYY-MM`.
- Invalid or missing month should not create a settlement snapshot.
- Snapshot creation should use helper-derived `monthStart` and `nextMonthStart`.
- The snapshot should store both the month key and date boundaries.
- Boundary semantics should remain `occurred_on >= monthStart` and `occurred_on < nextMonthStart`.

Do not create settlement snapshots from client-only date math. The server should own the month normalization and boundary creation.

## Preserving `calculateSettlement` Rules

Future write code must call the existing read helper or a shared lower-level read/calculation path before creating a snapshot.

Rules to preserve:

- Expense entries only affect settlement.
- Income entries are ignored for settlement debt.
- Paid amount comes from `ledger_entries.paid_by`.
- Share amount comes from persisted `ledger_entry_splits`.
- `split_mode` is not an authority for recalculating shares.
- Missing or mismatched split rows make the calculation incomplete.
- More than two members remains unsupported for a transfer shortcut until separately designed.
- The pure helper's cents conversion and final display logic must remain unchanged unless a dedicated amount-rule task changes it.

Snapshot creation should be blocked when:

- `calculation.status` is `incomplete`.
- `calculation.status` is `unsupported_member_count`.
- Warnings indicate the included split data is incomplete.

For `no_settlement_needed`, the product can still allow a settled snapshot with zero transfer amount if the user wants monthly history.

## Money Storage

Recommended storage for future settlement snapshots:

- Store all snapshot money values as integer cents.
- Keep display formatting outside the database row.
- Use the existing `calculateSettlement` amount strings only as inputs for conversion to cents in the future write helper.
- Store structured member balances in cents, not floats.
- If Postgres `numeric(12,2)` is used for compatibility, convert to cents in application logic before comparisons.

Why cents:

- It avoids binary floating-point drift.
- It matches the pure helper's internal rules.
- It makes fingerprinting and duplicate detection deterministic.

## Read-Only History Later

A future history view should remain separate from the write action.

Suggested read-only surfaces:

- `/settlement` shows the current month and the latest settlement snapshot for that month.
- A future `/settlement/history` lists monthly settlement snapshots.
- A future `/settlement/history/[id]` shows one immutable snapshot.

History should display:

- month label
- status
- who confirmed
- confirmation time
- transfer direction and amount
- member paid/share/net snapshot
- whether the current live ledger still matches the snapshot fingerprint

Do not show history as a financial audit system. Keep the copy warm and household-oriented.

## Future UI Direction

No UI changes are made by this plan.

When implemented later, visible UI should follow `AGENTS.md`:

- use `animal-island-ui` as the primary UI foundation
- preserve scrapbook / island notebook / sticker / parchment style
- avoid admin dashboard language
- avoid payment-provider wording

Possible future labels:

- `记录为已结算`
- `这个月已经对齐啦`
- `等待另一位小岛成员确认`
- `账本后来有变动`

Avoid labels:

- `付款成功`
- `支付确认`
- `收款审核`
- `财务审批`

## Future Test Plan

### Pure Calculation Regression

Keep existing `calculateSettlement` examples passing:

- no entries
- income-only month
- one equal expense paid by owner
- one equal expense paid by partner
- personal expense
- mixed income and expense
- opposite payers
- missing split rows
- split mismatch
- one member
- more than two members

### Snapshot Creation Tests

Future tests should cover:

- ready calculation creates one snapshot for the household/month.
- ready calculation stores transfer direction and amount exactly.
- zero-transfer month can be recorded if the product decision allows it.
- incomplete calculation cannot become settled.
- unsupported member count cannot become settled.
- repeated request does not create duplicate active snapshots.
- repeated member confirmation does not create duplicate confirmation rows.
- confirmation from a non-member is rejected by RLS.
- confirmation for another household is rejected by RLS.
- confirmation cannot spoof another member as `confirmed_by`.

### Changed Ledger Tests

Future tests should cover:

- adding a ledger entry after settlement leaves the old snapshot unchanged.
- changing a split after settlement leaves the old snapshot unchanged.
- live helper detects a different fingerprint for the same month.
- UI history can show the snapshot and mismatch notice without modifying data.

### Integration / Route Tests

Future implementation should verify:

- anonymous user cannot create or view private settlement data.
- authenticated non-member redirects or is blocked consistently with existing private pages.
- household member can view settlement history for their household.
- household member cannot view or mutate another household's settlement rows.
- service role is not used.
- localStorage is not a data source.

### Static Safety Checks

Future implementation tasks should run targeted checks for:

- no service role in app code
- no direct app query of `allowed_user_emails`
- no localStorage data authority
- no mutation outside the dedicated future settlement write helper/action
- no change to `calculateSettlement` amount rules unless that is the explicit task

## Rollout Plan

Each step should be its own branch, commit, verification, and review.

### Step 1: Data Design Migration

Future task:

- Add settlement snapshot and confirmation tables.
- Add indexes and constraints.
- Enable RLS.
- Do not wire UI.
- Verify anonymous and cross-household access is blocked.

### Step 2: RLS Policies

Future task:

- Add narrowly scoped policies for settlement tables.
- Reuse household membership checks.
- Keep `allowed_user_emails` admin-only.
- Verify normal authenticated clients can only access their household rows.

### Step 3: Pure Snapshot Builder

Future task:

- Add a pure helper that converts `SettlementSummary` into a snapshot payload.
- Preserve `calculateSettlement` output and amount rules.
- Add deterministic examples for fingerprint generation and cents conversion.

### Step 4: Server Write Helper

Future task:

- Add one server-only helper for snapshot creation and confirmation.
- It must verify household membership first.
- It must call the existing settlement summary path or shared read path.
- It must block incomplete or unsupported calculations.
- It must be idempotent.

### Step 5: Minimal UI Action

Future task:

- Add one Animal-Island-style action to `/settlement`.
- Keep copy gentle and explicit that this records a household note.
- Do not add payment-provider integration.
- Do not add broad dashboard navigation changes in the same step.

### Step 6: Read-Only History

Future task:

- Add history display after write behavior is stable.
- Show immutable snapshots.
- Show mismatch notices when live ledger differs from the snapshot.

### Step 7: Optional Void / Reopen Flow

Future task only if needed:

- Add a way to void a mistaken settlement snapshot.
- Decide whether one member can void or both must acknowledge.
- Preserve history rather than hard-removing rows.

## Open Questions For Human Decision

These decisions should be answered before implementation begins:

1. Should one member be able to mark a month settled, or should both members confirm?
2. Should zero-transfer months be recordable as settled history?
3. If a settled month later changes, should the app only warn, or should it require voiding and re-settling?
4. Should settled months lock ledger edits, or should the app allow edits with mismatch notices?
5. Should settlement history be visible on `/settlement`, a separate history page, or both?
6. Should confirmations allow a short note?
7. Should only the debtor be able to start the confirmation, or can either member do it?
8. Should a mistaken settlement be voidable by one member or require both members?
9. Is CNY cents storage sufficient for the foreseeable future, or should a currency column be introduced with settlement tables?
10. Should the first implementation support only the current two-person household, or design the schema for more members while keeping UI limited?

## Stop Conditions For Future Implementation

Stop and write a follow-up design note instead of implementing if:

- one-person versus two-person confirmation is undecided
- immutable snapshot versus live-only state is undecided
- old-month ledger edit behavior is undecided
- exact money unit storage is unclear
- RLS cannot express household-scoped writes safely
- implementation requires service role credentials in app code
- implementation requires changing `calculateSettlement` rules
- implementation requires broad UI/navigation changes outside the focused task

## Current Task Verification Checklist

This current task is complete only if:

- `SETTLEMENT_WRITE_PLAN.md` is the only changed file.
- No source code changes exist.
- No migration files exist or changed for this task.
- No SQL was executed.
- No RLS was changed.
- No API route or server action was added.
- No database write logic was added.
- No service role was used.
- No localStorage data source was introduced.
- No `.env.local` change is staged or committed.
- `calculateSettlement` remains unchanged.
