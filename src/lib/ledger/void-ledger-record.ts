import type { SupabaseClient } from "@supabase/supabase-js";
import { getSettlementSnapshotStatus } from "@/lib/settlement/get-settlement-snapshot-status";

export type VoidLedgerRecordResult =
  | {
      status: "voided";
      month: string;
      hadSettlementSnapshot: boolean;
    }
  | {
      status: "already_voided";
      month: string;
      hadSettlementSnapshot: boolean;
    }
  | {
      status: "blocked_pending_replacement";
      month: string;
      hadSettlementSnapshot: boolean;
    }
  | {
      status: "not_found" | "unauthenticated" | "error";
      month: string | null;
      hadSettlementSnapshot: false;
    };

type VoidLedgerRecordInput = {
  recordId: string;
  voidReason?: string | null;
};

type LedgerEntryVoidRow = {
  id: string;
  household_id: string;
  occurred_on: string;
  voided_at: string | null;
};

type HouseholdMembershipRow = {
  household_id: string;
};

export async function voidLedgerRecord(
  supabase: SupabaseClient,
  { recordId, voidReason }: VoidLedgerRecordInput
): Promise<VoidLedgerRecordResult> {
  if (!isUuid(recordId)) {
    return createSimpleResult("not_found");
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) {
    return createSimpleResult("error");
  }

  if (!user) {
    return createSimpleResult("unauthenticated");
  }

  const { data: entryData, error: entryError } = await supabase
    .from("ledger_entries")
    .select("id, household_id, occurred_on, voided_at")
    .eq("id", recordId)
    .maybeSingle();

  if (entryError) {
    return createSimpleResult("error");
  }

  if (!entryData) {
    return createSimpleResult("not_found");
  }

  const entry = entryData as LedgerEntryVoidRow;
  const month = getMonthKeyFromDateOnly(entry.occurred_on);

  if (!month) {
    return createSimpleResult("error");
  }

  const { data: membershipData, error: membershipError } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("household_id", entry.household_id)
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return createSimpleResult("error", month);
  }

  if (!(membershipData as HouseholdMembershipRow | null)) {
    return createSimpleResult("not_found", month);
  }

  const settlementStatus = await getSettlementSnapshotStatus(supabase, {
    householdId: entry.household_id,
    month
  });

  if (settlementStatus.status === "error") {
    return createSimpleResult("error", month);
  }

  const hadSettlementSnapshot = Boolean(settlementStatus.snapshot);

  if (entry.voided_at) {
    return {
      status: "already_voided",
      month,
      hadSettlementSnapshot
    };
  }

  if (settlementStatus.pendingReplacement) {
    return {
      status: "blocked_pending_replacement",
      month,
      hadSettlementSnapshot
    };
  }

  const now = new Date().toISOString();
  const { data: updatedData, error: updateError } = await supabase
    .from("ledger_entries")
    .update({
      updated_at: now,
      updated_by: user.id,
      voided_at: now,
      voided_by: user.id,
      void_reason: normalizeVoidReason(voidReason)
    })
    .eq("id", entry.id)
    .is("voided_at", null)
    .select("id")
    .maybeSingle();

  if (updateError) {
    return createSimpleResult("error", month);
  }

  if (!updatedData) {
    return {
      status: "already_voided",
      month,
      hadSettlementSnapshot
    };
  }

  return {
    status: "voided",
    month,
    hadSettlementSnapshot
  };
}

function createSimpleResult(
  status: Extract<VoidLedgerRecordResult["status"], "not_found" | "unauthenticated" | "error">,
  month: string | null = null
): VoidLedgerRecordResult {
  return {
    status,
    month,
    hadSettlementSnapshot: false
  };
}

function normalizeVoidReason(value: string | null | undefined) {
  const reason = value?.trim();

  return reason ? reason.slice(0, 180) : null;
}

function getMonthKeyFromDateOnly(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(0, 7) : null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}
