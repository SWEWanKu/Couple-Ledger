import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ImportDirection,
  ImportRawJson,
  ImportReviewStatus,
  ImportSource,
  SuggestedReviewAction
} from "@/lib/import-review";
import type { ImportBatchSummary } from "@/lib/import-review/batches";
import { suggestImportReviewFields } from "./suggestions";

export type ImportReviewStatusFilter = ImportReviewStatus | "all";
export type ImportReviewSuggestionFilter = SuggestedReviewAction | "all";
export type ImportReviewDirectionFilter = ImportDirection | "all";

export type ImportReviewItem = {
  id: string;
  source: ImportSource;
  sourceTransactionId: string | null;
  transactionTime: string;
  monthKey: string;
  direction: ImportDirection;
  amountCents: number;
  counterparty: string | null;
  description: string | null;
  paymentMethod: string | null;
  sourceCategory: string | null;
  sourceStatus: string | null;
  rawJson: ImportRawJson;
  reviewStatus: ImportReviewStatus;
  suggestedCategory: string | null;
  suggestedReviewAction: SuggestedReviewAction | null;
  finalOwnerUserId: string | null;
  finalSplitType: "equal" | "personal" | null;
  finalNote: string | null;
  ledgerEntryId: string | null;
  createdAt: string;
};

export type ImportReviewStatusCounts = Record<ImportReviewStatusFilter, number>;
export type ImportReviewSuggestionCounts = Record<ImportReviewSuggestionFilter, number>;
export type ImportReviewDirectionCounts = Record<ImportReviewDirectionFilter, number>;

export type ImportReviewCardState = {
  statusFilter: ImportReviewStatusFilter;
  suggestionFilter: ImportReviewSuggestionFilter;
  directionFilter: ImportReviewDirectionFilter;
  items: ImportReviewItem[];
  totalItems: number;
  selectedItem: ImportReviewItem | null;
  selectedIndex: number;
  previousItem: ImportReviewItem | null;
  nextItem: ImportReviewItem | null;
  counts: ImportReviewStatusCounts;
  suggestionCounts: ImportReviewSuggestionCounts;
  directionCounts: ImportReviewDirectionCounts;
  warning: string | null;
};

export type ImportReviewStatusActionTarget = "skipped" | "need_discussion";

export type UpdateImportItemReviewStatusResult =
  | {
      status: "updated";
      batchId: string;
      itemId: string;
      reviewStatus: ImportReviewStatusActionTarget;
      nextItemId: string | null;
      reviewedCount: number;
      importedCount: number;
      skippedCount: number;
      needDiscussionCount: number;
      batchStatus: string | null;
    }
  | {
      status:
        | "unauthenticated"
        | "not_household_member"
        | "not_found"
        | "already_imported"
        | "invalid_status"
        | "invalid_transition"
        | "invalid_input"
        | "error";
    };

export type MarkImportItemPersonalResult =
  | {
      status: "personal_skipped";
      batchId: string;
      itemId: string;
      ownerUserId: string;
      nextItemId: string | null;
      reviewedCount: number;
      importedCount: number;
      skippedCount: number;
      needDiscussionCount: number;
      batchStatus: string | null;
    }
  | {
      status:
        | "unauthenticated"
        | "not_household_member"
        | "not_found"
        | "already_imported"
        | "invalid_owner"
        | "invalid_transition"
        | "invalid_input"
        | "error";
      batchId?: string;
      itemId?: string;
      ownerUserId?: string;
    };

export type ConfirmImportItemToLedgerResult =
  | {
      status: "confirmed";
      batchId: string;
      itemId: string;
      ledgerEntryId: string;
      nextItemId: string | null;
      reviewedCount: number;
      importedCount: number;
      skippedCount: number;
      needDiscussionCount: number;
      batchStatus: string | null;
    }
  | {
      status:
        | "unauthenticated"
        | "not_household_member"
        | "not_found"
        | "already_reviewed"
        | "invalid_input"
        | "invalid_category"
        | "invalid_paid_by"
        | "invalid_split_type"
        | "unsupported_direction"
        | "invalid_amount"
        | "missing_members"
        | "blocked_pending_replacement"
        | "entry_insert_failed"
        | "split_insert_failed"
        | "item_update_failed"
        | "batch_update_failed"
        | "error";
    };

export type ReopenImportItemToPendingResult =
  | {
      status: "reopened";
      batchId: string;
      itemId: string;
      reviewedCount: number;
      importedCount: number;
      skippedCount: number;
      needDiscussionCount: number;
      batchStatus: string | null;
    }
  | {
      status:
        | "unauthenticated"
        | "not_household_member"
        | "not_found"
        | "already_pending"
        | "already_imported"
        | "invalid_transition"
        | "invalid_input"
        | "error";
      batchId?: string;
      itemId?: string;
    };

type ListImportItemsForReviewInput = {
  householdId: string;
  batchId: string;
  statusFilter: ImportReviewStatusFilter;
  suggestionFilter: ImportReviewSuggestionFilter;
  directionFilter: ImportReviewDirectionFilter;
};

type ImportItemRow = {
  id: string;
  source: string;
  source_transaction_id: string | null;
  transaction_time: string;
  month_key: string;
  direction: string;
  amount_cents: number | string;
  counterparty: string | null;
  description: string | null;
  payment_method: string | null;
  source_category: string | null;
  source_status: string | null;
  raw_json: ImportRawJson | null;
  review_status: string;
  suggested_category: string | null;
  final_owner_user_id: string | null;
  final_split_type: string | null;
  final_note: string | null;
  ledger_entry_id: string | null;
  created_at: string;
};

type UpdateImportItemReviewStatusRpcResult = {
  status?: unknown;
  batch_id?: unknown;
  item_id?: unknown;
  review_status?: unknown;
  next_item_id?: unknown;
  reviewed_count?: unknown;
  imported_count?: unknown;
  skipped_count?: unknown;
  need_discussion_count?: unknown;
  batch_status?: unknown;
};

type MarkImportItemPersonalRpcResult = {
  status?: unknown;
  batch_id?: unknown;
  item_id?: unknown;
  owner_user_id?: unknown;
  next_item_id?: unknown;
  reviewed_count?: unknown;
  imported_count?: unknown;
  skipped_count?: unknown;
  need_discussion_count?: unknown;
  batch_status?: unknown;
};

type ConfirmImportItemToLedgerRpcResult = {
  status?: unknown;
  batch_id?: unknown;
  item_id?: unknown;
  ledger_entry_id?: unknown;
  next_item_id?: unknown;
  reviewed_count?: unknown;
  imported_count?: unknown;
  skipped_count?: unknown;
  need_discussion_count?: unknown;
  batch_status?: unknown;
};

type ReopenImportItemToPendingRpcResult = {
  status?: unknown;
  batch_id?: unknown;
  item_id?: unknown;
  reviewed_count?: unknown;
  imported_count?: unknown;
  skipped_count?: unknown;
  need_discussion_count?: unknown;
  batch_status?: unknown;
};

const itemReadWarning = "这份待对账清单暂时没有读完整，先显示能安全读取的部分。";
const reviewStatuses: ImportReviewStatus[] = ["pending", "imported", "skipped", "need_discussion"];
const suggestionFilters: ImportReviewSuggestionFilter[] = ["all", "skip", "need_discussion", "review"];
const directionFilters: ImportReviewDirectionFilter[] = ["all", "expense", "income", "refund", "transfer", "unknown"];

export async function listImportItemsForReview(
  supabase: SupabaseClient,
  { householdId, batchId, statusFilter, suggestionFilter, directionFilter }: ListImportItemsForReviewInput
): Promise<{
  items: ImportReviewItem[];
  suggestionCounts: ImportReviewSuggestionCounts;
  directionCounts: ImportReviewDirectionCounts;
  warning: string | null;
}> {
  let query = supabase
    .from("import_items")
    .select(
      [
        "id",
        "source",
        "source_transaction_id",
        "transaction_time",
        "month_key",
        "direction",
        "amount_cents",
        "counterparty",
        "description",
        "payment_method",
        "source_category",
        "source_status",
        "raw_json",
        "review_status",
        "suggested_category",
        "final_owner_user_id",
        "final_split_type",
        "final_note",
        "ledger_entry_id",
        "created_at"
      ].join(", ")
    )
    .eq("household_id", householdId)
    .eq("batch_id", batchId);

  if (statusFilter !== "all") {
    query = query.eq("review_status", statusFilter);
  }

  const { data, error } = await query
    .order("transaction_time", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    return {
      items: [],
      suggestionCounts: getEmptySuggestionCounts(),
      directionCounts: getEmptyDirectionCounts(),
      warning: itemReadWarning
    };
  }

  const items = ((data ?? []) as unknown as ImportItemRow[]).map(mapImportItemRow);
  const suggestionCounts = getSuggestionCounts(items);
  const suggestionFilteredItems = filterItemsBySuggestion(items, suggestionFilter);
  const directionCounts = getDirectionCounts(suggestionFilteredItems);

  return {
    items: filterItemsByDirection(suggestionFilteredItems, directionFilter),
    suggestionCounts,
    directionCounts,
    warning: null
  };
}

export function getImportReviewCardState({
  batch,
  items,
  statusFilter,
  suggestionFilter,
  directionFilter,
  suggestionCounts,
  directionCounts,
  itemId,
  index
}: {
  batch: ImportBatchSummary;
  items: ImportReviewItem[];
  statusFilter: ImportReviewStatusFilter;
  suggestionFilter: ImportReviewSuggestionFilter;
  directionFilter: ImportReviewDirectionFilter;
  suggestionCounts: ImportReviewSuggestionCounts;
  directionCounts: ImportReviewDirectionCounts;
  itemId?: string | null;
  index?: string | null;
}): ImportReviewCardState {
  const selectedIndex = getSelectedIndex(items, { statusFilter, itemId, index });
  const selectedItem = selectedIndex >= 0 ? items[selectedIndex] ?? null : null;

  return {
    statusFilter,
    suggestionFilter,
    directionFilter,
    items,
    totalItems: items.length,
    selectedItem,
    selectedIndex,
    previousItem: selectedIndex > 0 ? items[selectedIndex - 1] ?? null : null,
    nextItem: selectedIndex >= 0 ? items[selectedIndex + 1] ?? null : null,
    counts: getCountsFromBatch(batch),
    suggestionCounts,
    directionCounts,
    warning: null
  };
}

export function normalizeImportReviewStatusFilter(
  value: string | string[] | null | undefined
): ImportReviewStatusFilter {
  const status = Array.isArray(value) ? value[0] : value;

  if (status === "all" || isImportReviewStatus(status)) {
    return status;
  }

  return "pending";
}

export function normalizeImportReviewSuggestionFilter(
  value: string | string[] | null | undefined
): ImportReviewSuggestionFilter {
  const suggestion = Array.isArray(value) ? value[0] : value;

  if (isImportReviewSuggestionFilter(suggestion)) {
    return suggestion;
  }

  return "all";
}

export function normalizeImportReviewDirectionFilter(
  value: string | string[] | null | undefined
): ImportReviewDirectionFilter {
  const direction = Array.isArray(value) ? value[0] : value;

  if (isImportReviewDirectionFilter(direction)) {
    return direction;
  }

  return "all";
}

export function getImportItemDisplaySuggestion(item: ImportReviewItem): {
  category: string | null;
  reviewAction: SuggestedReviewAction;
} {
  if (item.suggestedReviewAction) {
    return {
      category: item.suggestedCategory,
      reviewAction: item.suggestedReviewAction
    };
  }

  const fallback = suggestImportReviewFields({
    direction: item.direction,
    counterparty: item.counterparty,
    description: item.description,
    sourceCategory: item.sourceCategory,
    sourceStatus: item.sourceStatus,
    paymentMethod: item.paymentMethod
  });

  return {
    category: item.suggestedCategory ?? fallback.suggestedCategory,
    reviewAction: fallback.suggestedReviewAction
  };
}

export async function updateImportItemReviewStatus(
  supabase: SupabaseClient,
  {
    batchId,
    itemId,
    reviewStatus
  }: {
    batchId: string | null;
    itemId: string | null;
    reviewStatus: string | null;
  }
): Promise<UpdateImportItemReviewStatusResult> {
  if (!isUuid(batchId) || !isUuid(itemId)) {
    return { status: "not_found" };
  }

  if (!isReviewStatusActionTarget(reviewStatus)) {
    return { status: "invalid_status" };
  }

  const { data, error } = await supabase.rpc("update_import_item_review_status_v1", {
    p_batch_id: batchId,
    p_item_id: itemId,
    p_review_status: reviewStatus,
    p_note: null
  });

  if (error) {
    return { status: "error" };
  }

  return normalizeUpdateImportItemReviewStatusRpcResult(data);
}

export async function markImportItemPersonal(
  supabase: SupabaseClient,
  {
    batchId,
    itemId,
    ownerUserId,
    note
  }: {
    batchId: string | null;
    itemId: string | null;
    ownerUserId: string | null;
    note: string | null;
  }
): Promise<MarkImportItemPersonalResult> {
  if (!isUuid(batchId) || !isUuid(itemId)) {
    return { status: "not_found" };
  }

  if (!isUuid(ownerUserId)) {
    return { status: "invalid_owner" };
  }

  const { data, error } = await supabase.rpc("mark_import_item_personal_v1", {
    p_batch_id: batchId,
    p_item_id: itemId,
    p_owner_user_id: ownerUserId,
    p_note: note
  });

  if (error) {
    return { status: "error" };
  }

  return normalizeMarkImportItemPersonalRpcResult(data);
}

export async function confirmImportItemToLedger(
  supabase: SupabaseClient,
  {
    batchId,
    itemId,
    categoryId,
    paidByUserId,
    splitType,
    note
  }: {
    batchId: string | null;
    itemId: string | null;
    categoryId: string | null;
    paidByUserId: string | null;
    splitType: string | null;
    note: string | null;
  }
): Promise<ConfirmImportItemToLedgerResult> {
  if (!isUuid(batchId) || !isUuid(itemId)) {
    return { status: "not_found" };
  }

  if (!isUuid(categoryId)) {
    return { status: "invalid_category" };
  }

  if (!isUuid(paidByUserId)) {
    return { status: "invalid_paid_by" };
  }

  if (splitType !== "equal") {
    return { status: "invalid_split_type" };
  }

  const { data, error } = await supabase.rpc("confirm_import_item_to_ledger_v1", {
    p_batch_id: batchId,
    p_item_id: itemId,
    p_category: categoryId,
    p_paid_by_user_id: paidByUserId,
    p_note: note,
    p_split_type: splitType
  });

  if (error) {
    return { status: "error" };
  }

  return normalizeConfirmImportItemToLedgerRpcResult(data);
}

export async function reopenImportItemToPending(
  supabase: SupabaseClient,
  {
    batchId,
    itemId
  }: {
    batchId: string | null;
    itemId: string | null;
  }
): Promise<ReopenImportItemToPendingResult> {
  if (!isUuid(batchId) || !isUuid(itemId)) {
    return { status: "not_found" };
  }

  const { data, error } = await supabase.rpc("reopen_import_item_to_pending_v1", {
    p_batch_id: batchId,
    p_item_id: itemId
  });

  if (error) {
    return { status: "error" };
  }

  return normalizeReopenImportItemToPendingRpcResult(data);
}

function getSelectedIndex(
  items: ImportReviewItem[],
  {
    statusFilter,
    itemId,
    index
  }: {
    statusFilter: ImportReviewStatusFilter;
    itemId?: string | null;
    index?: string | null;
  }
) {
  if (itemId) {
    const byId = items.findIndex((item) => item.id === itemId);

    if (byId >= 0) {
      return byId;
    }
  }

  const byIndex = parseHumanIndex(index);

  if (byIndex !== null && byIndex >= 0 && byIndex < items.length) {
    return byIndex;
  }

  if (statusFilter === "all") {
    const firstPending = items.findIndex((item) => item.reviewStatus === "pending");

    if (firstPending >= 0) {
      return firstPending;
    }
  }

  return items.length > 0 ? 0 : -1;
}

function mapImportItemRow(row: ImportItemRow): ImportReviewItem {
  const rawJson = row.raw_json && typeof row.raw_json === "object" ? row.raw_json : {};

  return {
    id: row.id,
    source: isImportSource(row.source) ? row.source : "alipay",
    sourceTransactionId: normalizeText(row.source_transaction_id),
    transactionTime: row.transaction_time,
    monthKey: row.month_key,
    direction: isImportDirection(row.direction) ? row.direction : "unknown",
    amountCents: toSafeCents(row.amount_cents),
    counterparty: normalizeText(row.counterparty),
    description: normalizeText(row.description),
    paymentMethod: normalizeText(row.payment_method),
    sourceCategory: normalizeText(row.source_category),
    sourceStatus: normalizeText(row.source_status),
    rawJson,
    reviewStatus: isImportReviewStatus(row.review_status) ? row.review_status : "pending",
    suggestedCategory: normalizeText(row.suggested_category),
    suggestedReviewAction: readSuggestedReviewAction(rawJson),
    finalOwnerUserId: isUuidValue(row.final_owner_user_id) ? row.final_owner_user_id : null,
    finalSplitType: isFinalSplitType(row.final_split_type) ? row.final_split_type : null,
    finalNote: normalizeText(row.final_note),
    ledgerEntryId: isUuidValue(row.ledger_entry_id) ? row.ledger_entry_id : null,
    createdAt: row.created_at
  };
}

function getCountsFromBatch(batch: ImportBatchSummary): ImportReviewStatusCounts {
  return {
    all: batch.parsedCount,
    pending: batch.pendingCount,
    imported: batch.importedCount,
    skipped: batch.skippedCount,
    need_discussion: batch.needDiscussionCount
  };
}

function getEmptySuggestionCounts(): ImportReviewSuggestionCounts {
  return {
    all: 0,
    skip: 0,
    need_discussion: 0,
    review: 0
  };
}

function getEmptyDirectionCounts(): ImportReviewDirectionCounts {
  return {
    all: 0,
    expense: 0,
    income: 0,
    refund: 0,
    transfer: 0,
    unknown: 0
  };
}

function getSuggestionCounts(items: ImportReviewItem[]): ImportReviewSuggestionCounts {
  const counts = getEmptySuggestionCounts();

  for (const item of items) {
    const suggestion = getImportItemDisplaySuggestion(item).reviewAction;
    counts.all += 1;
    counts[suggestion] += 1;
  }

  return counts;
}

function getDirectionCounts(items: ImportReviewItem[]): ImportReviewDirectionCounts {
  const counts = getEmptyDirectionCounts();

  for (const item of items) {
    counts.all += 1;
    counts[item.direction] += 1;
  }

  return counts;
}

function filterItemsBySuggestion(
  items: ImportReviewItem[],
  suggestionFilter: ImportReviewSuggestionFilter
) {
  if (suggestionFilter === "all") {
    return items;
  }

  return items.filter((item) => getImportItemDisplaySuggestion(item).reviewAction === suggestionFilter);
}

function filterItemsByDirection(
  items: ImportReviewItem[],
  directionFilter: ImportReviewDirectionFilter
) {
  if (directionFilter === "all") {
    return items;
  }

  return items.filter((item) => item.direction === directionFilter);
}

function readSuggestedReviewAction(rawJson: ImportRawJson): SuggestedReviewAction | null {
  const action =
    rawJson.suggestedReviewAction ??
    rawJson.suggested_review_action ??
    rawJson.suggestedAction ??
    rawJson.suggested_action;

  return isSuggestedReviewAction(action) ? action : null;
}

function parseHumanIndex(value: string | null | undefined) {
  if (!value || !/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed - 1;
}

function normalizeText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function toSafeCents(value: number | string) {
  const cents = Number(value);
  return Number.isSafeInteger(cents) && cents >= 0 ? cents : 0;
}

function isImportSource(value: unknown): value is ImportSource {
  return value === "wechat" || value === "alipay";
}

function isImportDirection(value: unknown): value is ImportDirection {
  return (
    value === "expense" ||
    value === "income" ||
    value === "transfer" ||
    value === "refund" ||
    value === "unknown"
  );
}

function isImportReviewStatus(value: unknown): value is ImportReviewStatus {
  return reviewStatuses.includes(value as ImportReviewStatus);
}

function isSuggestedReviewAction(value: unknown): value is SuggestedReviewAction {
  return value === "review" || value === "skip" || value === "need_discussion";
}

function isImportReviewSuggestionFilter(value: unknown): value is ImportReviewSuggestionFilter {
  return suggestionFilters.includes(value as ImportReviewSuggestionFilter);
}

function isImportReviewDirectionFilter(value: unknown): value is ImportReviewDirectionFilter {
  return directionFilters.includes(value as ImportReviewDirectionFilter);
}

function isFinalSplitType(value: unknown): value is "equal" | "personal" {
  return value === "equal" || value === "personal";
}

function normalizeUpdateImportItemReviewStatusRpcResult(
  value: unknown
): UpdateImportItemReviewStatusResult {
  const result = (value ?? {}) as UpdateImportItemReviewStatusRpcResult;

  if (
    result.status === "updated" &&
    isUuidValue(result.batch_id) &&
    isUuidValue(result.item_id) &&
    isReviewStatusActionTarget(result.review_status)
  ) {
    return {
      status: "updated",
      batchId: result.batch_id,
      itemId: result.item_id,
      reviewStatus: result.review_status,
      nextItemId: isUuidValue(result.next_item_id) ? result.next_item_id : null,
      reviewedCount: toSafeCount(result.reviewed_count),
      importedCount: toSafeCount(result.imported_count),
      skippedCount: toSafeCount(result.skipped_count),
      needDiscussionCount: toSafeCount(result.need_discussion_count),
      batchStatus: typeof result.batch_status === "string" ? result.batch_status : null
    };
  }

  if (
    result.status === "unauthenticated" ||
    result.status === "not_household_member" ||
    result.status === "not_found" ||
    result.status === "already_imported" ||
    result.status === "invalid_status" ||
    result.status === "invalid_transition" ||
    result.status === "invalid_input"
  ) {
    return {
      status: result.status
    };
  }

  return { status: "error" };
}

function normalizeMarkImportItemPersonalRpcResult(value: unknown): MarkImportItemPersonalResult {
  const result = (value ?? {}) as MarkImportItemPersonalRpcResult;
  const batchId = isUuidValue(result.batch_id) ? result.batch_id : undefined;
  const itemId = isUuidValue(result.item_id) ? result.item_id : undefined;
  const ownerUserId = isUuidValue(result.owner_user_id) ? result.owner_user_id : undefined;

  if (result.status === "personal_skipped" && batchId && itemId && ownerUserId) {
    return {
      status: "personal_skipped",
      batchId,
      itemId,
      ownerUserId,
      nextItemId: isUuidValue(result.next_item_id) ? result.next_item_id : null,
      reviewedCount: toSafeCount(result.reviewed_count),
      importedCount: toSafeCount(result.imported_count),
      skippedCount: toSafeCount(result.skipped_count),
      needDiscussionCount: toSafeCount(result.need_discussion_count),
      batchStatus: typeof result.batch_status === "string" ? result.batch_status : null
    };
  }

  if (
    result.status === "unauthenticated" ||
    result.status === "not_household_member" ||
    result.status === "not_found" ||
    result.status === "already_imported" ||
    result.status === "invalid_owner" ||
    result.status === "invalid_transition" ||
    result.status === "invalid_input"
  ) {
    return {
      status: result.status,
      batchId,
      itemId,
      ownerUserId
    };
  }

  return { status: "error" };
}

function normalizeConfirmImportItemToLedgerRpcResult(
  value: unknown
): ConfirmImportItemToLedgerResult {
  const result = (value ?? {}) as ConfirmImportItemToLedgerRpcResult;

  if (
    result.status === "confirmed" &&
    isUuidValue(result.batch_id) &&
    isUuidValue(result.item_id) &&
    isUuidValue(result.ledger_entry_id)
  ) {
    return {
      status: "confirmed",
      batchId: result.batch_id,
      itemId: result.item_id,
      ledgerEntryId: result.ledger_entry_id,
      nextItemId: isUuidValue(result.next_item_id) ? result.next_item_id : null,
      reviewedCount: toSafeCount(result.reviewed_count),
      importedCount: toSafeCount(result.imported_count),
      skippedCount: toSafeCount(result.skipped_count),
      needDiscussionCount: toSafeCount(result.need_discussion_count),
      batchStatus: typeof result.batch_status === "string" ? result.batch_status : null
    };
  }

  if (
    result.status === "unauthenticated" ||
    result.status === "not_household_member" ||
    result.status === "not_found" ||
    result.status === "already_reviewed" ||
    result.status === "invalid_input" ||
    result.status === "invalid_category" ||
    result.status === "invalid_paid_by" ||
    result.status === "invalid_split_type" ||
    result.status === "unsupported_direction" ||
    result.status === "invalid_amount" ||
    result.status === "missing_members" ||
    result.status === "blocked_pending_replacement" ||
    result.status === "entry_insert_failed" ||
    result.status === "split_insert_failed" ||
    result.status === "item_update_failed" ||
    result.status === "batch_update_failed"
  ) {
    return {
      status: result.status
    };
  }

  return { status: "error" };
}

function normalizeReopenImportItemToPendingRpcResult(
  value: unknown
): ReopenImportItemToPendingResult {
  const result = (value ?? {}) as ReopenImportItemToPendingRpcResult;
  const batchId = isUuidValue(result.batch_id) ? result.batch_id : undefined;
  const itemId = isUuidValue(result.item_id) ? result.item_id : undefined;

  if (result.status === "reopened" && batchId && itemId) {
    return {
      status: "reopened",
      batchId,
      itemId,
      reviewedCount: toSafeCount(result.reviewed_count),
      importedCount: toSafeCount(result.imported_count),
      skippedCount: toSafeCount(result.skipped_count),
      needDiscussionCount: toSafeCount(result.need_discussion_count),
      batchStatus: typeof result.batch_status === "string" ? result.batch_status : null
    };
  }

  if (
    result.status === "unauthenticated" ||
    result.status === "not_household_member" ||
    result.status === "not_found" ||
    result.status === "already_pending" ||
    result.status === "already_imported" ||
    result.status === "invalid_transition" ||
    result.status === "invalid_input"
  ) {
    return {
      status: result.status,
      batchId,
      itemId
    };
  }

  return { status: "error" };
}

function isReviewStatusActionTarget(value: unknown): value is ImportReviewStatusActionTarget {
  return value === "skipped" || value === "need_discussion";
}

function toSafeCount(value: unknown) {
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

function isUuidValue(value: unknown): value is string {
  return typeof value === "string" && isUuid(value);
}

function isUuid(value: string | null | undefined) {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}
