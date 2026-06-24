import type { SupabaseClient } from "@supabase/supabase-js";
import { getDashboardHouseholdSummary } from "@/lib/dashboard/household-summary";
import {
  getCreateRecordErrorMessage,
  normalizeRecordFormData,
  type CreateRecordErrorCode,
  type RecordCategoryOption,
  type RecordMemberOption
} from "@/lib/ledger/create-record";

export type UpdateLedgerRecordStatus =
  | "updated"
  | "blocked_pending_replacement"
  | "already_voided"
  | "not_found"
  | "unauthenticated"
  | "not_household_member"
  | "invalid_input"
  | "error";

export type UpdateLedgerRecordResult =
  | {
      status: "updated";
      recordId: string;
      originalMonth: string | null;
      targetMonth: string | null;
      splitCount: number | null;
    }
  | {
      status: "blocked_pending_replacement";
      recordId: string | null;
      originalMonth: string | null;
      targetMonth: string | null;
    }
  | {
      status: "invalid_input";
      errorCode: CreateRecordErrorCode | "invalid_input";
    }
  | {
      status: Exclude<
        UpdateLedgerRecordStatus,
        "updated" | "blocked_pending_replacement" | "invalid_input"
      >;
    };

type UpdateLedgerRecordInput = {
  recordId: string;
  formData: FormData;
};

type LedgerEntryLookupRow = {
  id: string;
  household_id: string;
};

type HouseholdMembershipRow = {
  household_id: string;
};

type UpdateLedgerRecordRpcResult = {
  status?: unknown;
  recordId?: unknown;
  originalMonthStart?: unknown;
  targetMonthStart?: unknown;
  splitCount?: unknown;
};

const updateRecordErrorMessages: Partial<Record<UpdateLedgerRecordStatus, string>> = {
  blocked_pending_replacement:
    "这个月正在重新对齐结算便签，先处理完新的结算便签再改账。",
  already_voided: "这笔账已经作废了，不能再修改。",
  not_found: "没有找到这笔还在生效的账。",
  unauthenticated: "请先登录后再修改账本。",
  not_household_member: "只有当前小岛成员可以修改这笔账。",
  invalid_input: "请检查这张修改便签里的金额、日期、分类和经手人。",
  error: "修改账本时小岛信号断了一下，请稍后再试。"
};

export async function updateLedgerRecord(
  supabase: SupabaseClient,
  { recordId, formData }: UpdateLedgerRecordInput
): Promise<UpdateLedgerRecordResult> {
  if (!isUuid(recordId)) {
    return { status: "not_found" };
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) {
    return { status: "error" };
  }

  if (!user) {
    return { status: "unauthenticated" };
  }

  const { data: entryData, error: entryError } = await supabase
    .from("ledger_entries")
    .select("id, household_id")
    .eq("id", recordId)
    .is("voided_at", null)
    .maybeSingle();

  if (entryError) {
    return { status: "error" };
  }

  if (!entryData) {
    return { status: "not_found" };
  }

  const entry = entryData as LedgerEntryLookupRow;
  const { data: membershipData, error: membershipError } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("household_id", entry.household_id)
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return { status: "error" };
  }

  if (!(membershipData as HouseholdMembershipRow | null)) {
    return { status: "not_household_member" };
  }

  const { summary } = await getDashboardHouseholdSummary(supabase, {
    householdId: entry.household_id,
    currentUserId: user.id
  });
  const normalized = normalizeRecordFormData(formData, {
    householdId: entry.household_id,
    currentUserId: user.id,
    categories: summary.categories.map<RecordCategoryOption>((category) => ({
      id: category.id
    })),
    members: summary.members.map<RecordMemberOption>((member) => ({
      userId: member.userId
    }))
  });

  if (!normalized.ok) {
    return {
      status: "invalid_input",
      errorCode: normalized.errorCode
    };
  }

  const record = normalized.record;
  const { data, error } = await supabase.rpc("update_ledger_record_v1", {
    p_record_id: recordId,
    p_amount: record.amount,
    p_entry_type: record.entryType,
    p_category_id: record.categoryId,
    p_paid_by: record.paidBy,
    p_split_mode: record.splitMode,
    p_occurred_on: record.occurredOn,
    p_note: record.note
  });

  if (error) {
    return { status: "error" };
  }

  return normalizeRpcResult(data);
}

export function getUpdateLedgerRecordErrorMessage(code: string | null | undefined) {
  const createMessage = getCreateRecordErrorMessage(code);

  if (createMessage) {
    return createMessage;
  }

  if (!code || !(code in updateRecordErrorMessages)) {
    return null;
  }

  return updateRecordErrorMessages[code as UpdateLedgerRecordStatus] ?? null;
}

function normalizeRpcResult(value: unknown): UpdateLedgerRecordResult {
  const result = (value ?? {}) as UpdateLedgerRecordRpcResult;

  if (result.status === "updated") {
    return {
      status: "updated",
      recordId: typeof result.recordId === "string" ? result.recordId : "",
      originalMonth: getMonthFromDateOnly(result.originalMonthStart),
      targetMonth: getMonthFromDateOnly(result.targetMonthStart),
      splitCount: typeof result.splitCount === "number" ? result.splitCount : null
    };
  }

  if (result.status === "blocked_pending_replacement") {
    return {
      status: "blocked_pending_replacement",
      recordId: typeof result.recordId === "string" ? result.recordId : null,
      originalMonth: getMonthFromDateOnly(result.originalMonthStart),
      targetMonth: getMonthFromDateOnly(result.targetMonthStart)
    };
  }

  if (result.status === "invalid_input") {
    return {
      status: "invalid_input",
      errorCode: "invalid_input"
    };
  }

  if (
    result.status === "already_voided" ||
    result.status === "not_found" ||
    result.status === "unauthenticated" ||
    result.status === "not_household_member"
  ) {
    return {
      status: result.status
    };
  }

  return { status: "error" };
}

function getMonthFromDateOnly(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value.slice(0, 7)
    : null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}
