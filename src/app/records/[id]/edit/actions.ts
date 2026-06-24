"use server";

import { redirect } from "next/navigation";
import { normalizeRecordsMonth, type LedgerRecordTypeFilter } from "@/lib/ledger/list-records";
import {
  updateLedgerRecord,
  type UpdateLedgerRecordResult
} from "@/lib/ledger/update-ledger-record";
import { createClient } from "@/lib/supabase/server";

type EditReturnContextParams = {
  month: string | null;
  type: "expense" | "income" | null;
  category: string | null;
  member: string | null;
  q: string | null;
};

export async function updateLedgerRecordAction(formData: FormData) {
  const recordId = getFormString(formData, "record_id");
  const returnParams = getReturnContextFromFormData(formData);
  const supabase = await createClient();
  const result = await updateLedgerRecord(supabase, {
    recordId,
    formData
  });

  if (result.status === "unauthenticated") {
    redirect("/login");
  }

  if (result.status === "updated") {
    redirect(getRecordUpdatedHref(recordId, returnParams, result));
  }

  redirect(getRecordEditFeedbackHref(recordId, returnParams, result));
}

function getRecordUpdatedHref(
  recordId: string,
  returnParams: EditReturnContextParams,
  result: Extract<UpdateLedgerRecordResult, { status: "updated" }>
) {
  const query = getReturnContextQuery({
    ...returnParams,
    month: result.targetMonth ?? returnParams.month
  });

  query.set("updated", "1");

  return `/records/${recordId}?${query.toString()}`;
}

function getRecordEditFeedbackHref(
  recordId: string,
  returnParams: EditReturnContextParams,
  result: Exclude<UpdateLedgerRecordResult, { status: "updated" | "unauthenticated" }>
) {
  const query = getReturnContextQuery(returnParams);

  query.set("error", getUpdateErrorCode(result));

  return `/records/${recordId}/edit?${query.toString()}`;
}

function getUpdateErrorCode(
  result: Exclude<UpdateLedgerRecordResult, { status: "updated" | "unauthenticated" }>
) {
  if (result.status === "invalid_input") {
    return result.errorCode;
  }

  return result.status;
}

function getReturnContextFromFormData(formData: FormData): EditReturnContextParams {
  return {
    month: normalizeRecordsMonth(getFormString(formData, "return_month")),
    type: normalizeReturnType(getFormString(formData, "return_type")),
    category: normalizeReturnText(getFormString(formData, "return_category"), 120),
    member: normalizeReturnText(getFormString(formData, "return_member"), 120),
    q: normalizeReturnText(getFormString(formData, "return_q"), 80)
  };
}

function getReturnContextQuery(returnParams: EditReturnContextParams) {
  const query = new URLSearchParams();

  if (returnParams.month) {
    query.set("month", returnParams.month);
  }

  if (returnParams.type) {
    query.set("type", returnParams.type);
  }

  if (returnParams.category) {
    query.set("category", returnParams.category);
  }

  if (returnParams.member) {
    query.set("member", returnParams.member);
  }

  if (returnParams.q) {
    query.set("q", returnParams.q);
  }

  return query;
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function normalizeReturnType(value: string | null): Exclude<LedgerRecordTypeFilter, "all"> | null {
  return value === "expense" || value === "income" ? value : null;
}

function normalizeReturnText(value: string | null, maxLength: number) {
  const trimmed = value?.trim();

  return trimmed ? trimmed.slice(0, maxLength) : null;
}
