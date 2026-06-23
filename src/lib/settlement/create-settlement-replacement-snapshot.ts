import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildSettlementReplacementSnapshotPayload,
  type BuildSettlementReplacementSnapshotPayloadErrorCode
} from "@/lib/settlement/build-settlement-replacement-snapshot-payload";
import {
  createSettlementSnapshotSourceFingerprint,
  type SettlementSnapshotJson
} from "@/lib/settlement/build-settlement-snapshot-payload";
import {
  getSettlementSnapshotStatus,
  type SettlementSnapshotLifecycleRow
} from "@/lib/settlement/get-settlement-snapshot-status";
import { getSettlementSummary } from "@/lib/settlement/get-settlement-summary";

export type CreateSettlementReplacementSnapshotInput = {
  householdId: string;
  month?: string | null;
  now?: Date;
};

export type CreateSettlementReplacementSnapshotResult =
  | {
      status: "created";
      snapshot: SettlementSnapshotLifecycleRow;
    }
  | {
      status: "already_exists";
      snapshot: SettlementSnapshotLifecycleRow;
    }
  | {
      status: "not_outdated";
      snapshot: SettlementSnapshotLifecycleRow;
    }
  | {
      status: "no_active_snapshot";
      snapshot: null;
      errorCode: "no_active_snapshot";
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
        | BuildSettlementReplacementSnapshotPayloadErrorCode
        | "active_snapshot_fingerprint_unavailable"
        | "existing_replacement_read_failed"
        | "insert_failed"
        | "snapshot_status_unavailable";
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

export async function createSettlementReplacementSnapshot(
  supabase: SupabaseClient,
  { householdId, month, now = new Date() }: CreateSettlementReplacementSnapshotInput
): Promise<CreateSettlementReplacementSnapshotResult> {
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

  const snapshotStatus = await getSettlementSnapshotStatus(supabase, {
    householdId,
    month,
    now
  });

  if (snapshotStatus.status === "error") {
    return {
      status: "error",
      snapshot: null,
      errorCode: "snapshot_status_unavailable"
    };
  }

  if (!snapshotStatus.snapshot) {
    return {
      status: "no_active_snapshot",
      snapshot: null,
      errorCode: "no_active_snapshot"
    };
  }

  if (snapshotStatus.pendingReplacement) {
    return {
      status: "already_exists",
      snapshot: snapshotStatus.pendingReplacement.snapshot
    };
  }

  const summaryResult = await getSettlementSummary(supabase, {
    householdId,
    currentUserId: user.id,
    month: snapshotStatus.month.month,
    now
  });
  const built = buildSettlementReplacementSnapshotPayload({
    householdId,
    createdBy: user.id,
    createdAt: now,
    replacementOfSnapshotId: snapshotStatus.snapshot.id,
    summaryResult
  });

  if (!built.ok) {
    return {
      status: "error",
      snapshot: null,
      errorCode: built.errorCode
    };
  }

  const outdated = getActiveSnapshotOutdatedState({
    activeSnapshot: snapshotStatus.snapshot,
    liveSourceFingerprint: built.payload.source_fingerprint
  });

  if (outdated === null) {
    return {
      status: "error",
      snapshot: null,
      errorCode: "active_snapshot_fingerprint_unavailable"
    };
  }

  if (!outdated) {
    return {
      status: "not_outdated",
      snapshot: snapshotStatus.snapshot
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
      snapshot: data as unknown as SettlementSnapshotLifecycleRow
    };
  }

  if (isUniqueViolation(error)) {
    const existing = await getExistingPendingReplacement(supabase, {
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
      errorCode: "existing_replacement_read_failed"
    };
  }

  return {
    status: "error",
    snapshot: null,
    errorCode: "insert_failed"
  };
}

async function getExistingPendingReplacement(
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
    .eq("lifecycle_status", "pending_replacement")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as unknown as SettlementSnapshotLifecycleRow;
}

function getActiveSnapshotOutdatedState({
  activeSnapshot,
  liveSourceFingerprint
}: {
  activeSnapshot: SettlementSnapshotLifecycleRow;
  liveSourceFingerprint: string;
}) {
  if (liveSourceFingerprint === activeSnapshot.source_fingerprint) {
    return false;
  }

  const snapshotJson = getSnapshotJson(activeSnapshot.snapshot);

  if (!snapshotJson) {
    return null;
  }

  return liveSourceFingerprint !== createSettlementSnapshotSourceFingerprint(snapshotJson);
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

function isUniqueViolation(error: { code?: string } | null) {
  return error?.code === "23505";
}
