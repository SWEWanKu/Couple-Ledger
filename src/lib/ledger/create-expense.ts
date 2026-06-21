import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildRecordSplitRows,
  createRecord,
  getCreateRecordErrorMessage,
  type CreateRecordContext,
  type CreateRecordErrorCode,
  type CreateRecordResult,
  type RecordCategoryOption,
  type RecordMemberOption,
  type RecordSplitInsert,
  type RecordSplitMode
} from "@/lib/ledger/create-record";

export type ExpenseSplitMode = RecordSplitMode;
export type ExpenseCategoryOption = RecordCategoryOption;
export type ExpenseMemberOption = RecordMemberOption;
export type CreateExpenseContext = CreateRecordContext;
export type CreateExpenseErrorCode = CreateRecordErrorCode;
export type CreateExpenseResult = CreateRecordResult;
export type ExpenseSplitInsert = RecordSplitInsert;

export function getCreateExpenseErrorMessage(code: string | null | undefined) {
  return getCreateRecordErrorMessage(code);
}

export async function createExpenseRecord(
  supabase: SupabaseClient,
  context: CreateExpenseContext,
  formData: FormData
): Promise<CreateExpenseResult> {
  const expenseFormData = cloneFormData(formData);
  expenseFormData.set("entry_type", "expense");

  return createRecord(supabase, context, expenseFormData);
}

export const buildExpenseSplitRows = buildRecordSplitRows;

function cloneFormData(formData: FormData) {
  const clone = new FormData();
  formData.forEach((value, key) => {
    clone.set(key, value);
  });

  return clone;
}
