import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildSettlementSnapshotPayload,
  type BuildSettlementSnapshotPayloadErrorCode
} from "@/lib/settlement/build-settlement-snapshot-payload";
import { getSettlementSummary } from "@/lib/settlement/get-settlement-summary";

export type SettlementSnapshotRow = {
  id: string;
  household_id: string;
  month_start: string;
  created_by: string;
  created_at: string;
  total_expense_cents: number | string;
  transfer_from_user_id: string | null;
  transfer_to_user_id: string | null;
  transfer_amount_cents: number | string;
  expense_count: number;
  calculation_version: string;
  calculation_status: "ready" | "no_settlement_needed";
  source_fingerprint: string;
  snapshot: unknown;
};

export type CreateSettlementSnapshotInput = {
  householdId: string;
  month?: string | null;
  now?: Date;
};

export type CreateSettlementSnapshotResult =
  | {
      status: "created";
      snapshot: SettlementSnapshotRow;
    }
  | {
      status: "already_exists";
      snapshot: SettlementSnapshotRow;
    }
  | {
      status: "unauthenticated";
      snapshot: null;
      errorCode: "unauthenticated";
    }
  | {
      status: "error";
      snapshot: null;
      errorCode:
        | BuildSettlementSnapshotPayloadErrorCode
        | "existing_snapshot_read_failed"
        | "insert_failed";
    };

const settlementSnapshotSelect = [
  "id",
  "household_id",
  "month_start",
  "created_by",
  "created_at",
  "total_expense_cents",
  "transfer_from_user_id",
  "transfer_to_user_id",
  "transfer_amount_cents",
  "expense_count",
  "calculation_version",
  "calculation_status",
  "source_fingerprint",
  "snapshot"
].join(", ");

export async function createSettlementSnapshot(
  supabase: SupabaseClient,
  { householdId, month, now = new Date() }: CreateSettlementSnapshotInput
): Promise<CreateSettlementSnapshotResult> {
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      status: "unauthenticated",
      snapshot: null,
      errorCode: "unauthenticated"
    };
  }

  const summaryResult = await getSettlementSummary(supabase, {
    householdId,
    currentUserId: user.id,
    month,
    now
  });
  const built = buildSettlementSnapshotPayload({
    householdId,
    createdBy: user.id,
    createdAt: now,
    summaryResult
  });

  if (!built.ok) {
    return {
      status: "error",
      snapshot: null,
      errorCode: built.errorCode
    };
  }

  const { data, error } = await supabase
    .from("settlement_snapshots")
    .insert(built.payload)
    .select(settlementSnapshotSelect)
    .single();

  if (!error && data) {
    return {
      status: "created",
      snapshot: data as unknown as SettlementSnapshotRow
    };
  }

  if (isUniqueViolation(error)) {
    const existing = await getExistingSettlementSnapshot(supabase, {
      householdId,
      monthStart: built.payload.month_start
    });

    if (existing) {
      return {
        status: "already_exists",
        snapshot: existing
      };
    }

    return {
      status: "error",
      snapshot: null,
      errorCode: "existing_snapshot_read_failed"
    };
  }

  return {
    status: "error",
    snapshot: null,
    errorCode: "insert_failed"
  };
}

async function getExistingSettlementSnapshot(
  supabase: SupabaseClient,
  {
    householdId,
    monthStart
  }: {
    householdId: string;
    monthStart: string;
  }
) {
  const { data, error } = await supabase
    .from("settlement_snapshots")
    .select(settlementSnapshotSelect)
    .eq("household_id", householdId)
    .eq("month_start", monthStart)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as unknown as SettlementSnapshotRow;
}

function isUniqueViolation(error: { code?: string } | null) {
  return error?.code === "23505";
}
