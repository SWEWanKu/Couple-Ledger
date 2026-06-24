"use server";

import { redirect } from "next/navigation";
import { normalizeRecordsMonth, type LedgerRecordTypeFilter } from "@/lib/ledger/list-records";
import { voidLedgerRecord, type VoidLedgerRecordResult } from "@/lib/ledger/void-ledger-record";
import { createClient } from "@/lib/supabase/server";

type VoidReturnContextParams = {
  month: string | null;
  type: "expense" | "income" | null;
  category: string | null;
  member: string | null;
  q: string | null;
};

export async function voidLedgerRecordAction(formData: FormData) {
  const recordId = getFormString(formData, "record_id");
  const returnParams = getReturnContextFromFormData(formData);
  const supabase = await createClient();
  const result = await voidLedgerRecord(supabase, {
    recordId,
    voidReason: getFormString(formData, "void_reason")
  });

  if (result.status === "unauthenticated") {
    redirect("/login");
  }

  redirect(getRecordsFeedbackHref(returnParams, result));
}

function getRecordsFeedbackHref(
  returnParams: VoidReturnContextParams,
  result: Exclude<VoidLedgerRecordResult, { status: "unauthenticated" }>
) {
  const query = new URLSearchParams();
  const month = returnParams.month ?? result.month;

  if (month) {
    query.set("month", month);
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

  query.set("voided", getVoidFeedbackCode(result.status));

  return `/records?${query.toString()}`;
}

function getVoidFeedbackCode(status: VoidLedgerRecordResult["status"]) {
  if (status === "voided") {
    return "1";
  }

  if (status === "already_voided" || status === "blocked_pending_replacement") {
    return status;
  }

  return "error";
}

function getReturnContextFromFormData(formData: FormData): VoidReturnContextParams {
  return {
    month: normalizeRecordsMonth(getFormString(formData, "return_month")),
    type: normalizeReturnType(getFormString(formData, "return_type")),
    category: normalizeReturnText(getFormString(formData, "return_category"), 120),
    member: normalizeReturnText(getFormString(formData, "return_member"), 120),
    q: normalizeReturnText(getFormString(formData, "return_q"), 80)
  };
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
