import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ImportDirection,
  ImportRawJson,
  ImportReviewStatus,
  ImportSource,
  SuggestedReviewAction
} from "@/lib/import-review";
import type { ImportBatchSummary } from "@/lib/import-review/batches";

export type ImportReviewStatusFilter = ImportReviewStatus | "all";

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
  createdAt: string;
};

export type ImportReviewStatusCounts = Record<ImportReviewStatusFilter, number>;

export type ImportReviewCardState = {
  statusFilter: ImportReviewStatusFilter;
  items: ImportReviewItem[];
  totalItems: number;
  selectedItem: ImportReviewItem | null;
  selectedIndex: number;
  previousItem: ImportReviewItem | null;
  nextItem: ImportReviewItem | null;
  counts: ImportReviewStatusCounts;
  warning: string | null;
};

type ListImportItemsForReviewInput = {
  householdId: string;
  batchId: string;
  statusFilter: ImportReviewStatusFilter;
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
  created_at: string;
};

const itemReadWarning = "这份待对账清单暂时没有读完整，先显示能安全读取的部分。";
const reviewStatuses: ImportReviewStatus[] = ["pending", "imported", "skipped", "need_discussion"];

export async function listImportItemsForReview(
  supabase: SupabaseClient,
  { householdId, batchId, statusFilter }: ListImportItemsForReviewInput
): Promise<{ items: ImportReviewItem[]; warning: string | null }> {
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
      warning: itemReadWarning
    };
  }

  return {
    items: ((data ?? []) as unknown as ImportItemRow[]).map(mapImportItemRow),
    warning: null
  };
}

export function getImportReviewCardState({
  batch,
  items,
  statusFilter,
  itemId,
  index
}: {
  batch: ImportBatchSummary;
  items: ImportReviewItem[];
  statusFilter: ImportReviewStatusFilter;
  itemId?: string | null;
  index?: string | null;
}): ImportReviewCardState {
  const selectedIndex = getSelectedIndex(items, { statusFilter, itemId, index });
  const selectedItem = selectedIndex >= 0 ? items[selectedIndex] ?? null : null;

  return {
    statusFilter,
    items,
    totalItems: items.length,
    selectedItem,
    selectedIndex,
    previousItem: selectedIndex > 0 ? items[selectedIndex - 1] ?? null : null,
    nextItem: selectedIndex >= 0 ? items[selectedIndex + 1] ?? null : null,
    counts: getCountsFromBatch(batch),
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
