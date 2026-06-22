import type { SupabaseClient } from "@supabase/supabase-js";

export type SettlementConfirmationRow = {
  id: string;
  settlement_snapshot_id: string;
  confirmed_by: string;
  confirmed_at: string;
};

export type ConfirmSettlementSnapshotInput = {
  settlementSnapshotId: string;
};

export type ConfirmSettlementSnapshotResult =
  | {
      status: "confirmed";
      confirmation: SettlementConfirmationRow;
    }
  | {
      status: "already_confirmed";
      confirmation: SettlementConfirmationRow;
    }
  | {
      status: "unauthenticated";
      confirmation: null;
      errorCode: "unauthenticated";
    }
  | {
      status: "error";
      confirmation: null;
      errorCode: "confirmation_read_failed" | "insert_failed";
    };

const settlementConfirmationSelect = [
  "id",
  "settlement_snapshot_id",
  "confirmed_by",
  "confirmed_at"
].join(", ");

export async function confirmSettlementSnapshot(
  supabase: SupabaseClient,
  { settlementSnapshotId }: ConfirmSettlementSnapshotInput
): Promise<ConfirmSettlementSnapshotResult> {
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      status: "unauthenticated",
      confirmation: null,
      errorCode: "unauthenticated"
    };
  }

  const { data, error } = await supabase
    .from("settlement_confirmations")
    .insert({
      settlement_snapshot_id: settlementSnapshotId,
      confirmed_by: user.id
    })
    .select(settlementConfirmationSelect)
    .single();

  if (!error && data) {
    return {
      status: "confirmed",
      confirmation: data as unknown as SettlementConfirmationRow
    };
  }

  if (isUniqueViolation(error)) {
    const existing = await getExistingSettlementConfirmation(supabase, {
      settlementSnapshotId,
      confirmedBy: user.id
    });

    if (existing) {
      return {
        status: "already_confirmed",
        confirmation: existing
      };
    }

    return {
      status: "error",
      confirmation: null,
      errorCode: "confirmation_read_failed"
    };
  }

  return {
    status: "error",
    confirmation: null,
    errorCode: "insert_failed"
  };
}

async function getExistingSettlementConfirmation(
  supabase: SupabaseClient,
  {
    settlementSnapshotId,
    confirmedBy
  }: {
    settlementSnapshotId: string;
    confirmedBy: string;
  }
) {
  const { data, error } = await supabase
    .from("settlement_confirmations")
    .select(settlementConfirmationSelect)
    .eq("settlement_snapshot_id", settlementSnapshotId)
    .eq("confirmed_by", confirmedBy)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as unknown as SettlementConfirmationRow;
}

function isUniqueViolation(error: { code?: string } | null) {
  return error?.code === "23505";
}
