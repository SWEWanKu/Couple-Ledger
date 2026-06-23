import type { SupabaseClient } from "@supabase/supabase-js";

export type ConfirmSettlementReplacementSnapshotInput = {
  settlementSnapshotId: string;
};

export type ConfirmSettlementReplacementSnapshotStatus =
  | "confirmed"
  | "already_confirmed"
  | "partially_confirmed"
  | "fully_confirmed"
  | "not_pending_replacement"
  | "not_found"
  | "unauthenticated"
  | "not_household_member"
  | "error";

export type ConfirmSettlementReplacementSnapshotResult = {
  status: ConfirmSettlementReplacementSnapshotStatus;
  snapshotId: string | null;
  replacedSnapshotId: string | null;
  confirmedCount: number;
  requiredCount: number;
  errorCode?: "rpc_failed" | "rpc_error" | "unexpected_response";
};

type ReplacementConfirmationRpcRow = {
  status: unknown;
  snapshot_id?: unknown;
  replaced_snapshot_id?: unknown;
  confirmed_count?: unknown;
  required_count?: unknown;
};

const replacementConfirmationStatuses = new Set<ConfirmSettlementReplacementSnapshotStatus>([
  "confirmed",
  "already_confirmed",
  "partially_confirmed",
  "fully_confirmed",
  "not_pending_replacement",
  "not_found",
  "unauthenticated",
  "not_household_member",
  "error"
]);

export async function confirmSettlementReplacementSnapshot(
  supabase: SupabaseClient,
  { settlementSnapshotId }: ConfirmSettlementReplacementSnapshotInput
): Promise<ConfirmSettlementReplacementSnapshotResult> {
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return createResult({
      status: "unauthenticated",
      snapshotId: settlementSnapshotId
    });
  }

  const { data, error } = await supabase.rpc("confirm_settlement_replacement_snapshot", {
    p_snapshot_id: settlementSnapshotId
  });

  if (error) {
    return createResult({
      status: "error",
      snapshotId: settlementSnapshotId,
      errorCode: "rpc_failed"
    });
  }

  const row = normalizeRpcRow(data);

  if (!row) {
    return createResult({
      status: "error",
      snapshotId: settlementSnapshotId,
      errorCode: "unexpected_response"
    });
  }

  return createResult({
    status: row.status,
    snapshotId: row.snapshotId ?? settlementSnapshotId,
    replacedSnapshotId: row.replacedSnapshotId,
    confirmedCount: row.confirmedCount,
    requiredCount: row.requiredCount,
    errorCode: row.status === "error" ? "rpc_error" : undefined
  });
}

function normalizeRpcRow(value: unknown) {
  const row = Array.isArray(value) ? value[0] : value;

  if (!row || typeof row !== "object") {
    return null;
  }

  const candidate = row as ReplacementConfirmationRpcRow;

  if (!isReplacementConfirmationStatus(candidate.status)) {
    return null;
  }

  return {
    status: candidate.status,
    snapshotId: normalizeNullableString(candidate.snapshot_id),
    replacedSnapshotId: normalizeNullableString(candidate.replaced_snapshot_id),
    confirmedCount: normalizeInteger(candidate.confirmed_count),
    requiredCount: normalizeInteger(candidate.required_count)
  };
}

function isReplacementConfirmationStatus(
  value: unknown
): value is ConfirmSettlementReplacementSnapshotStatus {
  return (
    typeof value === "string" &&
    replacementConfirmationStatuses.has(value as ConfirmSettlementReplacementSnapshotStatus)
  );
}

function normalizeNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function normalizeInteger(value: unknown) {
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;

  return Number.isFinite(numberValue) ? Math.max(0, Math.trunc(numberValue)) : 0;
}

function createResult({
  status,
  snapshotId,
  replacedSnapshotId = null,
  confirmedCount = 0,
  requiredCount = 0,
  errorCode
}: {
  status: ConfirmSettlementReplacementSnapshotStatus;
  snapshotId: string | null;
  replacedSnapshotId?: string | null;
  confirmedCount?: number;
  requiredCount?: number;
  errorCode?: ConfirmSettlementReplacementSnapshotResult["errorCode"];
}): ConfirmSettlementReplacementSnapshotResult {
  return {
    status,
    snapshotId,
    replacedSnapshotId,
    confirmedCount,
    requiredCount,
    ...(errorCode ? { errorCode } : {})
  };
}
