import type { SupabaseClient } from "@supabase/supabase-js";

export type ExpenseSplitMode = "equal" | "personal";

export type ExpenseCategoryOption = {
  id: string;
};

export type ExpenseMemberOption = {
  userId: string;
};

export type CreateExpenseContext = {
  householdId: string;
  currentUserId: string;
  categories: ExpenseCategoryOption[];
  members: ExpenseMemberOption[];
};

export type CreateExpenseErrorCode =
  | "invalid_amount"
  | "invalid_category"
  | "invalid_payer"
  | "invalid_split_mode"
  | "invalid_date"
  | "missing_members"
  | "entry_insert_failed"
  | "split_insert_failed";

export type CreateExpenseResult =
  | {
      ok: true;
      entryId: string;
    }
  | {
      ok: false;
      errorCode: CreateExpenseErrorCode;
    };

export type ExpenseSplitInsert = {
  entry_id: string;
  user_id: string;
  share_amount: string;
};

type NormalizedExpenseInput = {
  amountCents: number;
  amount: string;
  categoryId: string;
  paidBy: string;
  splitMode: ExpenseSplitMode;
  occurredOn: string;
  note: string | null;
};

type LedgerEntryInsertResult = {
  id: string;
};

const maxAmountCents = 999999999999;

const createExpenseErrorMessages: Record<CreateExpenseErrorCode, string> = {
  invalid_amount: "金额要大于 0，最多保留两位小数。",
  invalid_category: "请选择这座小岛里的一个分类。",
  invalid_payer: "请选择这座小岛里的付款人。",
  invalid_split_mode: "请选择有效的分摊方式。",
  invalid_date: "请选择有效的记账日期。",
  missing_members: "还没有读取到小岛成员，暂时不能记账。",
  entry_insert_failed: "保存账单时小岛信号断了一下，请稍后再试。",
  split_insert_failed: "账单分摊没有保存成功，已尝试撤回这笔记录，请稍后再试。"
};

export function getCreateExpenseErrorMessage(code: string | null | undefined) {
  if (!code || !(code in createExpenseErrorMessages)) {
    return null;
  }

  return createExpenseErrorMessages[code as CreateExpenseErrorCode];
}

export async function createExpenseRecord(
  supabase: SupabaseClient,
  context: CreateExpenseContext,
  formData: FormData
): Promise<CreateExpenseResult> {
  const normalized = normalizeExpenseFormData(formData, context);

  if (normalized.ok === false) {
    return normalized;
  }

  const expense = normalized.expense;
  const { data: entry, error: entryError } = await supabase
    .from("ledger_entries")
    .insert({
      household_id: context.householdId,
      amount: expense.amount,
      entry_type: "expense",
      category_id: expense.categoryId,
      paid_by: expense.paidBy,
      split_mode: expense.splitMode,
      occurred_on: expense.occurredOn,
      note: expense.note,
      created_by: context.currentUserId
    })
    .select("id")
    .single();

  if (entryError || !entry) {
    return { ok: false, errorCode: "entry_insert_failed" };
  }

  const entryId = (entry as LedgerEntryInsertResult).id;
  const splits = buildExpenseSplitRows({
    entryId,
    amountCents: expense.amountCents,
    members: context.members,
    paidBy: expense.paidBy,
    splitMode: expense.splitMode
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

export function buildExpenseSplitRows({
  entryId,
  amountCents,
  members,
  paidBy,
  splitMode
}: {
  entryId: string;
  amountCents: number;
  members: ExpenseMemberOption[];
  paidBy: string;
  splitMode: ExpenseSplitMode;
}): ExpenseSplitInsert[] {
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

function normalizeExpenseFormData(
  formData: FormData,
  context: CreateExpenseContext
):
  | {
      ok: true;
      expense: NormalizedExpenseInput;
    }
  | {
      ok: false;
      errorCode: CreateExpenseErrorCode;
    } {
  const amountCents = parseAmountCents(getFormString(formData, "amount"));
  const categoryId = getFormString(formData, "category_id");
  const paidBy = getFormString(formData, "paid_by");
  const splitMode = getFormString(formData, "split_mode");
  const occurredOn = getFormString(formData, "occurred_on");
  const note = getFormString(formData, "note").trim();

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
    return { ok: false, errorCode: "invalid_payer" };
  }

  if (splitMode !== "equal" && splitMode !== "personal") {
    return { ok: false, errorCode: "invalid_split_mode" };
  }

  if (!isValidDateOnly(occurredOn)) {
    return { ok: false, errorCode: "invalid_date" };
  }

  return {
    ok: true,
    expense: {
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
