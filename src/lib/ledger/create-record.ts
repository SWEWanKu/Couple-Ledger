import type { SupabaseClient } from "@supabase/supabase-js";

export type RecordEntryType = "expense" | "income";

export type RecordSplitMode = "equal" | "personal";

export type RecordCategoryOption = {
  id: string;
};

export type RecordMemberOption = {
  userId: string;
};

export type CreateRecordContext = {
  householdId: string;
  currentUserId: string;
  categories: RecordCategoryOption[];
  members: RecordMemberOption[];
};

export type CreateRecordErrorCode =
  | "invalid_entry_type"
  | "invalid_amount"
  | "invalid_category"
  | "invalid_handler"
  | "invalid_split_mode"
  | "invalid_date"
  | "missing_members"
  | "entry_insert_failed"
  | "split_insert_failed";

export type CreateRecordResult =
  | {
      ok: true;
      entryId: string;
    }
  | {
      ok: false;
      errorCode: CreateRecordErrorCode;
    };

export type RecordSplitInsert = {
  entry_id: string;
  user_id: string;
  share_amount: string;
};

type NormalizedRecordInput = {
  entryType: RecordEntryType;
  amountCents: number;
  amount: string;
  categoryId: string;
  paidBy: string;
  splitMode: RecordSplitMode;
  occurredOn: string;
  note: string | null;
};

type LedgerEntryInsertResult = {
  id: string;
};

const maxAmountCents = 999999999999;

const createRecordErrorMessages: Record<CreateRecordErrorCode, string> = {
  invalid_entry_type: "请选择这笔账单是支出还是收入。",
  invalid_amount: "金额要大于 0，最多保留两位小数。",
  invalid_category: "请选择这座小岛里的一个分类。",
  invalid_handler: "请选择这座小岛里的经手人。",
  invalid_split_mode: "请选择有效的分摊方式。",
  invalid_date: "请选择有效的记账日期。",
  missing_members: "还没有读取到小岛成员，暂时不能记账。",
  entry_insert_failed: "保存账单时小岛信号断了一下，请稍后再试。",
  split_insert_failed: "账单分摊没有保存成功，已尝试撤回这笔记录，请稍后再试。"
};

export function getCreateRecordErrorMessage(code: string | null | undefined) {
  if (!code || !(code in createRecordErrorMessages)) {
    return null;
  }

  return createRecordErrorMessages[code as CreateRecordErrorCode];
}

export async function createRecord(
  supabase: SupabaseClient,
  context: CreateRecordContext,
  formData: FormData
): Promise<CreateRecordResult> {
  const normalized = normalizeRecordFormData(formData, context);

  if (normalized.ok === false) {
    return normalized;
  }

  const record = normalized.record;
  const { data: entry, error: entryError } = await supabase
    .from("ledger_entries")
    .insert({
      household_id: context.householdId,
      amount: record.amount,
      entry_type: record.entryType,
      category_id: record.categoryId,
      paid_by: record.paidBy,
      split_mode: record.splitMode,
      occurred_on: record.occurredOn,
      note: record.note,
      created_by: context.currentUserId
    })
    .select("id")
    .single();

  if (entryError || !entry) {
    return { ok: false, errorCode: "entry_insert_failed" };
  }

  const entryId = (entry as LedgerEntryInsertResult).id;
  const splits = buildRecordSplitRows({
    entryId,
    amountCents: record.amountCents,
    members: context.members,
    paidBy: record.paidBy,
    splitMode: record.splitMode
  });

  const { error: splitError } = await supabase.from("ledger_entry_splits").insert(splits);

  if (splitError) {
    await supabase
      .from("ledger_entries")
      .delete()
      .eq("id", entryId)
      .eq("household_id", context.householdId);

    return { ok: false, errorCode: "split_insert_failed" };
  }

  return { ok: true, entryId };
}

export function buildRecordSplitRows({
  entryId,
  amountCents,
  members,
  paidBy,
  splitMode
}: {
  entryId: string;
  amountCents: number;
  members: RecordMemberOption[];
  paidBy: string;
  splitMode: RecordSplitMode;
}): RecordSplitInsert[] {
  if (splitMode === "personal") {
    return [
      {
        entry_id: entryId,
        user_id: paidBy,
        share_amount: formatCents(amountCents)
      }
    ];
  }

  const baseShareCents = Math.floor(amountCents / members.length);
  let assignedCents = 0;

  return members.map((member, index) => {
    const shareCents =
      index === members.length - 1 ? amountCents - assignedCents : baseShareCents;
    assignedCents += shareCents;

    return {
      entry_id: entryId,
      user_id: member.userId,
      share_amount: formatCents(shareCents)
    };
  });
}

export function normalizeRecordFormData(
  formData: FormData,
  context: CreateRecordContext
):
  | {
      ok: true;
      record: NormalizedRecordInput;
    }
  | {
      ok: false;
      errorCode: CreateRecordErrorCode;
    } {
  const entryType = getFormString(formData, "entry_type");
  const amountCents = parseAmountCents(getFormString(formData, "amount"));
  const categoryId = getFormString(formData, "category_id");
  const paidBy = getFormString(formData, "paid_by");
  const splitMode = getFormString(formData, "split_mode");
  const occurredOn = getFormString(formData, "occurred_on");
  const note = getFormString(formData, "note").trim();

  if (entryType !== "expense" && entryType !== "income") {
    return { ok: false, errorCode: "invalid_entry_type" };
  }

  if (amountCents === null) {
    return { ok: false, errorCode: "invalid_amount" };
  }

  if (!context.categories.some((category) => category.id === categoryId)) {
    return { ok: false, errorCode: "invalid_category" };
  }

  if (!context.members.length) {
    return { ok: false, errorCode: "missing_members" };
  }

  if (!context.members.some((member) => member.userId === paidBy)) {
    return { ok: false, errorCode: "invalid_handler" };
  }

  if (splitMode !== "equal" && splitMode !== "personal") {
    return { ok: false, errorCode: "invalid_split_mode" };
  }

  if (!isValidDateOnly(occurredOn)) {
    return { ok: false, errorCode: "invalid_date" };
  }

  return {
    ok: true,
    record: {
      entryType,
      amountCents,
      amount: formatCents(amountCents),
      categoryId,
      paidBy,
      splitMode,
      occurredOn,
      note: note || null
    }
  };
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function parseAmountCents(value: string) {
  const normalized = value.trim().replace(/,/g, "");

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const [yuanPart, centPart = ""] = normalized.split(".");
  const yuan = Number(yuanPart);
  const cents = Number(centPart.padEnd(2, "0"));
  const amountCents = yuan * 100 + cents;

  if (
    !Number.isSafeInteger(amountCents) ||
    amountCents <= 0 ||
    amountCents > maxAmountCents
  ) {
    return null;
  }

  return amountCents;
}

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

function isValidDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
