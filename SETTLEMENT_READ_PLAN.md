# Settlement Read Plan

## Current state

- `/dashboard` currently shows a settlement placeholder only. It does not calculate or display a real transfer suggestion yet.
- `/records/new` can create expense and income records.
- Record creation already writes the main row to `ledger_entries` and then writes responsibility rows to `ledger_entry_splits`.
- `/records/[id]` can read a single record and its split breakdown from `ledger_entry_splits`.
- `/records` can list existing household-scoped ledger entries.
- No `/settlement` page exists yet.
- Current dashboard month logic reads `ledger_entries` for the current calendar month with `occurred_on >= monthStart` and `occurred_on < nextMonthStart`.

## Goal

Create a future read-only settlement view that answers:

> 谁应该转给谁多少钱？

The first version should support the current two-person household and the existing persisted split rows. Later versions may support more household members, but the two-person version must not hide assumptions inside UI copy or frontend-only state.

The settlement view should:

- read household-scoped data after the same private route guard used by `/dashboard`, `/records`, and `/records/[id]`
- calculate member paid totals, share totals, and net balances
- produce a clear transfer suggestion for the selected month
- show safe warning states when split data is incomplete
- stay read-only until a separate write/payment-confirmation design exists

## Non-goals

- no writes
- no payment confirmation
- no marking settled
- no editing records
- no deleting records
- no migrations
- no SQL execution
- no service role
- no localStorage
- no bypassing RLS
- no new Auth or allowlist behavior
- no route implementation in this task
- no dashboard link change in this task
- no historical settlement persistence
- no payment provider or external transfer integration

## Data involved

The future read helper should use existing tables only.

### `ledger_entries`

Purpose:

- The parent record for each expense or income event.

Fields needed:

- `id`
- `household_id`
- `amount`
- `entry_type`
- `paid_by`
- `split_mode`
- `occurred_on`
- `created_at`

Settlement relevance:

- The future settlement calculation uses expense entries only.
- `paid_by` identifies who paid the original bill.
- `amount` contributes to that member's paid amount.
- Income records may still be displayed elsewhere, but they do not change settlement debt.

### `ledger_entry_splits`

Purpose:

- The persisted source of truth for each member's responsibility for a ledger entry.

Fields needed:

- `entry_id`
- `user_id`
- `share_amount`

Settlement relevance:

- Each split row increases that member's share amount.
- Settlement should not infer shares from `split_mode` alone.
- If split rows are missing or do not add up to the parent expense amount, the view must show `分摊数据待完善`.

### `household_members`

Purpose:

- Defines which users belong to the current private household.
- Provides the member set used to initialize paid/share totals.

Fields needed:

- `household_id`
- `user_id`
- `role`
- `joined_at`

Settlement relevance:

- Only members of the current household should appear.
- More than two members should be treated as a future expansion path, not silently forced through the two-person shortcut.

### `profiles`

Purpose:

- Optional display labels for member names.

Fields needed:

- `id`
- `display_name`

Settlement relevance:

- Use when readable through current RLS.
- Fall back to neutral labels such as `你`, `成员 2`, or `小岛成员` if profile display is unavailable.

### `categories`

Purpose:

- Optional display-only labels for record context.

Fields needed:

- `id`
- `name`
- `icon`
- `color`

Settlement relevance:

- Categories are not needed for the core calculation.
- A future UI may show category context for the included expenses, but category data must not affect settlement amounts.

## Query boundary

The future implementation must:

- use the existing server Supabase client
- run after household access guard
- scope all reads by current household id
- rely on RLS as the real data boundary
- never use service role credentials
- never query `allowed_user_emails`
- never trust frontend-only checks
- never read unscoped ledger rows and filter them in the browser
- keep `allowed_user_emails` as admin-only setup data, not app read data

Recommended read sequence:

1. Server route checks `supabase.auth.getUser()`.
2. Anonymous user redirects to `/login`.
3. Query `household_members` for the current user's membership.
4. User without membership redirects to `/not-invited`.
5. Read current household members for the verified `household_id`.
6. Read monthly expense `ledger_entries` scoped by `household_id`.
7. Read `ledger_entry_splits` only for the verified entry ids.
8. Optionally read `profiles` and `categories` for display labels.

Default date range should match the current dashboard month range:

- current calendar month
- `occurred_on >= monthStart`
- `occurred_on < nextMonthStart`
- date boundaries formatted as `YYYY-MM-DD`

Future URL support can add `?month=YYYY-MM`, but invalid or missing values should fall back to the current month or a friendly empty state. This should be server-side and must not move authority to the browser.

## Calculation rules

The calculation should be deterministic and money-safe.

Core rules:

- settlement uses expense entries only
- income entries are ignored for settlement
- every included expense contributes:
  - `paid_by` increases paid amount by `ledger_entries.amount`
  - each `ledger_entry_splits.user_id` increases share amount by `share_amount`
- for each member:
  - `net = paidAmount - shareAmount`
- if `net > 0`, that member should receive money
- if `net < 0`, that member owes money
- if `net = 0`, that member is balanced

Two-person shortcut:

- Find the member with negative `net`.
- Find the member with positive `net`.
- The debtor pays the creditor `abs(debtor.net)`.
- If both nets are zero after rounding, show no settlement needed.

Rounding:

- Treat database amounts as 2-decimal money values.
- Convert to integer cents in the calculation helper when possible.
- Round final display to 2 decimals.
- Avoid binary floating-point drift in the pure calculation helper.

Validation:

- Sum paid amounts should equal sum included expense entry amounts.
- Sum share amounts should equal sum included expense entry amounts.
- For each entry, split rows should add up to the parent entry amount.
- If split rows are missing or do not sum to the entry amount, do not guess silently.
- Show `分摊数据待完善` and keep the affected transfer suggestion unavailable or clearly marked incomplete.

Important non-inference rule:

- `split_mode` can explain how a record was intended to be split, but `ledger_entry_splits` is the amount source of truth.
- Settlement must not recalculate member shares from `split_mode` unless a separate data repair task explicitly does that.

## Split mode handling

### `equal`

- Use persisted `ledger_entry_splits`.
- Do not recalculate equal shares during settlement.
- Equal split rows are written by the record creation path and may include cent remainder handling.
- If equal split rows are missing or mismatched, show `分摊数据待完善`.

### `personal`

- Use persisted `ledger_entry_splits`.
- Current write logic normally creates one split row assigned to the responsible member.
- If `paid_by` equals the responsible member and share equals the full amount, the entry creates no shared debt.
- If a personal entry has a different payer/responsible member in the future, the persisted split row still determines who owes.

### `custom`

- The schema supports `custom`, but current UI does not create custom splits yet.
- Future settlement should still rely on split rows.
- A custom entry without valid split rows is incomplete.

Settlement should not infer from `split_mode` alone; split rows are source of truth.

## Empty and edge states

### No entries

- Show `这个月还不用结算`.
- Paid amount, share amount, total shared expense, and transfer suggestion are all zero.

### No expenses

- If the month has no expense entries, show no settlement needed.
- Income-only months should not create settlement debt.

### Only income

- Ignore income for settlement.
- The UI may mention that income is visible in ledger totals but does not affect settlement.

### Missing split rows

- Show `分摊数据待完善`.
- Do not derive shares from `split_mode`.
- Do not show a confident transfer suggestion.

### Split totals mismatch

- Show `分摊数据待完善`.
- Include a gentle explanation that one or more record split rows need review.
- Do not hide the mismatch behind rounded display totals.

### Only one household member

- Show no settlement needed.
- Explain that settlement needs at least two household members.

### More than two household members

- Do not apply the two-person shortcut silently.
- The pure calculation helper can still compute each member's net.
- A later design should define a multi-member debt simplification algorithm before showing transfer suggestions.

### Deleted category or missing profile display

- Deleted/missing category should fall back to `未分类`.
- Missing profile should fall back to neutral member labels.
- Missing display data must not block core settlement math if ids and split amounts are valid.

### Cross-household record

- Must not appear.
- Reads are scoped by verified `household_id` and RLS.
- A URL or query param must never be enough to expose data from another household.

## UI direction

The future page should use the same scrapbook / island notebook language as the private app shell.

Page title ideas:

- `小岛结算`
- `月底小算盘`

Show:

- selected month
- total shared expense
- each member paid amount
- each member share amount
- each member net amount
- final transfer suggestion
- warning state when split data is incomplete

Copy examples:

- `这个月还不用结算`
- `分摊数据待完善`
- `建议转账`
- `这个月的小票已经算清楚啦`
- `先补齐分摊贴纸，再给出转账建议`

Visual style:

- hand-account memo
- sticker balance tags
- soft parchment card
- small transfer stamp
- warm brown text
- mint/yellow accents
- no enterprise table
- no corporate dashboard look
- no fake real-world transfer confirmation

Recommended page structure:

1. Header memo with selected month and read-only wording.
2. Total shared expense sticker.
3. Member balance cards:
   - paid amount
   - share amount
   - net amount
4. Transfer suggestion card:
   - no settlement needed
   - suggested debtor and creditor
   - incomplete split warning
5. Optional included expense list for transparency.

## Future implementation files

Suggested future files:

- `src/types/settlement.ts`
  - normalized read models and calculation result types
- `src/lib/settlement/calculate-settlement.ts`
  - pure calculation helper with deterministic examples
- `src/lib/settlement/get-settlement-summary.ts`
  - server read helper scoped by household and month
- `src/app/settlement/page.tsx`
  - protected read-only route and scrapbook UI

Potential later integration file:

- `src/components/layout/Sidebar.tsx`
  - add a navigation entry only after `/settlement` exists

Do not create these files in this design-only task.

## Verification plan

Future code task should verify these scenarios:

- no entries -> no settlement
- no expenses -> no settlement
- income-only month -> no settlement
- one equal expense paid by owner -> partner owes half
- one equal expense paid by partner -> owner owes half
- one personal expense -> no shared debt if `paid_by` equals responsible user
- mixed income and expense -> income ignored for settlement
- multiple expenses with opposite payers -> nets combine correctly
- missing split rows -> warning
- split mismatch -> warning
- one household member -> no settlement needed and clear copy
- more than two household members -> no two-person transfer shortcut unless separately designed
- missing profile -> neutral member label
- deleted category -> `未分类` display fallback if category is shown
- logged-out user redirects to `/login`
- non-member redirects to `/not-invited`
- cross-household record does not appear
- no service role
- no localStorage
- no writes
- no direct `allowed_user_emails` query

Suggested future command checks:

```powershell
rg -n "ledger_entries|ledger_entry_splits" src/app/settlement src/lib/settlement src/types/settlement.ts
rg -n "insert\(|update\(|delete\(|upsert\(|service_role|SUPABASE_SERVICE|localStorage|allowed_user_emails" src/app/settlement src/lib/settlement src/types/settlement.ts
npm run build
```

Expected future implementation result:

- read-only settlement page renders for household members
- all data is scoped by current household id
- RLS remains the real security boundary
- calculation helper can be tested without Supabase
- no source code uses service role or browser-only authority

## Implementation order

Recommended later tasks:

1. Build a pure calculation helper with deterministic unit-like examples.
2. Add a server read helper scoped by household and month.
3. Add read-only `/settlement` page.
4. Add dashboard/sidebar link to settlement.
5. Later, design optional settlement history or payment confirmation separately. Do not add that now.

