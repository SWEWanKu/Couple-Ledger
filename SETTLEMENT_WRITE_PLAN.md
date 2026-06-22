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

## V1 Locked Decisions

These decisions are locked for the first settlement write/confirmation version unless a later task explicitly changes this plan before implementation.

1. Settlement records are immutable monthly snapshots.
   - A confirmed settlement preserves the calculated result at the time the snapshot is created.
   - The snapshot must not silently change when ledger entries are later edited, added, or deleted.
   - Settled state belongs to the snapshot, not to each individual ledger entry.

2. Live recalculation remains read-only.
   - `/settlement` may continue to show the current live calculation from `getSettlementSummary`.
   - Future settlement history must read from stored snapshots.
   - If live calculation differs from an existing snapshot, future UI should show an outdated-snapshot warning instead of mutating the snapshot.

3. Amounts are stored as integer cents.
   - Do not store settlement money as floats.
   - Do not change `calculateSettlement` amount rules.
   - Future persistence must convert current helper output amounts according to existing project money-unit conventions and store exact cents.

4. V1 confirmation requires both household members.
   - One household member may propose/create a settlement snapshot.
   - Each household member must confirm the same snapshot.
   - The settlement becomes fully `settled` only after both household members have confirmed.
   - V1 does not allow one person to unilaterally mark the month as settled.

5. V1 supports one active settlement snapshot per household/month.
   - Future schema should use idempotency and unique constraints to prevent duplicate active monthly snapshots.
   - A future void/supersede flow can be planned separately.
   - V1 must not implement void/supersede unless a later task explicitly requires it.

6. Ledger changes after settlement do not rewrite the settlement.
   - Later ledger changes can make the old snapshot appear potentially outdated.
   - A future flow may allow a new superseding snapshot.
   - Old confirmed snapshot amounts must not be auto-updated.

7. RLS direction is household-member scoped.
   - Only authenticated members of the same household can read settlement snapshots for that household.
   - Only authenticated members of the same household can create or confirm settlement snapshots.
   - Do not use service role in app code.
   - Do not bypass RLS.

8. Idempotency is required.
   - Future schema must prevent duplicate confirmations by the same user.
   - Future schema must prevent duplicate active monthly settlements for the same household/month.
   - Future write helpers/actions must be safe to retry.

9. V1 UI remains future work.
   - Keep `/settlement` as live read-only until a later write task begins.
   - Future confirmation UI must clearly distinguish live calculation, proposed snapshot, fully settled snapshot, and outdated snapshot warning.
   - Do not add payment or settlement-confirmation UI in this decision-locking task.

10. Rollout is split into small focused tasks.
    - Step 1: schema + RLS migration only.
    - Step 2: generated Supabase types, if the project starts using generated database types.
    - Step 3: server-side write helper/action with tests.
    - Step 4: read historical snapshots.
    - Step 5: UI confirmation flow.
    - Step 6: outdated snapshot warning.

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
- V1 uses this table for two-person confirmation: each household member confirms the same snapshot before it becomes fully settled.

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
- For V1, the parent settlement should move to `settled` only after both household members have confirmation rows.

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
- A snapshot remains pending until both household members have confirmed it.
- A single member confirmation must not mark the month fully settled in V1.

This mirrors the current app's simple two-person trust model while preserving database-level household boundaries.

## V1 Confirmation Model

V1 is locked to two-person confirmation.

One household member can propose/create a monthly settlement snapshot. The snapshot stores the calculation result and starts in a pending state. Each household member then confirms the same snapshot with their own confirmation row. The snapshot becomes fully `settled` only after both household members have confirmed.

This avoids unilateral settlement while keeping the feature understandable for the current private two-person household.

One-person mark-as-handled remains a non-V1 alternative. It should not be implemented unless this plan is explicitly changed in a later decision task.

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

### Step 1: Schema + RLS Migration Only

Future task:

- Add settlement snapshot and confirmation tables.
- Add indexes and constraints.
- Enable RLS.
- Do not wire UI.
- Do not add server actions or API routes.
- Verify anonymous and cross-household access is blocked.

### Step 2: Generated Supabase Types, If Used

Future task:

- If the project adopts generated Supabase database types, regenerate them after the migration.
- Do not hand-edit generated type output.
- Skip this step if the project still does not use generated database types.

### Step 3: Server-Side Write Helper / Action With Tests

Future task:

- Add one server-side write path for snapshot creation and member confirmation.
- It must verify household membership first.
- It must call the existing settlement summary path or shared read path.
- It must block incomplete or unsupported calculations.
- It must be idempotent.
- It must preserve `calculateSettlement` output and amount rules.
- It must include tests for duplicate snapshot and duplicate confirmation prevention.

### Step 4: Read Historical Snapshots

Future task:

- Add read helpers for settlement snapshots and confirmations.
- Keep reads household-scoped and RLS-backed.
- Show immutable stored snapshot data separately from live calculation data.

### Step 5: UI Confirmation Flow

Future task:

- Add one Animal-Island-style action to `/settlement`.
- Keep copy gentle and explicit that this records a household note.
- Clearly distinguish proposed snapshot, current user's confirmation, partner confirmation, and fully settled state.
- Do not add payment-provider integration.
- Do not add broad dashboard navigation changes in the same step.

### Step 6: Outdated Snapshot Warning

Future task:

- Compare the stored snapshot fingerprint with the current live calculation.
- If they differ, show an outdated-snapshot warning.
- Do not mutate the stored snapshot.

### Deferred Beyond V1: Void / Reopen / Supersede Flow

Plan separately if needed:

- Add a way to void or supersede a mistaken settlement snapshot.
- Decide whether one member can void or both must acknowledge.
- Preserve history rather than hard-removing rows.

## Decision Status

### Resolved For V1

These decisions are no longer open for the first implementation:

1. Settlement records are immutable monthly snapshots.
2. Live recalculation stays read-only and does not mutate snapshots.
3. Settlement money is persisted as integer cents, not floats.
4. V1 requires both household members to confirm the same snapshot.
5. One member may propose/create the snapshot, but one member alone cannot make it fully settled.
6. V1 supports one active settlement snapshot per household/month.
7. Ledger changes after settlement do not rewrite old snapshot amounts.
8. Later ledger changes should produce an outdated-snapshot warning.
9. Settlement snapshot reads/writes are scoped to authenticated members of the same household.
10. No service role and no RLS bypass are allowed in app code.
11. Future writes must be retry-safe and idempotent.
12. `/settlement` remains live read-only until a later write/UI task.
13. V1 rollout follows schema/RLS first, then optional generated types, write helper/action tests, historical reads, UI confirmation flow, and outdated warning.

### Deferred Beyond V1

These ideas remain useful but should not be implemented in V1 unless a later decision changes scope:

1. A void, reopen, or supersede flow for mistaken snapshots.
2. One-person mark-as-handled mode.
3. Hard locking ledger edits after a month is settled.
4. Multi-member transfer simplification beyond the current two-person household.
5. A separate `/settlement/history` route or `/settlement/history/[id]` detail route.
6. Full settlement event audit trail beyond snapshot and confirmation rows.
7. Currency expansion beyond the current money-unit convention.

### Still Needs Human Decision

These choices can be decided before or during later implementation tasks:

1. Should zero-transfer months be recordable as settled history?
2. Should confirmations include an optional short note?
3. Should the V1 history display live only on `/settlement`, or should a separate history route be added in a later read task?
4. What exact user-facing Chinese copy should distinguish proposed, pending, fully settled, and outdated states?
5. Should the first migration include only the minimum settlement snapshot/confirmation tables, or also include optional event/audit groundwork as disabled future-proofing?

## Stop Conditions For Future Implementation

Stop and write a follow-up design note instead of implementing if:

- a future task attempts to switch V1 back to one-person settlement without a decision update
- a future task attempts live-only settlement state instead of immutable snapshots
- a future task attempts to auto-update old confirmed snapshot amounts after ledger edits
- exact money-unit conversion conflicts with the current `calculateSettlement` conventions
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
