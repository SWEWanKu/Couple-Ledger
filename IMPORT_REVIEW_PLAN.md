# 共同对账模式 Import Review Plan

> Documentation-only plan. This file does not implement schema, upload,
> parsing, UI routes, server actions, helpers, SQL, RLS changes, package
> changes, generated types, or write behavior.

## 1. Product Purpose

共同对账模式 is not one-click automatic bookkeeping. Its purpose is to help the
two household members sit together, look at imported WeChat or Alipay bills, and
decide one transaction at a time how it should enter the shared island ledger.

The product shape should feel like a warm couple notebook workflow:

- upload a bill file;
- parse it into one import batch and many pending review items;
- review one transaction card at a time;
- explicitly confirm a reviewed item before it becomes an official ledger
  record;
- ignore or mark uncertain items as need discussion;
- let existing monthly summaries and settlement helpers update naturally from
  official ledger records.

This must not feel like a bank import admin table, a corporate reconciliation
screen, or an automatic finance backend.

## 2. Routes

Future routes:

- `/imports` lists import batches and their progress.
- `/imports/new` uploads a WeChat xlsx or Alipay csv file.
- `/imports/[batchId]/review` is the core page and shows one review card at a
  time.
- `/imports/[batchId]` is optional future batch detail or archive view.

The MVP should treat `/imports/[batchId]/review` as the main experience. A
table-first batch screen can exist later as a support view, but it should not be
the first V1 user journey.

## 3. MVP Flow

1. A household member opens `/imports/new`.
2. They upload a WeChat xlsx or Alipay csv bill file.
3. The server parses the file into `import_batches` and `import_items`.
4. Upload and parse do not create official `ledger_entries`.
5. The user enters single-card review mode at `/imports/[batchId]/review`.
6. Each item asks: `这笔怎么记？`
7. The reviewer chooses one of:
   - common expense;
   - my personal expense;
   - partner personal expense;
   - ignore;
   - need discussion.
8. For ledger-bound items, the reviewer also chooses:
   - category;
   - paid_by / handler;
   - split type;
   - note.
9. `确认入账并下一条` creates exactly one official ledger record for that item.
10. The review card advances to the next pending item.
11. Progress is shown in a friendly way, such as `31 / 247`.

The official ledger remains the source of truth for `/records`, `/dashboard`,
monthly reports, and settlement. Imported rows are only a review queue and source
trail until explicitly confirmed.

## 4. Explicit MVP Non-Goals

V1 does not include:

- full automatic import into the official ledger;
- AI final decision;
- voice recognition;
- realtime multi-user cursor or presence;
- refund auto-linking;
- encrypted zip auto-unpack;
- complex report generation;
- batch confirm-all;
- table-first admin workflow;
- payment provider behavior;
- real transfer behavior;
- settlement snapshot mutation.

## 5. Database Plan

This section proposes future schema only. Do not create these tables in this
documentation task.

### `import_batches`

Proposed fields:

- `id`
- `household_id`
- `uploaded_by`
- `source`
- `file_name`
- `file_sha256`
- `period_start`
- `period_end`
- `total_count`
- `parsed_count`
- `reviewed_count`
- `imported_count`
- `skipped_count`
- `need_discussion_count`
- `status`
- `created_at`
- `updated_at`

Purpose:

- one row per uploaded bill file;
- household-scoped progress holder;
- file dedupe anchor via `file_sha256`;
- no official ledger meaning by itself.

### `import_items`

Proposed fields:

- `id`
- `batch_id`
- `household_id`
- `source`
- `source_transaction_id`
- `transaction_time`
- `month_key`
- `direction`
- `amount_cents`
- `counterparty`
- `description`
- `payment_method`
- `source_category`
- `source_status`
- `raw_json`
- `review_status`
- `suggested_category`
- `final_category`
- `final_owner_user_id`
- `final_paid_by_user_id`
- `final_split_type`
- `final_note`
- `ledger_entry_id`
- `reviewed_by`
- `reviewed_at`
- `created_at`
- `updated_at`

Purpose:

- one normalized source transaction per row;
- preserves parser source data through `raw_json`;
- stores review outcome and optional official ledger link;
- does not replace `ledger_entries` or `ledger_entry_splits`.

Money should use integer cents for imported source rows. Confirming to the
official ledger must preserve the existing ledger money semantics and must not
change `calculateSettlement` amount rules.

## 6. Status Vocabulary

Batch status:

- `parsed`: the file was accepted and normalized into import items, but review
  has not meaningfully started.
- `reviewing`: at least one item has been reviewed and there are still pending
  or need-discussion items.
- `completed`: every item in the batch is either imported, skipped, or otherwise
  intentionally closed by the chosen V1 completion rule.

Item status:

- `pending`: waiting for a household member to review.
- `imported`: explicitly confirmed into one official ledger entry and linked by
  `ledger_entry_id`.
- `skipped`: intentionally ignored; no official ledger entry exists.
- `need_discussion`: set aside for the two people to decide later; no official
  ledger entry exists yet.

V1 should avoid extra status vocabulary until duplicate and undo behavior is
locked. If duplicate detection is not final, keep `duplicate_suspected` as a
future decision rather than silently expanding the first status model.

## 7. RLS And Security Direction

Future import tables should follow the same security boundary as the current
private app:

- authenticated household members can select rows for their household;
- authenticated household members can insert import batches and items for their
  household;
- authenticated household members can update review state for rows in their
  household;
- `uploaded_by` and `reviewed_by` are derived from `auth.uid()`;
- the server must not trust client-provided `householdId`, `userId`,
  `uploaded_by`, or `reviewed_by`;
- do not use a service role in app code;
- do not use Supabase admin APIs;
- do not bypass RLS;
- do not read or write `allowed_user_emails` from app features;
- do not use `localStorage` or `sessionStorage` as a data source.

Source files and parsed source rows are private household data. The upload,
parser, review queue, and source trail should be treated with the same privacy
as the official ledger.

Policy shape should mirror existing household-member scoped policies and RPC
patterns. If a future confirm operation needs to atomically create a ledger
record and update an import item, prefer a constrained transaction-safe helper
or `SECURITY INVOKER` RPC rather than broad client-side multi-step writes.

## 8. File Upload And Parser Direction

V1 parser scope:

- WeChat xlsx;
- Alipay csv.

Parser expectations:

- normalize external rows into `import_items`;
- preserve original source fields in `raw_json` for audit and debugging;
- derive stable fields such as source, source transaction id, transaction time,
  amount, counterparty, description, payment method, source category, and source
  status;
- produce `amount_cents` without floating-point drift;
- create a friendly import error state when the file cannot be parsed;
- never create official ledger entries during upload or parsing.

Large upload strategy should be decided before implementation:

- define accepted file size limits;
- reject unsupported or very large files with warm product copy;
- avoid keeping oversized raw files in memory longer than necessary;
- store the original file long-term only if a later product/security decision
  explicitly requires it.

`file_sha256` should be calculated server-side and used to detect repeated file
uploads for the same household/source.

## 9. Dedupe Direction

Potential dedupe signals:

- `source + source_transaction_id`, when the source provides a stable id;
- `file_sha256` to detect the same uploaded file;
- normalized transaction fingerprint built from source, transaction time,
  direction, amount, counterparty, description, payment method, and source
  status.

Goals:

- avoid duplicate `import_items` when the same file is uploaded twice;
- avoid duplicate official `ledger_entries` when the same imported transaction
  is reviewed twice;
- keep duplicate behavior explainable to users.

V1 still needs one locked product rule:

- skip duplicate import items during parse; or
- import them but mark them as duplicate suspected and ask the user.

If source data is not reliable enough, keep this as a future decision and start
with a conservative duplicate warning rather than auto-importing ambiguous rows.

## 10. Review Card UX

The core UI is card-by-card, not table-first.

Each card should show:

- time;
- counterparty;
- description;
- direction;
- amount;
- source;
- payment method.

The decision area asks:

> 这笔怎么记？

Primary decision buttons:

- `共同支出`
- `我的个人`
- `她的个人`
- `忽略`
- `待确认`

Category shortcuts:

- `餐饮`
- `交通`
- `购物`
- `住房`
- `娱乐`
- `其他`

Split shortcuts:

- `平均`
- `我承担`
- `她承担`
- `自定义` later, not V1 unless custom split creation is already designed and
  supported.

Actions:

- `上一条`
- `下一条`
- `标记待确认`
- `忽略此条`
- `确认入账并下一条`

Visual direction:

- reuse the private scrapbook / island notebook language;
- use animal-island-ui components when future UI work begins;
- present the source transaction as a paper slip or sticker card;
- show progress as a small notebook stamp, for example `31 / 247`;
- avoid dense admin tables, cold finance dashboards, and bank-style import
  wording.

## 11. Keyboard Shortcut Plan

V1 may document shortcuts before implementation:

- `J`: next item;
- `K`: previous item;
- `1`: common expense;
- `2`: my personal expense;
- `3`: partner personal expense;
- `4`: ignore;
- `5`: need discussion;
- `Enter`: confirm the current reviewed decision.

Keyboard shortcuts must never bypass validation or explicit confirmation. If
implemented later, they should be progressive enhancement on top of the same
server-side review and confirm rules.

## 12. Suggestion Layer

The system may suggest a category or ignore state from deterministic rules.
Suggestions are never final.

Example rule direction:

- `美团` / `大众点评` / `外卖` -> `餐饮`
- `地铁` / `滴滴` / `哈啰` -> `交通`
- `提现` / `理财` / `余额宝` -> 建议忽略
- `退款` / `交易关闭` -> 建议忽略或待确认

UI copy should say:

- `系统建议`
- `最终由你们确认`

No AI final decision belongs in MVP. A future AI assist feature would need its
own privacy, explainability, and correction plan before it can affect review
defaults.

## 13. Confirm-To-Ledger Behavior

Confirming one `import_item` creates one official ledger entry using the same
semantics as existing record creation:

- derive the authenticated user and household server-side;
- validate category, payer, split type, and members against household data;
- create the official `ledger_entries` row and `ledger_entry_splits` rows with
  the same money and split rules as normal record creation;
- set `import_items.review_status = 'imported'`;
- set `import_items.ledger_entry_id`;
- set `reviewed_by` and `reviewed_at`;
- update import batch counters.

This must be atomic or safely transactional. The future implementation should
not perform a fragile sequence where the ledger entry succeeds but the import
item remains pending, or the import item is marked imported but the ledger write
fails.

Recommended future implementation direction:

- wrap confirm-to-ledger in one transaction-safe RPC or helper;
- keep the ledger create behavior aligned with `create_ledger_record_v1`;
- use normal authenticated Supabase/RLS context;
- make duplicate confirm retry-safe;
- return the existing linked ledger entry if the item was already imported.

Do not confirm during upload/parse. The user action on the review card is the
boundary where source data becomes official ledger data.

## 14. Ignore And Need Discussion Behavior

Ignore:

- sets `review_status = 'skipped'`;
- creates no official ledger entry;
- records `reviewed_by` and `reviewed_at`;
- updates batch skipped/reviewed counts.

Need discussion:

- sets `review_status = 'need_discussion'`;
- creates no official ledger entry;
- records `reviewed_by` and `reviewed_at`;
- keeps the item findable for later review.

Future undo/reopen behavior should be planned separately. V1 can postpone undo
as long as the status history is clear and users can return to
need-discussion items.

## 15. Relationship With Settlement

Un-settled month:

- confirming imported items into the official ledger is normal;
- dashboard, records, monthly report, and live settlement update naturally from
  the official ledger.

Proposed or partially confirmed active settlement month:

- show a warning that the live settlement can change after importing records;
- do not mutate settlement snapshots;
- do not mutate settlement confirmations.

Fully confirmed active settlement month:

- show a stronger warning:
  - the old settlement snapshot remains immutable;
  - live settlement may become outdated;
  - the replacement settlement flow handles realignment;
  - importing source rows is not a real payment or transfer action.

Pending replacement month:

- V1 recommendation: block `确认入账并下一条` for that month until the pending
  replacement is resolved.
- Reason: the pending replacement was proposed from a specific live
  fingerprint, and confirming more imported rows can stale both the active
  snapshot and the pending replacement at once.

Do not mutate old snapshots, pending replacements, or confirmations from the
import review flow.

## 16. Relationship With Record Mutation

Once confirmed, imported ledger entries behave like normal records:

- they appear in `/records`;
- they affect `/dashboard` and monthly reports;
- expense entries with valid split rows affect live settlement;
- they can later be edited through the existing record edit flow;
- they can later be soft-voided through the existing soft-void flow.

Soft-voided records remain excluded from normal reads and live settlement. The
linked `import_item` should remain as source trail and should not be deleted.
If the official record is later edited or soft-voided, the import item still
answers "where did this source transaction come from?"

Future implementation can add a read-only source badge on record detail, but it
must not turn `import_items` into the source of normal ledger truth.

## 17. History And Audit Expectations

`import_batches` and `import_items` are a private household audit trail:

- uploaded file metadata;
- parsed source transaction rows;
- review decisions;
- imported/skipped/need-discussion statuses;
- who reviewed and when;
- link from imported item to official ledger entry.

The official ledger remains the source for normal records and settlement.
Settlement snapshots remain immutable historical notes. Import history should
help explain how a record entered the ledger, not replace the ledger or rewrite
old settlement snapshots.

## 18. Rollout Plan

1. Documentation plan.
2. Locked V1 decisions doc.
3. Schema/RLS migration for `import_batches` and `import_items`.
4. Parser-only helpers with sample WeChat and Alipay files.
5. Upload page and batch creation.
6. Review read helper and card UI.
7. Confirm / skip / need-discussion actions.
8. Settlement warning integration.
9. Keyboard shortcuts.
10. Regression checklist.

Each step should be its own focused branch. Do not mix parser, schema, UI,
settlement, and write-path work in one change.

## 19. Testing Plan

Future implementation should verify:

- parse WeChat xlsx sample;
- parse Alipay csv sample;
- duplicate file detection;
- upload creates a batch but no ledger entries;
- review card displays the first pending item;
- confirm one item creates one ledger entry;
- skipped item creates no ledger entry;
- need-discussion item creates no ledger entry;
- confirmed item disappears from the pending queue;
- progress counts update;
- settled month warning appears;
- pending-replacement month blocks confirm;
- RLS prevents non-household access;
- `uploaded_by` and `reviewed_by` cannot be spoofed by the client;
- no service role/admin/RLS bypass is used;
- no old settlement snapshot mutation occurs;
- no `localStorage` or `sessionStorage` data authority is introduced;
- duplicate confirm is retry-safe;
- imported official records can still be edited or soft-voided through existing
  record flows;
- soft-voided imported records disappear from normal reads and live settlement.

Suggested future static checks:

```powershell
rg -n "service_role|SUPABASE_SERVICE|auth\.admin|localStorage|sessionStorage|allowed_user_emails" src supabase
rg -n "insert\(|update\(|delete\(|upsert\(" src/app/imports src/lib/imports
npm run build
```

Interpret mutation matches in context. Confirm-to-ledger is an intentional
future write path only when a dedicated implementation task adds it.

## 20. Open Questions

1. Should personal expense be imported into the shared ledger or skipped?
2. If personal expense is imported, how should split/share be represented?
3. Should `她自己的` create a ledger entry or be skipped as non-shared?
4. Should upload store the original file or only parsed rows?
5. Should duplicate source transactions be blocked or marked duplicate?
6. Should refunds be ignored, linked, or imported as income?
7. Should custom split be allowed in V1 review?
8. Should pending-replacement months block confirm or only warn?
9. Should need-discussion items appear in the main queue or a separate tab?
10. Should batch completion be automatic when all items are reviewed?

## Current Task Verification Checklist

This documentation task is complete only if:

- `IMPORT_REVIEW_PLAN.md` is the only changed file;
- no `src/**` file changed;
- no `supabase/**` file changed;
- no SQL was executed;
- no RLS was changed;
- no API route or server action was added;
- no helper was added or changed;
- no UI page was added or changed;
- no parser or upload code was added;
- no `package.json` or `package-lock.json` changed;
- no generated Supabase Database types were created;
- no `.env.local` change was staged or committed;
- no service role, Supabase admin API, RLS bypass, `localStorage`, or
  `sessionStorage` data source was introduced;
- `calculateSettlement` amount rules remain unchanged;
- `getSettlementSummary` remains unchanged;
- record write behavior remains unchanged;
- settlement behavior remains unchanged;
- `npm run build`, `git diff --check`, and `git diff --cached --check` pass
  before merge.
