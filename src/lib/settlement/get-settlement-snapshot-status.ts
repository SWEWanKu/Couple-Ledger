import type { SupabaseClient } from "@supabase/supabase-js";
import type { SettlementConfirmationRow } from "@/lib/settlement/confirm-settlement-snapshot";
import type { SettlementSnapshotRow } from "@/lib/settlement/create-settlement-snapshot";
import { getSettlementMonthRange } from "@/lib/settlement/get-settlement-summary";
import type {
  SettlementMonthMetadata,
  SettlementSnapshotLifecycleFields,
  SettlementSnapshotLifecycleStatus
} from "@/types/settlement";

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
  pendingReplacement: SettlementSnapshotLifecycleSummary | null;
};

export type SettlementSnapshotLifecycleRow = SettlementSnapshotRow &
  SettlementSnapshotLifecycleFields;

export type SettlementSnapshotLifecycleSummary = {
  status: Exclude<SettlementSnapshotStatus, "no_snapshot">;
  snapshot: SettlementSnapshotLifecycleRow;
  confirmations: SettlementConfirmationRow[];
  confirmedCount: number;
  requiredConfirmationCount: number;
};

export type GetSettlementSnapshotStatusResult =
  | (SettlementSnapshotStatusBase & {
      status: "no_snapshot";
      snapshot: null;
      errorCode?: never;
    })
  | (SettlementSnapshotStatusBase & {
      status: Exclude<SettlementSnapshotStatus, "no_snapshot">;
      snapshot: SettlementSnapshotLifecycleRow;
      errorCode?: never;
    })
  | {
      status: "error";
      month: SettlementMonthMetadata;
      snapshot: null;
      confirmations: [];
      pendingReplacement: null;
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

export async function getSettlementSnapshotStatus(
  supabase: SupabaseClient,
  { householdId, month, now = new Date() }: GetSettlementSnapshotStatusInput
): Promise<GetSettlementSnapshotStatusResult> {
  const monthMetadata = getSettlementMonthRange(month, now);
  const [memberResult, activeSnapshotResult, pendingReplacementResult] = await Promise.all([
    supabase
      .from("household_members")
      .select("user_id")
      .eq("household_id", householdId),
    readSnapshotByLifecycle(supabase, {
      householdId,
      monthStart: monthMetadata.monthStart,
      lifecycleStatus: "active"
    }),
    readSnapshotByLifecycle(supabase, {
      householdId,
      monthStart: monthMetadata.monthStart,
      lifecycleStatus: "pending_replacement"
    })
  ]);

  if (memberResult.error) {
    return createErrorResult(monthMetadata, "members_read_failed");
  }

  const requiredConfirmationCount = new Set(
    ((memberResult.data ?? []) as unknown as HouseholdMemberRow[]).map((member) => member.user_id)
  ).size;

  if (activeSnapshotResult.error) {
    return createErrorResult(monthMetadata, "snapshot_read_failed");
  }

  if (pendingReplacementResult.error) {
    return createErrorResult(monthMetadata, "snapshot_read_failed");
  }

  const snapshots = [activeSnapshotResult.snapshot, pendingReplacementResult.snapshot].filter(
    Boolean
  ) as SettlementSnapshotLifecycleRow[];
  const confirmationsResult = await readConfirmationsForSnapshots(supabase, snapshots);

  if (confirmationsResult.error) {
    return createErrorResult(monthMetadata, "confirmations_read_failed");
  }

  const confirmationsBySnapshotId = groupConfirmationsBySnapshotId(confirmationsResult.confirmations);
  const pendingReplacement = pendingReplacementResult.snapshot
    ? createSnapshotLifecycleSummary({
        snapshot: pendingReplacementResult.snapshot,
        confirmations: confirmationsBySnapshotId.get(pendingReplacementResult.snapshot.id) ?? [],
        requiredConfirmationCount
      })
    : null;

  if (!activeSnapshotResult.snapshot) {
    return {
      status: "no_snapshot",
      month: monthMetadata,
      snapshot: null,
      confirmations: [],
      pendingReplacement,
      requiredConfirmationCount
    };
  }

  const activeSnapshot = activeSnapshotResult.snapshot;
  const activeConfirmations = confirmationsBySnapshotId.get(activeSnapshot.id) ?? [];
  const activeSummary = createSnapshotLifecycleSummary({
    snapshot: activeSnapshot,
    confirmations: activeConfirmations,
    requiredConfirmationCount
  });

  return {
    status: activeSummary.status,
    month: monthMetadata,
    snapshot: activeSnapshot,
    confirmations: activeConfirmations,
    pendingReplacement,
    requiredConfirmationCount
  };
}

async function readSnapshotByLifecycle(
  supabase: SupabaseClient,
  {
    householdId,
    monthStart,
    lifecycleStatus
  }: {
    householdId: string;
    monthStart: string;
    lifecycleStatus: SettlementSnapshotLifecycleStatus;
  }
): Promise<
  | {
      snapshot: SettlementSnapshotLifecycleRow | null;
      error: null;
    }
  | {
      snapshot: null;
      error: unknown;
    }
> {
  const { data, error } = await supabase
    .from("settlement_snapshots")
    .select(settlementSnapshotSelect)
    .eq("household_id", householdId)
    .eq("month_start", monthStart)
    .eq("lifecycle_status", lifecycleStatus)
    .maybeSingle();

  if (error) {
    return { snapshot: null, error };
  }

  return {
    snapshot: data ? normalizeSnapshotLifecycle(data, lifecycleStatus) : null,
    error: null
  };
}

async function readConfirmationsForSnapshots(
  supabase: SupabaseClient,
  snapshots: SettlementSnapshotLifecycleRow[]
): Promise<
  | {
      confirmations: SettlementConfirmationRow[];
      error: null;
    }
  | {
      confirmations: [];
      error: unknown;
    }
> {
  if (snapshots.length === 0) {
    return {
      confirmations: [],
      error: null
    };
  }

  const { data, error } = await supabase
    .from("settlement_confirmations")
    .select(settlementConfirmationSelect)
    .in(
      "settlement_snapshot_id",
      snapshots.map((snapshot) => snapshot.id)
    )
    .order("confirmed_at", { ascending: true });

  if (error) {
    return {
      confirmations: [],
      error
    };
  }

  return {
    confirmations: (data ?? []) as unknown as SettlementConfirmationRow[],
    error: null
  };
}

function createSnapshotLifecycleSummary({
  snapshot,
  confirmations,
  requiredConfirmationCount
}: {
  snapshot: SettlementSnapshotLifecycleRow;
  confirmations: SettlementConfirmationRow[];
  requiredConfirmationCount: number;
}): SettlementSnapshotLifecycleSummary {
  const confirmedCount = new Set(confirmations.map((confirmation) => confirmation.confirmed_by)).size;

  return {
    status: getSnapshotStatus(confirmedCount, requiredConfirmationCount),
    snapshot,
    confirmations,
    confirmedCount,
    requiredConfirmationCount
  };
}

function normalizeSnapshotLifecycle(
  value: unknown,
  fallbackStatus: SettlementSnapshotLifecycleStatus
): SettlementSnapshotLifecycleRow {
  const snapshot = value as SettlementSnapshotRow & Partial<SettlementSnapshotLifecycleFields>;

  return {
    ...snapshot,
    lifecycle_status: isSettlementSnapshotLifecycleStatus(snapshot.lifecycle_status)
      ? snapshot.lifecycle_status
      : fallbackStatus,
    replacement_of_snapshot_id: snapshot.replacement_of_snapshot_id ?? null,
    superseded_by_snapshot_id: snapshot.superseded_by_snapshot_id ?? null,
    superseded_at: snapshot.superseded_at ?? null,
    status_updated_at: snapshot.status_updated_at ?? null,
    status_updated_by: snapshot.status_updated_by ?? null
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

function isSettlementSnapshotLifecycleStatus(
  value: unknown
): value is SettlementSnapshotLifecycleStatus {
  return value === "active" || value === "pending_replacement" || value === "superseded";
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
    pendingReplacement: null,
    requiredConfirmationCount: 0,
    errorCode
  };
}
