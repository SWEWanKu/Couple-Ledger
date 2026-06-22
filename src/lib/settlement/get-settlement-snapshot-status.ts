import type { SupabaseClient } from "@supabase/supabase-js";
import type { SettlementConfirmationRow } from "@/lib/settlement/confirm-settlement-snapshot";
import type { SettlementSnapshotRow } from "@/lib/settlement/create-settlement-snapshot";
import { getSettlementMonthRange } from "@/lib/settlement/get-settlement-summary";
import type { SettlementMonthMetadata } from "@/types/settlement";

export type SettlementSnapshotStatus =
  | "no_snapshot"
  | "proposed"
  | "partially_confirmed"
  | "fully_confirmed";

export type GetSettlementSnapshotStatusInput = {
  householdId: string;
  month?: string | null;
  now?: Date;
};

type SettlementSnapshotStatusBase = {
  month: SettlementMonthMetadata;
  requiredConfirmationCount: number;
  confirmations: SettlementConfirmationRow[];
};

export type GetSettlementSnapshotStatusResult =
  | (SettlementSnapshotStatusBase & {
      status: "no_snapshot";
      snapshot: null;
      errorCode?: never;
    })
  | (SettlementSnapshotStatusBase & {
      status: Exclude<SettlementSnapshotStatus, "no_snapshot">;
      snapshot: SettlementSnapshotRow;
      errorCode?: never;
    })
  | {
      status: "error";
      month: SettlementMonthMetadata;
      snapshot: null;
      confirmations: [];
      requiredConfirmationCount: 0;
      errorCode: "confirmations_read_failed" | "members_read_failed" | "snapshot_read_failed";
    };

type HouseholdMemberRow = {
  user_id: string;
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

const settlementConfirmationSelect = [
  "id",
  "settlement_snapshot_id",
  "confirmed_by",
  "confirmed_at"
].join(", ");

export async function getSettlementSnapshotStatus(
  supabase: SupabaseClient,
  { householdId, month, now = new Date() }: GetSettlementSnapshotStatusInput
): Promise<GetSettlementSnapshotStatusResult> {
  const monthMetadata = getSettlementMonthRange(month, now);
  const { data: memberData, error: memberError } = await supabase
    .from("household_members")
    .select("user_id")
    .eq("household_id", householdId);

  if (memberError) {
    return createErrorResult(monthMetadata, "members_read_failed");
  }

  const requiredConfirmationCount = new Set(
    ((memberData ?? []) as unknown as HouseholdMemberRow[]).map((member) => member.user_id)
  ).size;
  const { data: snapshotData, error: snapshotError } = await supabase
    .from("settlement_snapshots")
    .select(settlementSnapshotSelect)
    .eq("household_id", householdId)
    .eq("month_start", monthMetadata.monthStart)
    .maybeSingle();

  if (snapshotError) {
    return createErrorResult(monthMetadata, "snapshot_read_failed");
  }

  if (!snapshotData) {
    return {
      status: "no_snapshot",
      month: monthMetadata,
      snapshot: null,
      confirmations: [],
      requiredConfirmationCount
    };
  }

  const snapshot = snapshotData as unknown as SettlementSnapshotRow;
  const { data: confirmationData, error: confirmationError } = await supabase
    .from("settlement_confirmations")
    .select(settlementConfirmationSelect)
    .eq("settlement_snapshot_id", snapshot.id)
    .order("confirmed_at", { ascending: true });

  if (confirmationError) {
    return createErrorResult(monthMetadata, "confirmations_read_failed");
  }

  const confirmations = (confirmationData ?? []) as unknown as SettlementConfirmationRow[];
  const confirmedCount = new Set(confirmations.map((confirmation) => confirmation.confirmed_by)).size;

  return {
    status: getSnapshotStatus(confirmedCount, requiredConfirmationCount),
    month: monthMetadata,
    snapshot,
    confirmations,
    requiredConfirmationCount
  };
}

function getSnapshotStatus(
  confirmedCount: number,
  requiredConfirmationCount: number
): Exclude<SettlementSnapshotStatus, "no_snapshot"> {
  if (confirmedCount === 0) {
    return "proposed";
  }

  if (requiredConfirmationCount > 0 && confirmedCount >= requiredConfirmationCount) {
    return "fully_confirmed";
  }

  return "partially_confirmed";
}

function createErrorResult(
  month: SettlementMonthMetadata,
  errorCode: Extract<GetSettlementSnapshotStatusResult, { status: "error" }>["errorCode"]
): Extract<GetSettlementSnapshotStatusResult, { status: "error" }> {
  return {
    status: "error",
    month,
    snapshot: null,
    confirmations: [],
    requiredConfirmationCount: 0,
    errorCode
  };
}
