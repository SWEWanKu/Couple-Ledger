# Settlement V2 Change-Management Plan

> Planning document only. This file does not implement Settlement V2. Do not add
> schema changes, RLS changes, UI changes, API routes, server actions, write
> helpers, SQL execution, service role usage, payment-provider behavior, or
> `localStorage` data authority from this document unless a later task explicitly
> asks for that implementation step.

## Goal

Define how Settlement V2 should handle ledger changes after a settlement
snapshot has already been fully confirmed.

V1 gives the app a durable two-person settlement snapshot:

- `settlement_snapshots` stores immutable monthly amounts, transfer direction,
  calculation status, source fingerprint, and snapshot JSON.
- `settlement_confirmations` stores each member's confirmation for one snapshot.
- Fully confirmed means both household members confirmed that stored snapshot.
- The current V1 schema allows only one snapshot per `household_id` and
  `month_start`.

The V2 problem is change management: if someone adds or changes ledger records
after a month is fully confirmed, the app must not silently rewrite the old
agreement. It needs a clear, safe way to show that the live calculation has
changed and, if both people want, create a new replacement snapshot.

## Non-Goals

This plan does not implement:

- database migrations
- SQL execution
- RLS changes
- API routes
- server actions
- write helpers
- UI changes
- dashboard or records changes
- payment confirmation
- real money transfer behavior
- service role usage
- Supabase admin API usage
- RLS bypass
- generated Supabase Database types
- `calculateSettlement` amount-rule changes
- `getSettlementSummary` query-semantic changes

## Product Problem

V1 snapshots are immutable. A fully confirmed snapshot records what both people
accepted at the time. Later ledger changes can make the current live calculation
different from that accepted snapshot.

V2 must support this without corrupting the story:

- Old confirmed amounts must stay as historical notes.
- The live `/settlement` calculation may become different.
- The app should warn gently when the active snapshot is outdated.
- A household member may propose a replacement snapshot.
- The replacement must go through its own confirmations.
- History must preserve both the old snapshot and the replacement.

The product language should stay in the island notebook / household memo world.
Avoid payment-provider wording such as "payment succeeded", "bank transfer",
"charge", "refund", or "real transfer".

## Vocabulary

- **Confirmed snapshot**: a stored settlement snapshot that has enough
  confirmation rows for the required household members.
- **Active snapshot**: the current authoritative stored snapshot for a
  household/month.
- **Outdated warning**: a read-only notice shown when the active snapshot's
  canonical source fingerprint no longer matches the live calculation.
- **Replacement snapshot**: a new snapshot proposed for a month whose active
  snapshot is outdated or otherwise needs re-alignment.
- **Pending replacement snapshot**: a replacement snapshot waiting for all
  required confirmations.
- **Superseded snapshot**: an old snapshot that remains readable but is no
  longer the active snapshot because a replacement became active.
- **Voided snapshot**: future-reserved vocabulary for a proposed or mistaken
  snapshot that should remain in history but not count as active.
- **Reopened month**: optional product wording for a month whose active snapshot
  is outdated and awaiting a replacement decision.

## Current V1 Constraints To Respect

- Current migration `20260622_add_settlement_schema_rls.sql` creates
  `unique (household_id, month_start)` on `settlement_snapshots`.
- V1 has no update or delete policies for settlement snapshots or confirmations.
- Snapshot amount data is immutable from normal browser clients.
- Current status helpers derive `proposed`, `partially_confirmed`, and
  `fully_confirmed` from confirmation rows.
- Current outdated warning compares a freshly built snapshot payload fingerprint
  with the stored snapshot fingerprint.
- Current fingerprint intentionally excludes display names, profile fields,
  confirmation rows, and UI query params.

## V2 Locked Decisions

These decisions are locked for the first V2 implementation pass. Later tasks
should treat this section as the source of truth unless a new decision document
explicitly changes it.

1. Proposing a replacement snapshot does not auto-confirm the proposer.
   Proposal and confirmation remain separate actions. Both members must
   explicitly confirm the replacement snapshot.
2. The old active snapshot is superseded only after the replacement snapshot is
   fully confirmed. While the replacement is proposed or partially confirmed,
   the old snapshot remains the active snapshot and the UI may show a pending
   replacement note beside it.
3. V2 initial scope allows one `active` snapshot and at most one
   `pending_replacement` snapshot per household/month. Multiple replacement
   cycles over time are allowed only after the previous replacement becomes
   active. Concurrent replacement drafts are deferred beyond V2.
4. V2 initial implementation does not include a void/cancel replacement flow.
   `voided` may be reserved as future-compatible vocabulary, but it must not be
   exposed in V2 UI or write flows.
5. Replacement is allowed for any historical month that has an active
   settlement snapshot. It is not restricted to the current month. Ledger
   changes do not automatically create replacement snapshots.
6. V2 status vocabulary is explicit: `active`, `pending_replacement`, and
   `superseded`. `voided` is optional future-reserved vocabulary. Code must not
   infer current or old status from timestamps alone.
7. The V1 `unique (household_id, month_start)` constraint must be replaced with
   partial unique indexes: one active snapshot per household/month and one
   pending replacement snapshot per household/month. Superseded historical rows
   must not block new active rows.
8. Confirmations belong to the exact `settlement_snapshot_id`. Old
   confirmations do not carry to a replacement. Fully confirmed means all
   current household members required by the app confirmed that exact snapshot.
9. Replacement transitions are:
   - create replacement: insert a `pending_replacement` snapshot while the old
     active snapshot remains active
   - confirm replacement: insert a confirmation for the current authenticated
     user and exact snapshot
   - when the replacement is fully confirmed: atomically transition the old
     active snapshot to `superseded` and the replacement snapshot to `active`
   - use the normal authenticated Supabase client and RLS; no service role or
     RLS bypass
10. Fingerprints continue to represent canonical calculation-relevant data.
    They exclude display names/profile fields, confirmation state, UI query
    params, and `created_at` unless a future decision changes this. Preserve the
    V1 false-positive fix.
11. UI behavior:
    - `/settlement` shows live calculation, active snapshot, any pending
      replacement, and an outdated warning when the live calculation differs
    - `/settlement/history` labels `active`, `pending_replacement`, and
      `superseded` snapshots
    - settlement snapshot detail pages label archived state clearly
    - records awareness reminds users that old snapshots are immutable
12. Rollout stays independently verifiable:
    decision doc lock, schema/RLS migration, read helpers, replacement snapshot
    payload builder, propose replacement helper/action, confirmation transition
    logic, UI pending replacement/outdated active, history/detail labels, and
    regression checklist update.

## Recommended V2 Product Rule

Never edit old snapshot amounts and never delete old snapshots.

When ledger data changes after settlement:

1. Keep the old active snapshot unchanged.
2. Recalculate the month live through the existing settlement read path.
3. Compare the live fingerprint with the active snapshot fingerprint.
4. If they differ, show an outdated warning.
5. Let a household member propose a replacement snapshot.
6. Require fresh confirmations for the replacement snapshot.
7. Promote the replacement to active only after it is fully confirmed.
8. Mark the old active snapshot as superseded at the same time.
9. Keep both snapshots visible in history.

A proposed replacement should not immediately supersede the old fully confirmed
snapshot. The old snapshot should remain active until the replacement is fully
confirmed, because it is still the last mutually accepted settlement note.

## Schema Direction

Choose the smallest schema shape that preserves V1 snapshots as immutable amount
records while adding explicit lifecycle metadata.

Recommended metadata on `settlement_snapshots`:

- `lifecycle_status` with values `active`, `pending_replacement`,
  `superseded`, and future-reserved `voided`
- `replacement_of_snapshot_id` pointing from a replacement to the old snapshot
- `superseded_by_snapshot_id` pointing from the old snapshot to the replacement
- `superseded_at`
- optional future `voided_at`
- optional future `voided_by`

This keeps history and detail pages readable from `settlement_snapshots`, avoids
a large event model for V2, and makes lifecycle changes explicit without making
amount fields mutable.

A fuller `settlement_snapshot_versions` or lifecycle event table can be
revisited later if the app needs a visible audit timeline.

## Unique Constraint Strategy

V1 enforces one snapshot per household/month with:

```sql
unique (household_id, month_start)
```

V2 needs multiple snapshots for the same household/month over time, while still
allowing only one active snapshot and one pending replacement snapshot.

Recommended future migration direction:

1. Add lifecycle metadata columns with a safe default that treats existing rows
   as `active`.
2. Backfill existing V1 rows to `lifecycle_status = 'active'`.
3. Add a partial unique index for one active snapshot:

   ```sql
   create unique index settlement_snapshots_one_active_month_idx
   on public.settlement_snapshots (household_id, month_start)
   where lifecycle_status = 'active';
   ```

4. Add a partial unique index for one pending replacement snapshot per
   household/month:

   ```sql
   create unique index settlement_snapshots_one_pending_replacement_month_idx
   on public.settlement_snapshots (household_id, month_start)
   where lifecycle_status = 'pending_replacement';
   ```

5. Keep `superseded` historical rows outside those partial unique indexes so
   old history does not block a new active snapshot.
6. Drop the V1 `unique (household_id, month_start)` constraint after the new
   indexes are in place.

Migration risks:

- Dropping the old unique constraint is the point of no return for multiple
  snapshots per month.
- A rollback to V1 uniqueness is only safe if no month has multiple snapshots.
- If multiple snapshots already exist, rollback must be a manual data decision,
  not an automatic destructive cleanup.
- The migration should be reviewed with production data assumptions before it
  is applied.

Rollback recommendation:

- Prefer roll-forward repair for lifecycle metadata mistakes.
- Do not write a down migration that deletes replacement snapshots.
- If rollback is necessary before any replacement rows exist, recreate the old
  unique constraint after verifying no duplicates exist.

## RLS Direction

V2 should keep the current security posture:

- Household members can read snapshots for their household.
- Household members can propose replacement snapshots for their household.
- Household members can confirm replacement snapshots for their household.
- Household members can transition a fully confirmed `pending_replacement`
  snapshot to `active` only through the intended constrained path.
- No service role.
- No Supabase admin API.
- No RLS bypass.
- No admin-only mutation path.

Recommended policy direction:

- `select`: authenticated allowed household members can read snapshots and
  confirmations for their household.
- `insert replacement snapshot`: authenticated allowed household members can
  insert a replacement row only when the replaced snapshot belongs to the same
  household/month.
- `insert confirmation`: authenticated allowed household members can confirm
  only as themselves.
- `update lifecycle metadata`: if needed, allow only tightly constrained updates
  to lifecycle fields, never amount fields or snapshot JSON.

Because Postgres RLS cannot protect individual columns by itself, V2 should add
database-level guards before any metadata update path ships:

- a trigger or check strategy that prevents changes to immutable amount fields
  after insert
- explicit helper/RPC or server helper logic that only promotes replacement
  snapshots through the intended lifecycle transition
- no broad client-side `.update()` path that can touch `snapshot`,
  `total_expense_cents`, transfer fields, `expense_count`, or
  `source_fingerprint`

## Confirmation Semantics

Replacement snapshots have independent confirmations.

Rules:

- Old confirmations do not carry over.
- Fully confirmed means the required household members confirmed that specific
  snapshot version.
- Confirmation rows still belong to one `settlement_snapshot_id`.
- One user cannot confirm for the other user.
- Duplicate confirmation from the same user remains idempotent.
- Promotion to `active` only happens after the exact replacement snapshot is
  fully confirmed.

Proposing a replacement should not auto-confirm the proposer in V2. This keeps
V2 consistent with V1's explicit "propose, then confirm" rhythm and avoids
surprising users who expected a draft-like replacement note.

Future schema note: if household membership can change later, store the
required confirmer user ids in the snapshot JSON or a companion field at
proposal time. For the current private two-person app, current household
members are the practical confirmer set.

## Ledger-Change Detection

Continue using a canonical calculation-relevant fingerprint.

Do include:

- household id
- month boundaries
- calculation version
- calculation status
- total expense cents
- expense count
- member paid/share/net cents
- transfer suggestion direction and amount

Do not include:

- display names
- profile fields
- confirmation state
- snapshot lifecycle labels
- UI query params
- `created_at`
- timestamps that do not affect calculation
- route-specific copy

This follows the V1 false-positive fix: display-only changes should not make a
snapshot look outdated.

V2 should define "outdated" as "the settlement-relevant live result differs",
not merely "a ledger row was touched". If a ledger edit produces the exact same
settlement result, the active snapshot does not need a noisy warning unless a
future product decision wants composition-level audit warnings.

## UI Direction

No UI changes are made by this plan. Future UI should stay in the couple
scrapbook / island notebook style.

Future `/settlement` behavior:

- Show the live calculation for the selected month.
- Show the current active snapshot for that month, if one exists.
- Show a pending replacement snapshot for that month, if one exists.
- If the active snapshot is outdated, show a gentle island notebook warning.
- Offer a "Create replacement settlement note" action only when allowed.
- Explain that replacement creates a household note, not a real transfer.

Future `/settlement/history` behavior:

- Show all versions for a month.
- Label the active snapshot.
- Label pending replacement snapshots.
- Label superseded snapshots.
- Do not expose voided snapshots in the V2 initial UI unless a later task
  explicitly adds the deferred void/cancel flow.
- Keep old fully confirmed snapshots readable.

Future snapshot detail behavior:

- Show whether the snapshot is active, pending replacement, superseded, or a
  future archived state.
- Show replacement links in both directions when available.
- Continue emphasizing that stored snapshot amounts are immutable.

Future records awareness behavior:

- Records pages can remind users that old snapshots do not change
  automatically.
- Creating records after a fully confirmed month should remain allowed unless a
  separate month-locking product decision is made.
- If the selected month has an outdated active snapshot, copy can be stronger
  but should still not block record creation by default.

## Recommended Lifecycle

Suggested states:

- `active`: the current accepted snapshot for a household/month.
- `pending_replacement`: a replacement snapshot waiting for confirmations.
- `superseded`: a previously active snapshot replaced by a fully confirmed
  replacement.
- `voided`: future-reserved only; not part of the V2 initial UI or write flow.

Suggested transition:

1. V1 existing snapshot starts as `active`.
2. Ledger changes make the live fingerprint differ.
3. Member proposes a replacement snapshot with `pending_replacement`.
4. Each member confirms the replacement snapshot.
5. When replacement reaches full confirmation, one transaction:
   - updates old active snapshot to `superseded`
   - sets `superseded_by_snapshot_id`
   - updates replacement snapshot to `active`
6. History displays both rows.

This preserves the old confirmed agreement until a new agreement is complete.

## Rollout Plan

Each step should be a separate focused branch and independently verifiable.

### Step 1: Lock V2 Decisions In Docs

- Lock lifecycle vocabulary.
- Lock separate proposal and confirmation actions.
- Lock old-active superseding only after replacement is fully confirmed.
- Lock one active plus one pending replacement per household/month.
- Lock void/cancel as deferred beyond V2.

### Step 2: Schema/RLS Migration Only

- Add lifecycle metadata columns.
- Add partial unique indexes for one active and one pending replacement
  snapshot per household/month.
- Drop the V1 household/month unique constraint only after replacement indexes
  are ready.
- Add RLS and database guards for lifecycle metadata.
- Do not wire UI.
- Do not add server actions.

### Step 3: Read Helpers

- Add helpers for active, pending replacement, and superseded snapshots.
- Keep current V1 history/detail helpers readable.
- Ensure old V1 rows are treated as active after migration.

### Step 4: Replacement Snapshot Payload Builder

- Reuse the existing V1 snapshot payload shape where possible.
- Add replacement metadata.
- Preserve `calculateSettlement` amount rules.
- Preserve V1 fingerprint semantics unless a dedicated fingerprint task changes
  the definition.

### Step 5: Propose Replacement Helper/Action

- Add one focused server-side mutation path.
- Use normal authenticated Supabase client and RLS.
- Do not use service role.
- Reject replacement when the live calculation is not persistable.
- Make duplicate replacement proposals idempotent.
- Do not auto-confirm the proposer.

### Step 6: Confirmation Transition Logic

- Confirm only the exact replacement snapshot id.
- Keep old confirmations separate from replacement confirmations.
- Promote replacement to active only after full confirmation.
- Atomically set the previous active snapshot to superseded.
- Do not expose broad amount-field or snapshot JSON mutation.

### Step 7: UI For Pending Replacement And Outdated Active Snapshot

- Update `/settlement` to show the active snapshot and outdated warning.
- Show any pending replacement beside the active snapshot.
- Offer a gentle action to propose a replacement only when allowed.
- Keep payment-provider wording out.

### Step 8: History And Detail Labels

- Label active, pending replacement, and superseded snapshots.
- Link old and replacement snapshots together.
- Keep detail pages read-only.

### Step 9: Regression Checklist Update

- Extend `SETTLEMENT_V1_REGRESSION.md` or create a V2 checklist in a later
  documentation task.
- Cover active snapshot, outdated warning, replacement proposal,
  independent confirmations, superseded history, and records awareness.

## Test Plan

Future V2 implementation should verify:

- V1 still works for a household/month with one snapshot.
- Existing fully confirmed snapshots remain visible.
- Existing V1 rows migrate to `active` without changing amounts.
- Ledger change triggers an outdated warning when the live fingerprint differs.
- Display name/profile changes do not trigger outdated warnings.
- Confirmation changes do not trigger outdated warnings.
- Replacement snapshot can be proposed by a household member.
- Duplicate replacement proposal is safe and idempotent.
- Only one pending replacement snapshot can exist per household/month.
- Proposer is not auto-confirmed.
- Replacement snapshot requires two confirmations.
- Old confirmations do not count for replacement.
- Old snapshot stays active while replacement is pending or partially confirmed.
- Replacement becomes active only after full confirmation.
- Old snapshot becomes superseded only when replacement becomes active.
- History shows both old and replacement snapshots.
- Snapshot detail shows stored amounts, not recalculated live amounts.
- Old amount fields and snapshot JSON are never mutated.
- Voided snapshots remain future-reserved and are not exposed in the initial V2
  write flow.
- RLS prevents non-members from reading snapshots.
- RLS prevents non-members from proposing replacements.
- RLS prevents confirming as another user.
- No service role or Supabase admin API is used.
- No payment provider or real transfer behavior is introduced.

## Decision Status

### Resolved For V2

1. Proposing a replacement does not auto-confirm the proposer.
2. Old active snapshots become `superseded` only after a replacement is fully
   confirmed.
3. V2 initial scope is one `active` snapshot and at most one
   `pending_replacement` snapshot per household/month.
4. Multiple replacement cycles over time are allowed after each previous
   replacement becomes active.
5. Replacement is allowed for any historical month with an active snapshot.
6. Ledger changes never automatically create a replacement snapshot.
7. V2 uses explicit `active`, `pending_replacement`, and `superseded`
   vocabulary.
8. `voided` is reserved only for future compatibility.
9. The V1 household/month unique constraint is replaced with partial unique
   indexes for active and pending replacement rows.
10. Confirmations belong to the exact snapshot id.
11. Fully confirmed means all current household members required by the app
    confirmed that exact snapshot.
12. Fingerprints remain calculation-relevant and preserve the V1 false-positive
    fix.
13. `/settlement`, `/settlement/history`, snapshot detail pages, and records
    awareness show lifecycle state without introducing real payment behavior.

### Deferred Beyond V2

1. Void/cancel replacement flow.
2. Multiple concurrent replacement drafts for the same household/month.
3. Exposing `voided` in V2 UI or write flows.
4. Payment-provider integration or real transfer confirmation.
5. Month locking that blocks record creation after full confirmation.
6. A full visible event timeline or append-only lifecycle event table.

### Still Needs Human Decision

1. Exact user-facing copy that distinguishes old/current/pending/superseded
   settlement notes.
2. Whether records creation after a fully confirmed month should show stronger
   wording than the current immutable-snapshot reminder.
3. Whether V2 should store required confirmer user ids at proposal time, or keep
   using current household members as the required confirmation set.
4. Whether composition-level ledger edits should warn even when the settlement
   totals and transfer suggestion are unchanged.

## Implementation Stop Conditions

Stop and write a follow-up design note instead of implementing if:

- the migration cannot safely replace the V1 unique constraint
- lifecycle metadata updates cannot be constrained without exposing amount
  mutation
- the app would need service role or admin API from application code
- RLS cannot safely express household-scoped replacement proposals
- replacement logic would require changing `calculateSettlement` amount rules
- replacement logic would require changing `getSettlementSummary` read semantics
- a future task attempts to supersede old snapshots before replacement is fully
  confirmed
- a future task attempts to auto-confirm the replacement proposer without a new
  explicit product decision
- a future task attempts to expose void/cancel behavior in the V2 initial flow
- implementation requires payment-provider or real money transfer behavior

## Current Task Verification

This current documentation-only task is complete only if:

- `SETTLEMENT_V2_CHANGE_PLAN.md` is the only changed file.
- No `src/**` file changed.
- No `supabase/migrations/**` file changed.
- No SQL was executed.
- No RLS was changed.
- No API route or server action was added.
- No database write helper was added.
- No `package.json` or `package-lock.json` change exists.
- No generated Supabase Database types were created.
- No `.env.local` change is staged or committed.
- No service role, Supabase admin API, RLS bypass, or `localStorage` data source
  was introduced.
- `calculateSettlement` remains unchanged.
- `getSettlementSummary` remains unchanged.
- `npm run build` passes, or the skipped build is explicitly reported because
  this is a Markdown-only task.
