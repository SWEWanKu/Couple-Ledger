import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ImportReviewParserError,
  parseAlipayCsv,
  parseWeChatXlsx,
  type ImportSource,
  type NormalizedImportItemDraft
} from "@/lib/import-review";

export type ImportReviewHouseholdMembership = {
  household_id: string;
  role: string;
};

export type ImportBatchStatus = "parsed" | "reviewing" | "completed";

export type ImportBatchSummary = {
  id: string;
  source: ImportSource;
  fileName: string;
  status: ImportBatchStatus;
  periodStart: string | null;
  periodEnd: string | null;
  totalCount: number;
  parsedCount: number;
  reviewedCount: number;
  importedCount: number;
  skippedCount: number;
  needDiscussionCount: number;
  pendingCount: number;
  createdAt: string;
};

export type ImportBatchListResult = {
  batches: ImportBatchSummary[];
  warning: string | null;
};

export type ImportBatchReviewSummaryResult =
  | {
      ok: true;
      batch: ImportBatchSummary;
      warning: string | null;
    }
  | {
      ok: false;
      reason: "not_found" | "read_failed";
      warning: string | null;
    };

export type CreateImportBatchErrorCode =
  | "unauthenticated"
  | "not_household_member"
  | "empty_file"
  | "file_too_large"
  | "invalid_source"
  | "unsupported_format"
  | "parse_failed"
  | "empty_items"
  | "duplicate_source_transaction"
  | "create_failed";

export type CreateImportBatchResult =
  | {
      ok: true;
      batchId: string;
      itemCount: number;
      duplicate: boolean;
    }
  | {
      ok: false;
      errorCode: CreateImportBatchErrorCode;
    };

type ImportBatchRow = {
  id: string;
  source: string;
  file_name: string;
  status: string;
  period_start: string | null;
  period_end: string | null;
  total_count: number | null;
  parsed_count: number | null;
  reviewed_count: number | null;
  imported_count: number | null;
  skipped_count: number | null;
  need_discussion_count: number | null;
  created_at: string;
};

type CreateImportBatchRpcResult = {
  status?: unknown;
  batch_id?: unknown;
  item_count?: unknown;
};

const maxUploadBytes = 10 * 1024 * 1024;
const importBatchReadWarning = "待对账账单暂时没有读完整，稍后再翻这页会更稳。";

export async function getImportReviewHouseholdMembership(
  supabase: SupabaseClient,
  userId: string
): Promise<ImportReviewHouseholdMembership | null> {
  const { data, error } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as ImportReviewHouseholdMembership;
}

export async function listImportBatches(
  supabase: SupabaseClient,
  {
    householdId,
    limit = 20
  }: {
    householdId: string;
    limit?: number;
  }
): Promise<ImportBatchListResult> {
  const { data, error } = await supabase
    .from("import_batches")
    .select(
      [
        "id",
        "source",
        "file_name",
        "status",
        "period_start",
        "period_end",
        "total_count",
        "parsed_count",
        "reviewed_count",
        "imported_count",
        "skipped_count",
        "need_discussion_count",
        "created_at"
      ].join(", ")
    )
    .eq("household_id", householdId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return {
      batches: [],
      warning: importBatchReadWarning
    };
  }

  return {
    batches: ((data ?? []) as unknown as ImportBatchRow[]).map(mapImportBatchRow),
    warning: null
  };
}

export async function getImportBatchReviewSummary(
  supabase: SupabaseClient,
  {
    householdId,
    batchId
  }: {
    householdId: string;
    batchId: string;
  }
): Promise<ImportBatchReviewSummaryResult> {
  if (!isUuid(batchId)) {
    return {
      ok: false,
      reason: "not_found",
      warning: null
    };
  }

  const { data, error } = await supabase
    .from("import_batches")
    .select(
      [
        "id",
        "source",
        "file_name",
        "status",
        "period_start",
        "period_end",
        "total_count",
        "parsed_count",
        "reviewed_count",
        "imported_count",
        "skipped_count",
        "need_discussion_count",
        "created_at"
      ].join(", ")
    )
    .eq("household_id", householdId)
    .eq("id", batchId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      reason: "read_failed",
      warning: importBatchReadWarning
    };
  }

  if (!data) {
    return {
      ok: false,
      reason: "not_found",
      warning: null
    };
  }

  return {
    ok: true,
    batch: mapImportBatchRow(data as unknown as ImportBatchRow),
    warning: null
  };
}

export async function createImportBatchFromFile(
  supabase: SupabaseClient,
  {
    householdId,
    source,
    file
  }: {
    householdId: string;
    source: string | null;
    file: File | null;
  }
): Promise<CreateImportBatchResult> {
  const normalizedSource = normalizeImportSource(source);

  if (!normalizedSource) {
    return { ok: false, errorCode: "invalid_source" };
  }

  if (!file || file.size <= 0) {
    return { ok: false, errorCode: "empty_file" };
  }

  if (file.size > maxUploadBytes) {
    return { ok: false, errorCode: "file_too_large" };
  }

  const fileName = normalizeUploadFileName(file.name, normalizedSource);

  if (!isSupportedSourceFile(fileName, normalizedSource)) {
    return { ok: false, errorCode: "unsupported_format" };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const items = await parseImportFile(normalizedSource, bytes).catch((error: unknown) => {
    if (error instanceof ImportReviewParserError) {
      return null;
    }

    return null;
  });

  if (!items) {
    return { ok: false, errorCode: "parse_failed" };
  }

  if (items.length === 0) {
    return { ok: false, errorCode: "empty_items" };
  }

  const fileSha256 = createHash("sha256").update(bytes).digest("hex");
  const period = getImportBatchPeriod(items);
  const { data, error } = await supabase.rpc("create_import_batch_v1", {
    p_household_id: householdId,
    p_source: normalizedSource,
    p_file_name: fileName,
    p_file_sha256: fileSha256,
    p_period_start: period.start,
    p_period_end: period.end,
    p_items: items
  });

  if (error) {
    return { ok: false, errorCode: "create_failed" };
  }

  return normalizeCreateImportBatchRpcResult(data);
}

export function getCreateImportBatchErrorMessage(code: string | null | undefined) {
  if (!code || !(code in createImportBatchErrorMessages)) {
    return null;
  }

  return createImportBatchErrorMessages[code as CreateImportBatchErrorCode];
}

export function getImportSourceLabel(source: ImportSource) {
  return source === "wechat" ? "微信支付账单" : "支付宝账单";
}

export function getImportBatchStatusLabel(status: ImportBatchStatus) {
  if (status === "completed") {
    return "已整理完";
  }

  if (status === "reviewing") {
    return "正在对账";
  }

  return "待对账";
}

export function getImportBatchStatusTone(status: ImportBatchStatus) {
  if (status === "completed") {
    return "border-[#82d5bb] bg-[#e9fbf4] text-[#1f7a70]";
  }

  if (status === "reviewing") {
    return "border-[#f7cd67] bg-[#fff8da] text-[#8a6420]";
  }

  return "border-[#d9c49b] bg-[#fffdf3] text-[#794f27]";
}

export function getMaxImportUploadMegabytes() {
  return maxUploadBytes / 1024 / 1024;
}

function mapImportBatchRow(row: ImportBatchRow): ImportBatchSummary {
  const parsedCount = toSafeCount(row.parsed_count);
  const reviewedCount = toSafeCount(row.reviewed_count);

  return {
    id: row.id,
    source: isImportSource(row.source) ? row.source : "alipay",
    fileName: row.file_name,
    status: isImportBatchStatus(row.status) ? row.status : "parsed",
    periodStart: row.period_start,
    periodEnd: row.period_end,
    totalCount: toSafeCount(row.total_count),
    parsedCount,
    reviewedCount,
    importedCount: toSafeCount(row.imported_count),
    skippedCount: toSafeCount(row.skipped_count),
    needDiscussionCount: toSafeCount(row.need_discussion_count),
    pendingCount: Math.max(parsedCount - reviewedCount, 0),
    createdAt: row.created_at
  };
}

async function parseImportFile(source: ImportSource, bytes: Buffer) {
  if (source === "wechat") {
    return parseWeChatXlsx(bytes);
  }

  return parseAlipayCsv(bytes);
}

function normalizeCreateImportBatchRpcResult(value: unknown): CreateImportBatchResult {
  const result = (value ?? {}) as CreateImportBatchRpcResult;
  const status = typeof result.status === "string" ? result.status : null;
  const batchId = typeof result.batch_id === "string" ? result.batch_id : null;
  const itemCount = typeof result.item_count === "number" ? result.item_count : 0;

  if ((status === "created" || status === "already_exists") && batchId) {
    return {
      ok: true,
      batchId,
      itemCount,
      duplicate: status === "already_exists"
    };
  }

  if (status === "unauthenticated") {
    return { ok: false, errorCode: "unauthenticated" };
  }

  if (status === "not_household_member") {
    return { ok: false, errorCode: "not_household_member" };
  }

  if (status === "empty_items") {
    return { ok: false, errorCode: "empty_items" };
  }

  if (status === "item_insert_failed") {
    return { ok: false, errorCode: "duplicate_source_transaction" };
  }

  return { ok: false, errorCode: "create_failed" };
}

function getImportBatchPeriod(items: NormalizedImportItemDraft[]) {
  const dates = items
    .map((item) => item.transactionTime.slice(0, 10))
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort();

  return {
    start: dates[0] ?? null,
    end: dates[dates.length - 1] ?? null
  };
}

function normalizeImportSource(source: string | null): ImportSource | null {
  return isImportSource(source) ? source : null;
}

function isImportSource(value: unknown): value is ImportSource {
  return value === "wechat" || value === "alipay";
}

function isImportBatchStatus(value: unknown): value is ImportBatchStatus {
  return value === "parsed" || value === "reviewing" || value === "completed";
}

function normalizeUploadFileName(name: string, source: ImportSource) {
  const fallback = source === "wechat" ? "wechat-bill.xlsx" : "alipay-bill.csv";
  const baseName = name.split(/[\\/]/).pop()?.trim();

  return (baseName || fallback).slice(0, 180);
}

function isSupportedSourceFile(fileName: string, source: ImportSource) {
  const lower = fileName.toLowerCase();

  return source === "wechat" ? lower.endsWith(".xlsx") : lower.endsWith(".csv");
}

function toSafeCount(value: number | null) {
  return Number.isFinite(value) && value !== null ? Math.max(0, value) : 0;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

const createImportBatchErrorMessages: Record<CreateImportBatchErrorCode, string> = {
  unauthenticated: "还没有登录，请先回到登录页。",
  not_household_member: "还没有登上共同小岛，暂时不能导入账单。",
  empty_file: "这份文件是空的，请重新选择微信或支付宝导出的账单。",
  file_too_large: `这份文件超过 ${getMaxImportUploadMegabytes()}MB，先换一份小一点的账单试试。`,
  invalid_source: "请选择账单来源：微信支付或支付宝。",
  unsupported_format: "文件格式和来源不匹配：微信请上传 .xlsx，支付宝请上传 .csv。",
  parse_failed: "这份账单暂时没有读懂，请确认是官方导出的微信或支付宝流水文件。",
  empty_items: "账单里没有找到可放进待对账池的流水。",
  duplicate_source_transaction: "这份账单里有疑似已经导入过的交易号，先去待对账池看看已有批次。",
  create_failed: "放进待对账池时小岛信号断了一下，请稍后再试。"
};
