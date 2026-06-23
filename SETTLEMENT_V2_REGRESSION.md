# Settlement V2 Regression Checklist

This document records the verified Settlement V2 replacement snapshot lifecycle
and the release checks that should stay green after future settlement changes.
It is documentation only. It does not introduce product behavior, schema
changes, RLS changes, SQL execution, API routes, helpers, UI, package changes,
or persistent test data.

## Scope

- Verify the V2 replacement snapshot lifecycle without rewriting immutable
  settlement amounts or snapshot JSON.
- Preserve the V1 settlement behavior for the existing `2026-06` fully
  confirmed month.
- Keep rollback transaction smoke data temporary. The smoke must end with
  `ROLLBACK`, not `COMMIT`.
- Keep all real UI replacement transition checks marked as future work until a
  genuine outdated month or an explicitly approved safe test path exists.

## Current Verified Status

- The pending replacement insert foundation exists in
  `supabase/migrations/20260623_allow_settlement_pending_replacement_insert.sql`.
- The replacement confirmation RPC exists in
  `supabase/migrations/20260623_add_settlement_replacement_confirmation_rpc.sql`.
- `public.confirm_settlement_replacement_snapshot(uuid)` was verified as
  `SECURITY INVOKER`.
- `authenticated` can execute the RPC.
- `anon` cannot execute the RPC.
- The transition-scoped UPDATE policy exists for lifecycle metadata only:
  `Settlement replacement transition updates lifecycle metadata`.
- No DELETE policy is part of the V2 replacement flow.
- The V1 active snapshot behavior remains stable for the existing `2026-06`
  fully confirmed snapshot.

## Lifecycle Vocabulary

- `active`: the current accepted settlement note for a household/month.
  Product language: 当前结算便签.
- `pending_replacement`: a new replacement draft waiting for both people to
  confirm. Product language: 新便签草稿，等待两个人确认.
- `superseded`: an old note that remains readable after a fully confirmed
  replacement becomes active. Product language: 旧便签，已被新便签替代.

Do not expose `voided` in the V2 initial UI. It is future-reserved only.

## Replacement Transition Invariants

- The old `active` snapshot remains `active` after the first replacement
  confirmation.
- The `pending_replacement` snapshot remains `pending_replacement` after the
  first confirmation.
- After the second current household member confirms the same pending snapshot:
  - the old `active` snapshot becomes `superseded`;
  - the old snapshot's `superseded_by_snapshot_id` points to the replacement;
  - the `pending_replacement` snapshot becomes `active`.
- Old confirmations do not carry over to a replacement.
- Confirmations belong to the exact `settlement_snapshot_id`.
- Stored amounts, transfer fields, expense count, source fingerprint, and
  snapshot JSON are never rewritten by the replacement transition.

## Rollback Transaction Smoke Procedure

Use this procedure only for verification against the dev/private Supabase
project. Do not commit the SQL and do not leave test data behind.

1. Read `SUPABASE_DB_URL` from ignored `.env.local`.
2. Do not print `SUPABASE_DB_URL`.
3. Use Dockerized `psql`, for example `postgres:16-alpine`.
4. Discover one existing real household with two existing real
   `household_members`.
5. Use a far-future month such as `2099-12-01`.
6. Verify there are zero settlement snapshots and zero settlement confirmations
   for that household/month before the transaction.
7. `BEGIN`.
8. Simulate member A with the authenticated Postgres/Supabase JWT context:
   - set role to `authenticated`;
   - set `request.jwt.claims` with member A `sub`, `email`, and
     `role = authenticated`;
   - verify `auth.uid()` and `public.is_allowed_user()` are correct.
9. Insert one `active` settlement snapshot for the far-future month inside the
   transaction.
10. Insert one `pending_replacement` snapshot for the same household/month,
    with `replacement_of_snapshot_id` pointing to the active snapshot.
11. Verify inside the transaction:
    - active count is `1`;
    - pending replacement count is `1`;
    - superseded count is `0`.
12. Call `public.confirm_settlement_replacement_snapshot(pending_snapshot_id)`
    as member A.
13. Verify after member A:
    - RPC status is `confirmed` or an equivalent partial-confirmation success;
    - confirmation count for the pending snapshot is `1`;
    - old snapshot lifecycle remains `active`;
    - pending snapshot lifecycle remains `pending_replacement`.
14. Switch auth context to member B inside the same transaction by resetting
    `request.jwt.claims`.
15. Call `public.confirm_settlement_replacement_snapshot(pending_snapshot_id)`
    as member B.
16. Verify after member B:
    - RPC status is `fully_confirmed`;
    - confirmation count for the pending snapshot is `2`;
    - old snapshot lifecycle is `superseded`;
    - old `superseded_by_snapshot_id` points to the pending snapshot id;
    - pending snapshot lifecycle is `active`.
17. Call the RPC again as member B.
18. Verify the duplicate call is a safe no-op style result after promotion, such
    as `not_pending_replacement`, and that confirmation count remains `2`.
19. `ROLLBACK`.
20. Verify from a fresh connection that the far-future month still has:
    - `0` active snapshots;
    - `0` pending replacement snapshots;
    - `0` superseded snapshots;
    - `0` settlement confirmations.

## Observed Smoke Evidence

The rollback transaction smoke against project `xveqdtvfgnmungycmwjq` observed:

- Member A RPC returned `confirmed`.
- Confirmation count became `1/2`.
- The old snapshot stayed `active`.
- The pending snapshot stayed `pending_replacement`.
- Member B RPC returned `fully_confirmed`.
- Confirmation count became `2/2`.
- The old snapshot became `superseded`.
- The old `superseded_by_snapshot_id` pointed to the pending snapshot id.
- The pending snapshot became `active`.
- Duplicate member B call returned `not_pending_replacement` after promotion.
- Duplicate call left confirmation count at `2`.
- `ROLLBACK` left `0` snapshots and `0` confirmations for `2099-12-01`.

This proves the database transition logic under RLS for a realistic two-member
household. It does not leave a real pending replacement available for UI
inspection.

## V1 Regression Checklist

Use this checklist after V2 replacement changes to guard the existing V1
settlement path.

- [ ] Anonymous `/settlement` redirects to `/login` or shows the Next dev
      redirect marker for `/login`.
- [ ] Primary Dev Login works.
- [ ] Partner Dev Login works when partner env is configured.
- [ ] `/settlement?month=2026-06` shows `fully_confirmed / 2/2`.
- [ ] Unchanged `2026-06` shows no replacement proposal UI.
- [ ] No false outdated warning appears for unchanged `2026-06`.
- [ ] `/settlement/history` shows `2026-06` as active and `2/2`.
- [ ] Snapshot detail renders immutable active detail.
- [ ] Dashboard teaser remains fully confirmed for the settled month.
- [ ] Records awareness remains fully confirmed for the settled month.
- [ ] Duplicate V1 proposal returns `already_exists` and active snapshot count
      remains `1`.
- [ ] Duplicate V1 confirmation returns `already_confirmed` and confirmation
      count remains `2`.

## V2 UI Checklist

These checks are for future UI regression passes. Keep verified and unverified
paths separate in reports.

- [ ] If the active snapshot is unchanged, no replacement proposal UI appears.
- [ ] If the active snapshot is outdated and no pending replacement exists, the
      page shows `重新生成结算便签`.
- [ ] If `pending_replacement` exists, it is shown separately from the active
      snapshot.
- [ ] Pending replacement UI shows confirmation progress.
- [ ] Pending replacement UI shows the confirmation button only for an
      unconfirmed current user.
- [ ] After full replacement confirmation, the new snapshot appears as `active`.
- [ ] After full replacement confirmation, the old snapshot appears as
      `superseded` in history/detail.
- [ ] UI copy avoids payment-provider, real transfer, bank transfer, paid,
      charged, refunded, or marked-as-settled language.

## Safety Boundaries

Regression work must not do any of the following unless a later explicit task
changes the scope:

- create fake users;
- create fake household members;
- leave fake settlement rows behind;
- run cleanup deletes to erase smoke data;
- use service role credentials;
- use Supabase admin APIs;
- bypass RLS;
- `COMMIT` rollback smoke data;
- add real payment or real transfer behavior;
- mutate stored amount fields;
- mutate stored snapshot JSON;
- change `calculateSettlement` amount rules;
- rewrite `getSettlementSummary` semantics;
- add API routes, server actions, helpers, migrations, or package changes as
  part of a regression-only task.

## Known Limitations

- The current real `2026-06` snapshot is not outdated, so normal UI does not
  show the replacement proposal.
- Full real UI replacement transition awaits a genuine ledger change or an
  approved safe test month.
- Rollback smoke proves database transition logic but does not leave a real
  pending replacement for UI inspection.
- Any future end-to-end replacement UI test must avoid fake persistent data
  unless explicitly approved.

## Future Update Points

Update this document when a genuine outdated month runs through:

- replacement proposal UI;
- first confirmer state;
- second confirmer state;
- active/superseded history display.

Also update this document after any Settlement V2 schema, RLS, helper, action,
or UI lifecycle behavior changes.

## Verification Commands

For documentation-only updates to this checklist, run:

```powershell
npm run build
git diff --name-only
git diff --check
git diff --cached --check
git status --short -- .env.local package.json package-lock.json supabase src
```

Expected documentation-only result:

- only `SETTLEMENT_V2_REGRESSION.md` changes;
- no `src/**` changes;
- no `supabase/**` changes;
- no SQL execution in the task;
- no RLS changes;
- no `.env.local`, package, generated type, service role, admin API,
  `localStorage`, payment-provider, or real-transfer changes.
