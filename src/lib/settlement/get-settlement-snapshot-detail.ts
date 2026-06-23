import type { SupabaseClient } from "@supabase/supabase-js";
import type { SettlementSnapshotJson } from "@/lib/settlement/build-settlement-snapshot-payload";
import type { SettlementConfirmationRow } from "@/lib/settlement/confirm-settlement-snapshot";
import type { SettlementSnapshotRow } from "@/lib/settlement/create-settlement-snapshot";
import type {
  SettlementSnapshotLifecycleFields,
  SettlementSnapshotLifecycleStatus
} from "@/types/settlement";

export type SettlementSnapshotDetailStatus =
  | "proposed"
  | "partially_confirmed"
  | "fully_confirmed";

export type SettlementSnapshotDetailMember = {
  userId: string;
  displayName: string;
  role: string;
  joinedAt: string | null;
  isCurrentUser: boolean;
  hasConfirmed: boolean;
  confirmedAt: string | null;
};

export type SettlementSnapshotConfirmationDetail = SettlementConfirmationRow & {
  displayName: string;
  isCurrentUser: boolean;
};

export type SettlementSnapshotDetail = {
  snapshot: SettlementSnapshotDetailRow;
  snapshotJson: SettlementSnapshotJson | null;
  monthKey: string;
  monthLabel: string;
  lifecycleStatus: SettlementSnapshotLifecycleStatus;
  replacementOfSnapshotId: string | null;
  supersededBySnapshotId: string | null;
  confirmationCount: number;
  memberCount: number;
  currentUserConfirmed: boolean;
  status: SettlementSnapshotDetailStatus;
  confirmations: SettlementSnapshotConfirmationDetail[];
  members: SettlementSnapshotDetailMember[];
};

export type GetSettlementSnapshotDetailInput = {
  householdId: string;
  snapshotId: string;
  currentUserId?: string | null;
};

export type SettlementSnapshotDetailResult =
  | {
      status: "ok";
      detail: SettlementSnapshotDetail;
      errorCode?: never;
    }
  | {
      status: "not_found";
      detail: null;
      errorCode: "not_found";
    }
  | {
      status: "unauthenticated";
      detail: null;
      errorCode: "unauthenticated";
    }
  | {
      status: "error";
      detail: null;
      errorCode: "members_read_failed" | "snapshot_read_failed" | "confirmations_read_failed";
    };

type HouseholdMemberRow = {
  user_id: string;
  role: string;
  joined_at: string | null;
};

export type SettlementSnapshotDetailRow = SettlementSnapshotRow &
  SettlementSnapshotLifecycleFields;

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
  "snapshot",
  "lifecycle_status",
  "replacement_of_snapshot_id",
  "superseded_by_snapshot_id",
  "superseded_at",
  "status_updated_at",
  "status_updated_by"
].join(", ");

const settlementConfirmationSelect = [
  "id",
  "settlement_snapshot_id",
  "confirmed_by",
  "confirmed_at"
].join(", ");

export async function getSettlementSnapshotDetail(
  supabase: SupabaseClient,
  { householdId, snapshotId, currentUserId }: GetSettlementSnapshotDetailInput
): Promise<SettlementSnapshotDetailResult> {
  const userId = currentUserId ?? (await getAuthenticatedUserId(supabase));

  if (!userId) {
    return {
      status: "unauthenticated",
      detail: null,
      errorCode: "unauthenticated"
    };
  }

  const { data: memberData, error: memberError } = await supabase
    .from("household_members")
    .select("user_id, role, joined_at")
    .eq("household_id", householdId)
    .order("joined_at", { ascending: true });

  if (memberError) {
    return createErrorResult("members_read_failed");
  }

  const members = (memberData ?? []) as unknown as HouseholdMemberRow[];
  const { data: snapshotData, error: snapshotError } = await supabase
    .from("settlement_snapshots")
    .select(settlementSnapshotSelect)
    .eq("id", snapshotId)
    .eq("household_id", householdId)
    .maybeSingle();

  if (snapshotError) {
    return createErrorResult("snapshot_read_failed");
  }

  if (!snapshotData) {
    return {
      status: "not_found",
      detail: null,
      errorCode: "not_found"
    };
  }

  const snapshot = normalizeSnapshotLifecycle(snapshotData);
  const { data: confirmationData, error: confirmationError } = await supabase
    .from("settlement_confirmations")
    .select(settlementConfirmationSelect)
    .eq("settlement_snapshot_id", snapshot.id)
    .order("confirmed_at", { ascending: true });

  if (confirmationError) {
    return createErrorResult("confirmations_read_failed");
  }

  const confirmations = (confirmationData ?? []) as unknown as SettlementConfirmationRow[];
  const snapshotJson = getSnapshotJson(snapshot.snapshot);
  const displayNameMap = createDisplayNameMap(members, snapshotJson, userId);
  const confirmedByMap = new Map(
    confirmations.map((confirmation) => [confirmation.confirmed_by, confirmation.confirmed_at])
  );
  const confirmedUserIds = new Set(confirmations.map((confirmation) => confirmation.confirmed_by));
  const confirmationCount = confirmedUserIds.size;
  const memberCount = new Set(members.map((member) => member.user_id)).size;

  return {
    status: "ok",
    detail: {
      snapshot,
      snapshotJson,
      monthKey: getSnapshotMonthKey(snapshot, snapshotJson),
      monthLabel: getSnapshotMonthLabel(snapshot, snapshotJson),
      lifecycleStatus: snapshot.lifecycle_status,
      replacementOfSnapshotId: snapshot.replacement_of_snapshot_id,
      supersededBySnapshotId: snapshot.superseded_by_snapshot_id,
      confirmationCount,
      memberCount,
      currentUserConfirmed: confirmedUserIds.has(userId),
      status: getSnapshotDetailStatus(confirmationCount, memberCount),
      confirmations: confirmations.map((confirmation) => ({
        ...confirmation,
        displayName: displayNameMap.get(confirmation.confirmed_by) ?? "小岛成员",
        isCurrentUser: confirmation.confirmed_by === userId
      })),
      members: members.map((member, index) => ({
        userId: member.user_id,
        displayName:
          displayNameMap.get(member.user_id) ?? getMemberFallbackLabel(member, index, userId),
        role: member.role,
        joinedAt: member.joined_at,
        isCurrentUser: member.user_id === userId,
        hasConfirmed: confirmedUserIds.has(member.user_id),
        confirmedAt: confirmedByMap.get(member.user_id) ?? null
      }))
    }
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

function getSnapshotDetailStatus(
  confirmationCount: number,
  memberCount: number
): SettlementSnapshotDetailStatus {
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

function normalizeSnapshotLifecycle(value: unknown): SettlementSnapshotDetailRow {
  const snapshot = value as SettlementSnapshotRow & Partial<SettlementSnapshotLifecycleFields>;

  return {
    ...snapshot,
    lifecycle_status: isSettlementSnapshotLifecycleStatus(snapshot.lifecycle_status)
      ? snapshot.lifecycle_status
      : "active",
    replacement_of_snapshot_id: snapshot.replacement_of_snapshot_id ?? null,
    superseded_by_snapshot_id: snapshot.superseded_by_snapshot_id ?? null,
    superseded_at: snapshot.superseded_at ?? null,
    status_updated_at: snapshot.status_updated_at ?? null,
    status_updated_by: snapshot.status_updated_by ?? null
  };
}

function isSettlementSnapshotLifecycleStatus(
  value: unknown
): value is SettlementSnapshotLifecycleStatus {
  return value === "active" || value === "pending_replacement" || value === "superseded";
}

function createDisplayNameMap(
  members: HouseholdMemberRow[],
  snapshotJson: SettlementSnapshotJson | null,
  currentUserId: string
) {
  const map = new Map<string, string>();

  snapshotJson?.memberBalances.forEach((balance) => {
    if (balance.displayName.trim()) {
      map.set(balance.userId, balance.displayName);
    }
  });

  members.forEach((member, index) => {
    if (!map.has(member.user_id)) {
      map.set(member.user_id, getMemberFallbackLabel(member, index, currentUserId));
    }
  });

  return map;
}

function getMemberFallbackLabel(member: HouseholdMemberRow, index: number, currentUserId: string) {
  if (member.user_id === currentUserId) {
    return "你";
  }

  const role =
    member.role === "owner" ? "岛主" : member.role === "partner" ? "伙伴" : "小岛成员";

  return `${role} · 小岛成员 ${index + 1}`;
}

function getSnapshotMonthKey(
  snapshot: SettlementSnapshotDetailRow,
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
  snapshot: SettlementSnapshotDetailRow,
  snapshotJson: SettlementSnapshotJson | null
) {
  if (snapshotJson?.month.label) {
    return snapshotJson.month.label;
  }

  const monthKey = getSnapshotMonthKey(snapshot, snapshotJson);
  const [year, month] = monthKey.split("-");

  return year && month ? `${Number(year)}年${Number(month)}月` : monthKey;
}

function createErrorResult(
  errorCode: Extract<SettlementSnapshotDetailResult, { status: "error" }>["errorCode"]
): Extract<SettlementSnapshotDetailResult, { status: "error" }> {
  return {
    status: "error",
    detail: null,
    errorCode
  };
}
