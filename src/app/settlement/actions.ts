"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { confirmSettlementSnapshot } from "@/lib/settlement/confirm-settlement-snapshot";
import { createSettlementSnapshot } from "@/lib/settlement/create-settlement-snapshot";
import { getSettlementSnapshotStatus } from "@/lib/settlement/get-settlement-snapshot-status";
import { normalizeSettlementMonth } from "@/lib/settlement/get-settlement-summary";
import { createClient } from "@/lib/supabase/server";

type HouseholdMembershipRow = {
  household_id: string;
  role: string;
};

type SettlementActionName = "propose" | "confirm";

export async function proposeSettlementSnapshotAction(formData: FormData) {
  const month = getFormString(formData, "month");
  const { supabase, membership } = await requireSettlementActionContext();
  const result = await createSettlementSnapshot(supabase, {
    householdId: membership.household_id,
    month: normalizeSettlementMonth(month),
    now: new Date()
  });

  revalidatePath("/settlement");
  redirect(
    getSettlementRedirectHref({
      action: "propose",
      month: getRedirectMonth(month, result.snapshot?.month_start),
      result: result.status,
      error: result.status === "error" ? result.errorCode : null
    })
  );
}

export async function confirmSettlementSnapshotAction(formData: FormData) {
  const month = getFormString(formData, "month");
  const snapshotId = getFormString(formData, "snapshot_id");
  const { supabase, membership } = await requireSettlementActionContext();
  const normalizedMonth = normalizeSettlementMonth(month);

  if (!snapshotId) {
    revalidatePath("/settlement");
    redirect(
      getSettlementRedirectHref({
        action: "confirm",
        month: normalizedMonth,
        result: "snapshot_missing"
      })
    );
  }

  const snapshotStatus = await getSettlementSnapshotStatus(supabase, {
    householdId: membership.household_id,
    month: normalizedMonth,
    now: new Date()
  });

  if (snapshotStatus.status === "error") {
    revalidatePath("/settlement");
    redirect(
      getSettlementRedirectHref({
        action: "confirm",
        month: normalizedMonth,
        result: "snapshot_status_unavailable",
        error: snapshotStatus.errorCode
      })
    );
  }

  if (!snapshotStatus.snapshot || snapshotStatus.snapshot.id !== snapshotId) {
    revalidatePath("/settlement");
    redirect(
      getSettlementRedirectHref({
        action: "confirm",
        month: normalizedMonth ?? snapshotStatus.month.month,
        result: "snapshot_not_found"
      })
    );
  }

  const result = await confirmSettlementSnapshot(supabase, {
    settlementSnapshotId: snapshotId
  });

  revalidatePath("/settlement");
  redirect(
    getSettlementRedirectHref({
      action: "confirm",
      month: normalizedMonth ?? snapshotStatus.month.month,
      result: result.status,
      error: result.status === "error" ? result.errorCode : null
    })
  );
}

async function requireSettlementActionContext() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership, error } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (error || !membership) {
    redirect("/not-invited");
  }

  return {
    supabase,
    user,
    membership: membership as HouseholdMembershipRow
  };
}

function getSettlementRedirectHref({
  action,
  month,
  result,
  error
}: {
  action: SettlementActionName;
  month?: string | null;
  result: string;
  error?: string | null;
}) {
  const params = new URLSearchParams({
    settlement_action: action,
    settlement_result: result
  });

  const normalizedMonth = normalizeSettlementMonth(month);

  if (normalizedMonth) {
    params.set("month", normalizedMonth);
  }

  if (error) {
    params.set("settlement_error", error);
  }

  return `/settlement?${params.toString()}`;
}

function getRedirectMonth(month: string | null, monthStart: string | null | undefined) {
  return normalizeSettlementMonth(month) ?? getMonthFromDateOnly(monthStart);
}

function getMonthFromDateOnly(date: string | null | undefined) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }

  return date.slice(0, 7);
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() || null : null;
}
