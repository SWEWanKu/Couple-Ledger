# Import Review V1 Regression Checklist

This is the regression checklist for Import Review V1 / `共同对账模式`.
It documents the completed MVP and its safety boundaries. It does not add
runtime behavior, schema changes, RLS changes, SQL execution, API routes,
helpers, server actions, UI changes, package changes, generated types, or test
data.

## Purpose

Import Review V1 is a human-confirmed card-by-card reconciliation workflow, not
one-click automatic bookkeeping.

The MVP verifies this path:

- parse WeChat or Alipay bill exports;
- upload parsed rows into the import review pool;
- review one source transaction card at a time;
- skip rows that should not enter the official ledger;
- mark uncertain rows as `need_discussion`;
- confirm one common expense into the official ledger;
- keep settlement snapshots and confirmations safe.

The official ledger remains the source of truth for `/records`, `/dashboard`,
monthly reports, and live settlement. Import tables are a private household
source trail and review queue.

## Current Completed Scope

- WeChat `.xlsx` parser.
- Alipay `.csv` parser.
- Alipay UTF-8 and GBK/GB18030-compatible CSV decoding.
- `import_batches` and `import_items` schema and RLS.
- `create_import_batch_v1` RPC.
- `update_import_item_review_status_v1` RPC.
- `mark_import_item_personal_v1` RPC.
- `confirm_import_item_to_ledger_v1` RPC.
- `reopen_import_item_to_pending_v1` RPC.
- `/imports`.
- `/imports/new`.
- `/imports/[batchId]/review`.
- Read-only continue-entry polish on `/dashboard` and `/imports` for unfinished
  import review batches.
- Common expense + equal split confirm-to-ledger.
- `skipped` and `need_discussion` status actions.
- Suggested `skip` / `need_discussion` quick-apply buttons on the review card;
  they reuse the existing status forms/actions and create no official ledger
  record.
- Read-only suggestion queue filters for `skip`, `need_discussion`, and
  `review`; they combine with status filters and add no write behavior.
- Read-only transaction-type direction filters for `expense`, `income`,
  `refund`, `transfer`, and `unknown`; they combine with status and suggestion
  filters and add no write behavior.
- Personal-expense skip actions for `我的个人` and `她的个人` / `对方个人`;
  these keep source trail fields and create no official ledger record.
- Reopen `skipped` and `need_discussion` items back to `pending`.
- Review card keyboard shortcuts for `J`, `K`, `4`, `5`, `1`, `Enter`, and
  `Esc`.
- No personal ledger records yet.
- No importing personal expenses into the official ledger yet.
- No custom split yet.
- No batch confirm-all yet.
- No AI final decision, voice recognition, realtime collaboration, payment, or
  real transfer behavior.

## Parser Checklist

Run:

```powershell
npx --yes tsx scripts/verify-import-review-parsers.ts
```

Verify:

- [ ] Alipay UTF-8 fixture parses.
- [ ] Alipay GBK/GB18030 fixture parses.
- [ ] WeChat `.xlsx` fixture parses.
- [ ] `amountCents` values are integers.
- [ ] `monthKey` is `YYYY-MM`.
- [ ] `rawJson` is preserved as an object.
- [ ] `reviewStatus` defaults to `pending`.
- [ ] Suggested category/action values are advisory only.
- [ ] Transfer/top-up/wealth style rows can suggest `skip`.
- [ ] Refund/closed/reversal style rows can suggest `need_discussion`.
- [ ] Parser/upload code never creates `ledger_entries`.

Privacy rules for real samples:

- [ ] Keep real exports in ignored private folders only.
- [ ] Do not commit real bill files.
- [ ] Do not print transaction details, merchants, notes, transaction ids, or
      real file names.
- [ ] Report only aggregates such as row counts and parser success/failure.

Committed sanitized fixtures:

- `fixtures/import-review/alipay-sample.csv`
- `fixtures/import-review/alipay-gbk-sample.csv.b64`
- `fixtures/import-review/wechat-sample.xlsx`

## Schema And RLS Checklist

Verify:

- [ ] `import_batches` exists.
- [ ] `import_items` exists.
- [ ] RLS is enabled on `import_batches`.
- [ ] RLS is enabled on `import_items`.
- [ ] Household-scoped SELECT policy exists for `import_batches`.
- [ ] Household-scoped INSERT policy exists for `import_batches`.
- [ ] Household-scoped UPDATE policy exists for `import_batches`.
- [ ] Household-scoped SELECT policy exists for `import_items`.
- [ ] Household-scoped INSERT policy exists for pending `import_items`.
- [ ] Household-scoped UPDATE policy exists for `import_items`.
- [ ] No DELETE policy exists on import tables.
- [ ] Batch dedupe constraint exists for
      `household_id + source + file_sha256`.
- [ ] Source transaction dedupe partial unique index exists for
      `household_id + source + source_transaction_id` when
      `source_transaction_id` is present.
- [ ] `import_items.review_status` supports only:
      `pending`, `imported`, `skipped`, `need_discussion`.
- [ ] `import_batches.status` supports only:
      `parsed`, `reviewing`, `completed`.
- [ ] Imported items require a non-null `ledger_entry_id`.
- [ ] Non-imported items require `ledger_entry_id` to remain null.
- [ ] Reviewed non-pending items require `reviewed_by` and `reviewed_at`.

## RPC Checklist

### `create_import_batch_v1`

- [ ] Function is `SECURITY INVOKER`.
- [ ] `anon` cannot execute.
- [ ] `authenticated` can execute.
- [ ] Authenticated household member can create a batch.
- [ ] Actor is derived from `auth.uid()`.
- [ ] Creates one `import_batches` row and matching pending `import_items`
      atomically.
- [ ] Duplicate file returns `already_exists`.
- [ ] Duplicate source transaction fails safely without a partial batch.
- [ ] Creates no `ledger_entries`.
- [ ] Creates no `ledger_entry_splits`.
- [ ] Mutates no settlement tables.
- [ ] Uses no service role or RLS bypass.

### `update_import_item_review_status_v1`

- [ ] Function is `SECURITY INVOKER`.
- [ ] `anon` cannot execute.
- [ ] `authenticated` can execute.
- [ ] Supports `skipped` and `need_discussion` only.
- [ ] Rejects unsupported review statuses.
- [ ] Updates `reviewed_by` from `auth.uid()`.
- [ ] Updates `reviewed_at`.
- [ ] Recomputes batch counters in the same transaction.
- [ ] Creates no `ledger_entries`.
- [ ] Creates no `ledger_entry_splits`.
- [ ] Mutates no settlement tables.
- [ ] Imported items cannot be changed by this status action.

### `mark_import_item_personal_v1`

- [ ] Function exists.
- [ ] Function is `SECURITY INVOKER`.
- [ ] `anon` cannot execute.
- [ ] `authenticated` can execute.
- [ ] Authenticated household member can mark an eligible item as personal.
- [ ] Non-household user cannot mark items.
- [ ] `owner_user_id` must be a household member for the same household.
- [ ] Supports only non-imported items in `pending`, `skipped`, or
      `need_discussion`.
- [ ] Rejects imported items and items with a non-null `ledger_entry_id`.
- [ ] Sets `review_status = 'skipped'`.
- [ ] Sets `final_owner_user_id` to the selected household member.
- [ ] Sets `final_split_type = 'personal'`.
- [ ] May set `final_note` to explain the item is personal and outside the
      shared ledger.
- [ ] Keeps `ledger_entry_id` null.
- [ ] Recomputes batch counters in the same transaction.
- [ ] Creates no `ledger_entries`.
- [ ] Creates no `ledger_entry_splits`.
- [ ] Mutates no settlement tables.
- [ ] Adds no DELETE policy.
- [ ] Uses no service role or RLS bypass.

### `confirm_import_item_to_ledger_v1`

- [ ] Function is `SECURITY INVOKER`.
- [ ] `anon` cannot execute.
- [ ] `authenticated` can execute.
- [ ] Supports pending expense items only.
- [ ] Supports common expense only.
- [ ] Supports equal split only.
- [ ] Validates category belongs to the household.
- [ ] Validates `paid_by` is a household member.
- [ ] Creates exactly one `ledger_entries` row.
- [ ] Creates `ledger_entry_splits` rows.
- [ ] Split row count matches the current household member count.
- [ ] Split total equals the parent entry amount in cents.
- [ ] Marks the import item as `imported`.
- [ ] Sets `ledger_entry_id` to the created record.
- [ ] Sets `reviewed_by` from `auth.uid()`.
- [ ] Sets `reviewed_at`.
- [ ] Stores final category, paid-by user, split type, and note.
- [ ] Recomputes batch counters in the same transaction.
- [ ] Returns the next pending item id when one exists.
- [ ] Blocks a `pending_replacement` settlement month.
- [ ] Does not mutate `settlement_snapshots`.
- [ ] Does not mutate `settlement_confirmations`.
- [ ] Uses no service role or RLS bypass.

### `reopen_import_item_to_pending_v1`

- [ ] Function exists.
- [ ] Function is `SECURITY INVOKER`.
- [ ] `anon` cannot execute.
- [ ] `authenticated` can execute.
- [ ] Authenticated household member can reopen an eligible item.
- [ ] Non-household user cannot reopen items.
- [ ] Supports `skipped -> pending`.
- [ ] Supports `need_discussion -> pending`.
- [ ] Rejects `imported` items.
- [ ] Rejects items linked to `ledger_entry_id`.
- [ ] Clears `reviewed_by`.
- [ ] Clears `reviewed_at`.
- [ ] Keeps `ledger_entry_id` null.
- [ ] Recomputes batch counters in the same transaction.
- [ ] Adds no DELETE policy.
- [ ] Creates no `ledger_entries`.
- [ ] Creates no `ledger_entry_splits`.
- [ ] Mutates no settlement tables.
- [ ] Uses no service role or RLS bypass.

## Upload Flow Checklist

- [ ] `/imports` is auth-protected.
- [ ] `/imports/new` is auth-protected.
- [ ] `/imports/[batchId]/review` is auth-protected.
- [ ] `/imports` lists existing import batches for the current household.
- [ ] `/imports/new` explains that uploaded bills enter the pending review pool.
- [ ] `/imports/new` explains that nothing enters the official ledger until
      confirmed.
- [ ] Source selector supports `wechat`.
- [ ] Source selector supports `alipay`.
- [ ] File type check requires WeChat `.xlsx`.
- [ ] File type check requires Alipay `.csv`.
- [ ] Upload size limit is enforced by the server helper.
- [ ] Server computes SHA-256 for the uploaded bytes.
- [ ] Server derives the current user and household.
- [ ] Server calls `create_import_batch_v1`.
- [ ] Original file is not stored long-term by the V1 app flow.
- [ ] Transaction detail is not printed to logs or UI as debug output.
- [ ] Duplicate file flow returns the existing batch with friendly copy.
- [ ] Upload/parse creates no official ledger records.
- [ ] Upload/parse mutates no settlement tables.

## Continue Entry Checklist

Dashboard and `/imports` provide read-only resume entry points for unfinished
共同对账 work.

- [ ] `/dashboard` shows the `共同对账模式` entry.
- [ ] When unfinished import batches exist, the dashboard entry offers
      `继续对账`.
- [ ] `/imports` shows a top `继续对账` section when unfinished batches exist.
- [ ] Unfinished means `pending_count > 0` or `need_discussion_count > 0`.
- [ ] `pending_count` is derived from `parsed_count - reviewed_count`.
- [ ] Continue links point to
      `/imports/[batchId]/review?status=pending` when pending items exist.
- [ ] If no pending items remain but `need_discussion_count > 0`, continue
      links may point to
      `/imports/[batchId]/review?status=need_discussion`.
- [ ] Continue links are safe internal links only.
- [ ] `/imports` batch list still works below the continue section.
- [ ] `/imports/[batchId]/review` still renders status filters.
- [ ] `/imports/[batchId]/review` still renders suggestion filters.
- [ ] `/imports/[batchId]/review` still renders direction filters.

Continue-entry safety expectations:

- [ ] Continue summary is SELECT-only / derived UI.
- [ ] Viewing or clicking continue links does not write `import_items`.
- [ ] Viewing or clicking continue links does not write `import_batches`.
- [ ] Continue-entry polish adds no new RPC, server action, migration, API route,
      or backend behavior.
- [ ] Continue-entry polish creates no `ledger_entries` row.
- [ ] Continue-entry polish creates no `ledger_entry_splits` rows.
- [ ] Continue-entry polish mutates no settlement snapshots or confirmations.
- [ ] Continue-entry links do not accept or trust arbitrary return URLs.

## Review Card Checklist

`/imports/[batchId]/review` should show:

- [ ] Batch summary.
- [ ] Source label.
- [ ] Batch status.
- [ ] Progress counts.
- [ ] `第 N / M 条`.
- [ ] Status filters:
      `pending`, `imported`, `skipped`, `need_discussion`, `all`.
- [ ] Suggestion filter chip row labeled `按系统建议筛选`.
- [ ] Suggestion filter chips:
      `全部建议`, `建议忽略`, `建议待确认`, `建议入账/复核`.
- [ ] Direction filter chip row labeled `按流水类型筛选`.
- [ ] Direction filter chips:
      `全部类型`, `支出`, `收入`, `退款`, `转账/充值提现`, `未知`.
- [ ] Previous navigation.
- [ ] Next navigation.
- [ ] Transaction time.
- [ ] Month.
- [ ] Counterparty.
- [ ] Description.
- [ ] Direction.
- [ ] Amount.
- [ ] Source.
- [ ] Payment method.
- [ ] Source category.
- [ ] Source status.
- [ ] Masked source transaction id.
- [ ] Suggestion panel.
- [ ] Suggested `skip` items show a prominent `按建议忽略并下一条` button.
- [ ] Suggested `need_discussion` items show a prominent `按建议标记待确认`
      button.
- [ ] Current item result feedback after an action.
- [ ] Empty state when the selected filter has no items.

Review safety:

- [ ] Suggestions are shown as advisory only.
- [ ] Final review decisions remain human-confirmed by the two users.
- [ ] Suggested category/review action never auto-creates official ledger
      records.
- [ ] Suggested `review` / common expense / category-only items keep the normal
      common-expense confirmation flow unchanged.
- [ ] Suggestion filters are read-only navigation only.
- [ ] Direction filters are read-only navigation only.
- [ ] Old import rows may use safe derived suggestion fallback.
- [ ] Filtering does not backfill parser output or update `import_items`.
- [ ] Direction explanations are advisory only and never auto-apply review
      decisions.
- [ ] `rawJson` is not dumped into the UI.
- [ ] Source transaction id is masked in the UI.
- [ ] `我的个人` is enabled for eligible non-imported items.
- [ ] `她的个人` / `对方个人` is enabled for eligible non-imported items when the
      other household member can be identified.
- [ ] Personal skipped state explains that the item is personal and outside the
      shared ledger.
- [ ] Personal skipped state shows owner information when available.
- [ ] Imported items do not show personal skip buttons.
- [ ] Custom split is not present as a working V1 path.
- [ ] The page uses the private scrapbook / island notebook style, not an admin
      table.

## Keyboard Shortcut Checklist

`/imports/[batchId]/review` should show a discoverable shortcut help card.

Verify keyboard behavior:

- [ ] `J` opens the next item when an existing next link is available.
- [ ] `K` opens the previous item when an existing previous link is available.
- [ ] With a suggestion filter active, `J` / `K` stay inside the filtered
      suggestion queue.
- [ ] With a direction filter active, `J` / `K` stay inside the filtered
      transaction-type queue.
- [ ] `4` submits the existing `蹇界暐姝ゆ潯` / skip form only when that
      action is available.
- [ ] `5` submits the existing `鏍囪寰呯‘璁?` / need-discussion form only
      when that action is available.
- [ ] `1` focuses or highlights the `鍏卞悓鏀嚭` confirmation area only when
      confirm-to-ledger is available.
- [ ] `Enter` submits confirm-to-ledger only when the existing confirm form
      exists and browser form validity passes.
- [ ] `Esc` blurs the active input where applicable.

Shortcut safety:

- [ ] Shortcuts do not trigger while typing in `input`, `textarea`, `select`, or
      `contenteditable` elements.
- [ ] Shortcuts reuse existing links, forms, and server actions.
- [ ] Shortcuts add no backend behavior.
- [ ] No new server action, RPC, migration, API route, or helper is added for
      shortcuts.
- [ ] Mouse and touch buttons remain usable.

## Status Action Checklist

From a pending item:

- [ ] `忽略此条` changes status to `skipped`.
- [ ] `标记待确认` changes status to `need_discussion`.

Verify after either status action:

- [ ] `reviewed_by` is set.
- [ ] `reviewed_at` is set.
- [ ] `ledger_entry_id` remains null.
- [ ] No `ledger_entries` row is created.
- [ ] No `ledger_entry_splits` row is created.
- [ ] Batch counters update.
- [ ] Page moves to the next pending item, or shows an empty state when no
      pending items remain.
- [ ] Imported items cannot be changed by these actions.

## Suggestion Queue Filter Checklist

`/imports/[batchId]/review` supports these suggestion query values:

- [ ] `suggestion=all`.
- [ ] `suggestion=skip`.
- [ ] `suggestion=need_discussion`.
- [ ] `suggestion=review`.

Suggestion filters combine safely with status filters:

- [ ] `status=pending&suggestion=skip`.
- [ ] `status=pending&suggestion=need_discussion`.
- [ ] `status=pending&suggestion=review`.
- [ ] `status=all&suggestion=skip`.

Queue behavior:

- [ ] `按系统建议筛选` chip row appears near the existing status filters.
- [ ] Chips include `全部建议`, `建议忽略`, `建议待确认`, and `建议入账/复核`.
- [ ] Previous navigation preserves the active `suggestion` query.
- [ ] Next navigation preserves the active `suggestion` query.
- [ ] `J` / `K` shortcuts stay within the filtered queue.
- [ ] If the requested `item` does not match the active filter, the page falls
      back to the first matching item.
- [ ] Empty suggestion queues show a friendly notebook empty state.
- [ ] Empty suggestion queues offer safe links for `全部待对账`, `全部流水`, and
      `导入列表`.

Safety expectations:

- [ ] Suggestion filters are advisory and read-only.
- [ ] Suggestion filters may use safe derived suggestion fallback for old import
      rows.
- [ ] Filtering does not update existing `import_items`.
- [ ] Filtering does not backfill parser suggestion fields.
- [ ] Filtering creates no `ledger_entries` row.
- [ ] Filtering creates no `ledger_entry_splits` rows.
- [ ] Filtering mutates no settlement tables.
- [ ] No new server action, RPC, migration, API route, parser behavior, or
      backend write behavior is added for suggestion filters.
- [ ] Quick-apply `skip` / `need_discussion` still works from filtered queues.
- [ ] Manual status, personal, and common-expense controls remain available.

## Transaction-Type Direction Filter Checklist

`/imports/[batchId]/review` supports these direction query values:

- [ ] `direction=all`.
- [ ] `direction=expense`.
- [ ] `direction=income`.
- [ ] `direction=refund`.
- [ ] `direction=transfer`.
- [ ] `direction=unknown`.

Direction filters combine safely with status and suggestion filters:

- [ ] `status=pending&direction=transfer`.
- [ ] `status=pending&suggestion=skip&direction=transfer`.
- [ ] `status=all&direction=expense`.
- [ ] `status=pending&direction=refund`.

Queue behavior:

- [ ] `按流水类型筛选` chip row appears near the existing status and suggestion
      filters.
- [ ] Chips include `全部类型`, `支出`, `收入`, `退款`, `转账/充值提现`, and `未知`.
- [ ] Direction counts are derived read-only from the current status +
      suggestion filtered queue.
- [ ] Previous navigation preserves the active `direction` query.
- [ ] Next navigation preserves the active `direction` query.
- [ ] `J` / `K` shortcuts stay within the filtered direction queue.
- [ ] If the requested `item` does not match the active direction filter, the
      page falls back to the first matching item.
- [ ] Empty direction queues show a friendly notebook empty state.
- [ ] Empty direction queues offer safe links for `全部待对账`, `全部流水`, and
      `导入列表`.

Explanation copy:

- [ ] Transfer rows explain that they are usually transfers, withdrawals,
      top-ups, or wealth-flow items and may not be shared consumption.
- [ ] Refund rows explain that they may need checking against the original
      purchase.
- [ ] Unknown rows explain that the item needs human review.

Safety expectations:

- [ ] Direction filters are read-only navigation only.
- [ ] Direction filters do not update existing `import_items`.
- [ ] Direction filters do not backfill parser output or change parser behavior.
- [ ] Direction filters create no `ledger_entries` row.
- [ ] Direction filters create no `ledger_entry_splits` rows.
- [ ] Direction filters mutate no settlement tables.
- [ ] No new server action, RPC, migration, API route, parser behavior, or
      backend write behavior is added for direction filters.
- [ ] Suggestions and direction explanations are advisory only.
- [ ] Quick-apply `skip` / `need_discussion` still works from filtered queues.
- [ ] Manual status, personal, and common-expense controls remain available.

## Suggested Action Quick Apply Checklist

From a pending, non-imported item with `ledger_entry_id` still null:

- [ ] Suggested `skip` shows `按建议忽略并下一条`.
- [ ] Suggested `need_discussion` shows `按建议标记待确认`.
- [ ] Quick-apply `skip` submits the existing skip form/action.
- [ ] Quick-apply `need_discussion` submits the existing need-discussion
      form/action.
- [ ] Quick-apply `skip` creates no `ledger_entries` row.
- [ ] Quick-apply `skip` creates no `ledger_entry_splits` rows.
- [ ] Quick-apply `need_discussion` creates no `ledger_entries` row.
- [ ] Quick-apply `need_discussion` creates no `ledger_entry_splits` rows.
- [ ] Batch counters update through the existing status action behavior.
- [ ] Reopen-to-pending still works after either quick-apply outcome.
- [ ] Manual `忽略此条` and `标记待确认` buttons remain available.
- [ ] Manual `我的个人` / `她的个人` / `对方个人` buttons remain available where
      eligible.
- [ ] Manual `共同支出` confirmation remains available where eligible.
- [ ] Keyboard shortcuts `J` / `K` / `4` / `5` / `1` / `Enter` / `Esc` remain
      unchanged.

Safety expectations:

- [ ] Suggestions are advisory only.
- [ ] Final decision remains human-confirmed.
- [ ] Suggested category/review action does not auto-create official ledger
      records.
- [ ] No new RPC, server action, migration, API route, parser behavior, or
      backend write behavior is added for quick apply.

## Personal Expense Skip Checklist

From an eligible non-imported item:

- [ ] `我的个人` marks the item as a personal skipped outcome for the current
      user.
- [ ] `她的个人` / `对方个人` marks the item as a personal skipped outcome for the
      selected other household member.

Verify after either personal action:

- [ ] `review_status` is `skipped`.
- [ ] `final_owner_user_id` is the selected household member.
- [ ] `final_split_type` is `personal`.
- [ ] `final_note` may explain the item is personal and outside the shared
      ledger.
- [ ] `reviewed_by` is set from the current authenticated user.
- [ ] `reviewed_at` is set.
- [ ] `ledger_entry_id` remains null.
- [ ] No `ledger_entries` row is created.
- [ ] No `ledger_entry_splits` row is created.
- [ ] Batch counters are recomputed transaction-safely.
- [ ] Page moves to the next pending item, or shows an empty state when no
      pending items remain.
- [ ] Personal skipped state is visible and shows owner information when
      available.
- [ ] Imported items do not show personal skip buttons.

## Reopen-To-Pending Checklist

From a skipped item:

- [ ] Current item shows `重新放回待对账`.
- [ ] Action changes `review_status` back to `pending`.

From a need-discussion item:

- [ ] Current item shows `放回待对账`.
- [ ] Action changes `review_status` back to `pending`.

Verify after either reopen action:

- [ ] `reviewed_by` is cleared.
- [ ] `reviewed_at` is cleared.
- [ ] `final_owner_user_id` is cleared.
- [ ] `final_paid_by_user_id` is cleared.
- [ ] `final_split_type` is cleared.
- [ ] `final_note` is cleared.
- [ ] `final_category` is cleared.
- [ ] `ledger_entry_id` remains null.
- [ ] Batch counters are recomputed transaction-safely.
- [ ] Item returns to the pending queue.
- [ ] No `ledger_entries` row is created, updated, unlinked, or deleted.
- [ ] No `ledger_entry_splits` row is created, updated, or deleted.
- [ ] No settlement snapshot or confirmation row is mutated.
- [ ] Imported items cannot be reopened.

## Confirm-To-Ledger Checklist

Pick a sanitized pending expense item. Confirm it as:

- `共同支出`;
- a selected household category;
- a selected `paid_by` household member;
- equal split;
- a harmless note.

Verify:

- [ ] Exactly one `ledger_entries` row is created.
- [ ] `ledger_entries.entry_type` is `expense`.
- [ ] `ledger_entries.split_mode` is `equal`.
- [ ] `ledger_entry_splits` rows are created.
- [ ] Split rows total the entry amount.
- [ ] Import item status becomes `imported`.
- [ ] Import item `ledger_entry_id` points to the created record.
- [ ] Import item final category is stored.
- [ ] Import item final paid-by user is stored.
- [ ] Import item final split type is `equal`.
- [ ] `reviewed_by` is set.
- [ ] `reviewed_at` is set.
- [ ] Batch counters update.
- [ ] Page moves to the next pending item, or shows an empty state when no
      pending items remain.
- [ ] Created record appears in `/records` for that month.
- [ ] Record detail opens.
- [ ] Record can be soft-voided through the existing record detail flow if it is
      test data.
- [ ] Import item remains `imported` and linked after the official record is
      soft-voided.
- [ ] No hard delete is used.
- [ ] No settlement snapshot or confirmation row is mutated.

## Settlement Interaction Checklist

### Unsettled Month

- [ ] Confirm-to-ledger proceeds normally.
- [ ] Live dashboard, records, monthly report, and settlement reads update from
      the official ledger on the next read.
- [ ] No stored settlement snapshot is created or changed by import review.

### Active / Proposed / Partially Confirmed / Fully Confirmed Snapshot Month

- [ ] UI shows a warning that a saved settlement note already exists.
- [ ] Confirm may proceed.
- [ ] Stored settlement snapshot remains immutable.
- [ ] Stored settlement confirmations remain immutable.
- [ ] Live settlement may become outdated after the new official record.

### `pending_replacement` Month

- [ ] UI explains the month is blocked for confirm-to-ledger.
- [ ] `confirm_import_item_to_ledger_v1` returns
      `blocked_pending_replacement`.
- [ ] No ledger entry is created.
- [ ] No split rows are created.
- [ ] Import item remains unimported.

Always verify:

- [ ] No `settlement_snapshots` row is mutated.
- [ ] No `settlement_confirmations` row is mutated.
- [ ] `calculateSettlement` is unchanged.
- [ ] `getSettlementSummary` is unchanged unless explicitly approved by a later
      task.

## Safe Smoke Data Rules

- [ ] Prefer sanitized fixture imports.
- [ ] Do not use real bill data for committed tests.
- [ ] Do not print real transaction details, merchants, notes, transaction ids,
      or file names.
- [ ] Do not cleanup-delete import rows.
- [ ] Import tables have no DELETE policy.
- [ ] Reopen smoke uses sanitized import items only.
- [ ] Suggestion filter smoke uses sanitized import items only.
- [ ] Suggestion filter smoke verifies `ledger_entries` count does not change.
- [ ] Suggestion filter smoke verifies no `import_items` row is updated just by
      filtering.
- [ ] Suggestion filter smoke verifies settlement rows do not change.
- [ ] Direction filter smoke uses sanitized import items only.
- [ ] Direction filter smoke verifies `ledger_entries` count does not change.
- [ ] Direction filter smoke verifies no `import_items` row is updated just by
      filtering.
- [ ] Direction filter smoke verifies settlement rows do not change.
- [ ] Suggested quick-apply smoke uses sanitized import items only.
- [ ] Suggested quick-apply smoke verifies `ledger_entries` count does not
      increase for `skip` or `need_discussion`.
- [ ] Suggested quick-apply smoke verifies settlement rows do not change.
- [ ] Personal skip smoke uses sanitized import items only.
- [ ] Personal skip smoke verifies `ledger_entries` count does not increase.
- [ ] Personal skip smoke verifies settlement rows do not change.
- [ ] Do not test imported undo as a user flow; imported item undo remains
      deferred.
- [ ] If sanitized import batches/items remain in the DB, record them as
      harmless test artifacts.
- [ ] For created test ledger entries, use the existing soft-void flow rather
      than hard delete.
- [ ] Do not edit or void important real household records during routine smoke.

## App Regression Smoke

Use `LOCAL_SMOKE_GUIDE.md` for Windows process and port handling.

Anonymous protection:

- [ ] `/imports`.
- [ ] `/imports/new`.
- [ ] `/imports/[batchId]/review`.
- [ ] `/dashboard`.
- [ ] `/records`.
- [ ] `/settlement`.
- [ ] `/reports/monthly?month=2026-06`.

Authenticated smoke:

- [ ] Primary Dev Login works.
- [ ] Partner Dev Login works if configured.
- [ ] `/dashboard` renders.
- [ ] If unfinished import batches exist, `/dashboard` shows a
      `继续对账` entry that opens the pending or need-discussion review queue.
- [ ] `/records?month=2026-06` renders.
- [ ] `/records/new?month=2026-06` renders.
- [ ] `/settlement?month=2026-06` renders.
- [ ] `/settlement/history` renders.
- [ ] Settlement snapshot detail renders.
- [ ] `/reports/monthly?month=2026-06` renders.
- [ ] `/imports` renders.
- [ ] If unfinished import batches exist, `/imports` shows a top `继续对账`
      section and the latest unfinished batch link opens the right review queue.
- [ ] `/imports/new` renders.
- [ ] `/imports/[batchId]/review` renders for an existing batch.
- [ ] Landing on `/imports/[batchId]/review?status=pending` from a continue
      link keeps the status, suggestion, and direction filters available.
- [ ] `/imports/[batchId]/review?suggestion=skip` renders matching items when
      available.
- [ ] `/imports/[batchId]/review?suggestion=need_discussion` renders matching
      items when available.
- [ ] `/imports/[batchId]/review?suggestion=review` renders matching items when
      available.
- [ ] Suggestion filters combine with status filters such as
      `status=pending&suggestion=skip` and `status=all&suggestion=skip`.
- [ ] Empty suggestion queues show the friendly notebook empty state.
- [ ] `/imports/[batchId]/review?direction=expense` renders matching items.
- [ ] `/imports/[batchId]/review?direction=income` renders matching items when
      available.
- [ ] `/imports/[batchId]/review?direction=refund` renders matching items when
      available.
- [ ] `/imports/[batchId]/review?direction=transfer` renders matching items when
      available.
- [ ] `/imports/[batchId]/review?direction=unknown` shows either matching items
      or a friendly notebook empty state.
- [ ] Direction filters combine with status and suggestion filters such as
      `status=pending&direction=transfer`,
      `status=pending&suggestion=skip&direction=transfer`, and
      `status=all&direction=expense`.
- [ ] Previous/next links stay within the active direction queue.
- [ ] `/imports/[batchId]/review` shortcut help card renders.
- [ ] `J` / `K` navigation works without breaking mouse/touch navigation.
- [ ] `J` / `K` stay within the active suggestion queue.
- [ ] `J` / `K` stay within the active direction queue.
- [ ] Transfer, refund, and unknown rows show advisory explanation copy when
      those rows are available.
- [ ] `4` / `5` submit only the existing status forms when available.
- [ ] `1` focuses or highlights the common-expense confirmation area.
- [ ] `Enter` confirms only when the confirm form exists and is valid.
- [ ] Shortcuts do not fire while typing in note, category, or paid-by fields.
- [ ] Suggested `skip` quick apply appears and marks the item `skipped` without
      creating a ledger entry.
- [ ] Suggested `need_discussion` quick apply appears and marks the item
      `need_discussion` without creating a ledger entry.
- [ ] Quick-applied `skipped` and `need_discussion` items can reopen to
      `pending`.
- [ ] Manual status, personal, and common-expense controls remain available
      after quick-apply polish.
- [ ] `我的个人` works for an eligible non-imported item.
- [ ] `她的个人` / `对方个人` works for an eligible non-imported item when the
      other household member is available.
- [ ] Personal skip stores `final_owner_user_id`.
- [ ] Personal skip creates no `ledger_entries` or `ledger_entry_splits`.
- [ ] Personal skipped item can reopen to `pending`.

## Security And Static Checklist

- [ ] No service role usage.
- [ ] No Supabase admin API usage.
- [ ] No RLS bypass.
- [ ] No `localStorage` or `sessionStorage` as a data source.
- [ ] No `.env.local` commit.
- [ ] No `SUPABASE_DB_URL` printing.
- [ ] No generated Supabase Database types.
- [ ] No real bill files committed.
- [ ] No DELETE policy on import tables.
- [ ] No hard delete.
- [ ] No settlement snapshot mutation.
- [ ] No settlement confirmation mutation.
- [ ] No payment or real transfer behavior.
- [ ] No one-click batch import into the official ledger.
- [ ] No batch confirm-all behavior.
- [ ] Import Review continue-entry overview is SELECT/read-only derived UI.
- [ ] Import Review continue-entry navigation does not update `import_items`.
- [ ] Import Review continue-entry navigation does not update `import_batches`.
- [ ] Import Review continue-entry navigation does not change `ledger_entries`
      count.
- [ ] Import Review continue-entry navigation does not mutate settlement data.
- [ ] Direction filters are SELECT/read-only derived UI.
- [ ] Direction filtering does not update `import_items` rows.
- [ ] Direction filtering does not change `ledger_entries` count.
- [ ] No package changes unless a later explicit task asks for them.

Useful static searches for future Import Review code changes:

```powershell
rg -n "service_role|SUPABASE_SERVICE|auth\.admin|localStorage|sessionStorage|allowed_user_emails" src supabase
rg -n "insert\(|update\(|delete\(|upsert\(" src/app/imports src/lib/import-review
rg -n "settlement_snapshots|settlement_confirmations" src/app/imports src/lib/import-review supabase/migrations/20260624_add_import_item_confirm_rpc.sql supabase/migrations/20260624_add_import_item_personal_skip_rpc.sql
```

Interpret mutation matches in context. Import Review V1 intentionally writes
through the four constrained RPCs listed above; parser/upload should not create
official ledger rows, and settlement rows should not be mutated by import
review.

## Known Limitations

- Personal ledger records are deferred.
- Importing personal expenses into official ledger records is deferred.
- Custom split is deferred.
- Refund auto-linking is deferred.
- Batch confirm-all is deferred.
- Undo/reopen imported item is deferred.
- Realtime collaboration is deferred.
- AI final decision is not supported.
- Voice recognition is not supported.
- No original file archive is stored.
- Normalized transaction fingerprint for rows without stable source ids remains
  a future product/schema decision.

## When To Update This File

Update this checklist when:

- parser behavior changes;
- import schema/RLS changes;
- `create_import_batch_v1` changes;
- `update_import_item_review_status_v1` changes;
- `confirm_import_item_to_ledger_v1` changes;
- upload behavior changes;
- review card behavior changes;
- settlement interaction behavior changes;
- personal skip behavior changes;
- personal ledger support is added;
- custom split is added;
- keyboard shortcuts are added;
- realtime collaboration is added;
- deployment or smoke procedure changes;
- `package.json` gains dedicated `lint`, `typecheck`, or `test` scripts.

## Verification Commands For This Document

For documentation-only updates to this checklist:

```powershell
git diff --name-only
git diff --check
git diff --cached --check
git status --short -- .env.local package.json package-lock.json supabase src fixtures
```

Expected documentation-only result:

- only `IMPORT_REVIEW_V1_REGRESSION.md` changes;
- no `src/**` changes;
- no `supabase/**` changes;
- no fixture or real bill file changes;
- no SQL execution;
- no RLS changes;
- no API route added;
- no server action added;
- no helper changed;
- no package changes;
- no generated Supabase Database types;
- no `.env.local` commit;
- no real bill file commit;
- no service role, Supabase admin API, RLS bypass, `localStorage`,
  `sessionStorage`, payment-provider, or real-transfer change;
- no `calculateSettlement` change;
- no `getSettlementSummary` change.

`npm run build` is optional for this doc-only checklist. If skipped, report that
it was skipped because only Markdown changed.
