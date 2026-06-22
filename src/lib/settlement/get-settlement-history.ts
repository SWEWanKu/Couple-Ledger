import type { SupabaseClient } from "@supabase/supabase-js";
import type { SettlementSnapshotJson } from "@/lib/settlement/build-settlement-snapshot-payload";
import type { SettlementConfirmationRow } from "@/lib/settlement/confirm-settlement-snapshot";
import type { SettlementSnapshotRow } from "@/lib/settlement/create-settlement-snapshot";

export type SettlementHistoryStatus = "proposed" | "partially_confirmed" | "fully_confirmed";

export type SettlementHistoryItem = {
  snapshot: SettlementSnapshotRow;
  snapshotJson: SettlementSnapshotJson | null;
  monthKey: string;
  monthLabel: string;
  confirmationCount: number;
  memberCount: number;
  currentUserConfirmed: boolean;
  status: SettlementHistoryStatus;
  confirmations: SettlementConfirmationRow[];
};

export type GetSettlementHistoryInput = {
  householdId: string;
  currentUserId?: string | null;
  limit?: number;
};

export type GetSettlementHistoryResult =
  | {
      status: "ok";
      items: SettlementHistoryItem[];
      memberCount: number;
      errorCode?: never;
    }
  | {
      status: "unauthenticated";
      items: [];
      memberCount: 0;
      errorCode: "unauthenticated";
    }
  | {
      status: "error";
      items: [];
      memberCount: 0;
      errorCode: "members_read_failed" | "snapshots_read_failed" | "confirmations_read_failed";
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

export async function getSettlementHistory(
  supabase: SupabaseClient,
  { householdId, currentUserId, limit = 24 }: GetSettlementHistoryInput
): Promise<GetSettlementHistoryResult> {
  const userId = currentUserId ?? (await getAuthenticatedUserId(supabase));

  if (!userId) {
    return {
      status: "unauthenticated",
      items: [],
      memberCount: 0,
      errorCode: "unauthenticated"
    };
  }

  const { data: memberData, error: memberError } = await supabase
    .from("household_members")
    .select("user_id")
    .eq("household_id", householdId)
    .order("joined_at", { ascending: true });

  if (memberError) {
    return createErrorResult("members_read_failed");
  }

  const memberCount = new Set(
    ((memberData ?? []) as unknown as HouseholdMemberRow[]).map((member) => member.user_id)
  ).size;
  const { data: snapshotData, error: snapshotError } = await supabase
    .from("settlement_snapshots")
    .select(settlementSnapshotSelect)
    .eq("household_id", householdId)
    .order("month_start", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(clampHistoryLimit(limit));

  if (snapshotError) {
    return createErrorResult("snapshots_read_failed");
  }

  const snapshots = (snapshotData ?? []) as unknown as SettlementSnapshotRow[];

  if (snapshots.length === 0) {
    return {
      status: "ok",
      items: [],
      memberCount
    };
  }

  const { data: confirmationData, error: confirmationError } = await supabase
    .from("settlement_confirmations")
    .select(settlementConfirmationSelect)
    .in(
      "settlement_snapshot_id",
      snapshots.map((snapshot) => snapshot.id)
    )
    .order("confirmed_at", { ascending: true });

  if (confirmationError) {
    return createErrorResult("confirmations_read_failed");
  }

  const confirmations = (confirmationData ?? []) as unknown as SettlementConfirmationRow[];
  const confirmationsBySnapshotId = groupConfirmationsBySnapshotId(confirmations);

  return {
    status: "ok",
    items: snapshots.map((snapshot) =>
      createHistoryItem({
        snapshot,
        confirmations: confirmationsBySnapshotId.get(snapshot.id) ?? [],
        currentUserId: userId,
        memberCount
      })
    ),
    memberCount
  };
}

async function getAuthenticatedUserId(supabase: SupabaseClient) {
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user.id;
}

function createHistoryItem({
  snapshot,
  confirmations,
  currentUserId,
  memberCount
}: {
  snapshot: SettlementSnapshotRow;
  confirmations: SettlementConfirmationRow[];
  currentUserId: string;
  memberCount: number;
}): SettlementHistoryItem {
  const confirmedUserIds = new Set(confirmations.map((confirmation) => confirmation.confirmed_by));
  const snapshotJson = getSnapshotJson(snapshot.snapshot);
  const confirmationCount = confirmedUserIds.size;

  return {
    snapshot,
    snapshotJson,
    monthKey: getSnapshotMonthKey(snapshot, snapshotJson),
    monthLabel: getSnapshotMonthLabel(snapshot, snapshotJson),
    confirmationCount,
    memberCount,
    currentUserConfirmed: confirmedUserIds.has(currentUserId),
    status: getHistoryStatus(confirmationCount, memberCount),
    confirmations
  };
}

function groupConfirmationsBySnapshotId(confirmations: SettlementConfirmationRow[]) {
  const groups = new Map<string, SettlementConfirmationRow[]>();

  confirmations.forEach((confirmation) => {
    const group = groups.get(confirmation.settlement_snapshot_id) ?? [];
    group.push(confirmation);
    groups.set(confirmation.settlement_snapshot_id, group);
  });

  return groups;
}

function getHistoryStatus(
  confirmationCount: number,
  memberCount: number
): SettlementHistoryStatus {
  if (confirmationCount === 0) {
    return "proposed";
  }

  if (memberCount > 0 && confirmationCount >= memberCount) {
    return "fully_confirmed";
  }

  return "partially_confirmed";
}

function getSnapshotJson(value: unknown): SettlementSnapshotJson | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const snapshot = value as Partial<SettlementSnapshotJson>;

  if (!snapshot.month || !Array.isArray(snapshot.memberBalances)) {
    return null;
  }

  return snapshot as SettlementSnapshotJson;
}

function getSnapshotMonthKey(
  snapshot: SettlementSnapshotRow,
  snapshotJson: SettlementSnapshotJson | null
) {
  if (snapshotJson?.month.key) {
    return snapshotJson.month.key;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(snapshot.month_start)
    ? snapshot.month_start.slice(0, 7)
    : snapshot.month_start;
}

function getSnapshotMonthLabel(
  snapshot: SettlementSnapshotRow,
  snapshotJson: SettlementSnapshotJson | null
) {
  if (snapshotJson?.month.label) {
    return snapshotJson.month.label;
  }

  const monthKey = getSnapshotMonthKey(snapshot, snapshotJson);
  const [year, month] = monthKey.split("-");

  return year && month ? `${Number(year)}年${Number(month)}月` : monthKey;
}

function clampHistoryLimit(limit: number) {
  if (!Number.isFinite(limit)) {
    return 24;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), 60);
}

function createErrorResult(
  errorCode: Extract<GetSettlementHistoryResult, { status: "error" }>["errorCode"]
): Extract<GetSettlementHistoryResult, { status: "error" }> {
  return {
    status: "error",
    items: [],
    memberCount: 0,
    errorCode
  };
}
