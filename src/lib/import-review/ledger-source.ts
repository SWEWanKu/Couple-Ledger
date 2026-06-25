import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImportReviewStatus, ImportSource } from "@/lib/import-review";

export type ImportLedgerSource = {
  importItemId: string;
  batchId: string;
  source: ImportSource;
  sourceTransactionId: string | null;
  transactionTime: string;
  monthKey: string;
  reviewStatus: "imported";
};

type GetImportSourceForLedgerEntryInput = {
  householdId: string;
  ledgerEntryId: string;
};

type GetImportSourceForLedgerEntryResult = {
  source: ImportLedgerSource | null;
  warning: string | null;
};

type ImportLedgerSourceRow = {
  id: string;
  batch_id: string;
  source: string;
  source_transaction_id: string | null;
  transaction_time: string;
  month_key: string;
  review_status: string;
};

const sourceReadWarning =
  "\u6765\u6e90\u5bf9\u8d26\u4fbf\u7b7e\u6682\u65f6\u6ca1\u6709\u8bfb\u5b8c\u6574\uff0c\u5148\u53ea\u663e\u793a\u6b63\u5f0f\u8d26\u5355\u3002";

export async function getImportSourceForLedgerEntry(
  supabase: SupabaseClient,
  { householdId, ledgerEntryId }: GetImportSourceForLedgerEntryInput
): Promise<GetImportSourceForLedgerEntryResult> {
  if (!isUuid(householdId) || !isUuid(ledgerEntryId)) {
    return { source: null, warning: null };
  }

  const { data, error } = await supabase
    .from("import_items")
    .select(
      [
        "id",
        "batch_id",
        "source",
        "source_transaction_id",
        "transaction_time",
        "month_key",
        "review_status"
      ].join(", ")
    )
    .eq("household_id", householdId)
    .eq("ledger_entry_id", ledgerEntryId)
    .eq("review_status", "imported")
    .order("reviewed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return {
      source: null,
      warning: sourceReadWarning
    };
  }

  if (!data) {
    return {
      source: null,
      warning: null
    };
  }

  return {
    source: mapImportLedgerSourceRow(data as unknown as ImportLedgerSourceRow),
    warning: null
  };
}

function mapImportLedgerSourceRow(row: ImportLedgerSourceRow): ImportLedgerSource {
  return {
    importItemId: row.id,
    batchId: row.batch_id,
    source: isImportSource(row.source) ? row.source : "alipay",
    sourceTransactionId: normalizeText(row.source_transaction_id),
    transactionTime: row.transaction_time,
    monthKey: normalizeMonthKey(row.month_key),
    reviewStatus: isImportedStatus(row.review_status) ? row.review_status : "imported"
  };
}

function isImportSource(value: unknown): value is ImportSource {
  return value === "wechat" || value === "alipay";
}

function isImportedStatus(value: unknown): value is Extract<ImportReviewStatus, "imported"> {
  return value === "imported";
}

function normalizeText(value: string | null | undefined) {
  const normalized = value?.trim();

  return normalized ? normalized : null;
}

function normalizeMonthKey(value: string) {
  return /^\d{4}-\d{2}$/.test(value) ? value : "";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}
