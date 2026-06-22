import { createHash } from "node:crypto";
import type {
  SettlementCalculationStatus,
  SettlementSummaryResult,
  SettlementTransferSuggestion
} from "@/types/settlement";

export const SETTLEMENT_SNAPSHOT_SCHEMA_VERSION = 1;
export const SETTLEMENT_CALCULATION_VERSION = "v1";

type PersistableCalculationStatus = Extract<
  SettlementCalculationStatus,
  "ready" | "no_settlement_needed"
>;

export type SettlementSnapshotMemberBalance = {
  userId: string;
  displayName: string;
  paidAmountCents: number;
  shareAmountCents: number;
  netAmountCents: number;
};

export type SettlementSnapshotTransferSuggestion = {
  fromUserId: string;
  toUserId: string;
  amountCents: number;
};

export type SettlementSnapshotJson = {
  schemaVersion: typeof SETTLEMENT_SNAPSHOT_SCHEMA_VERSION;
  calculationVersion: typeof SETTLEMENT_CALCULATION_VERSION;
  householdId: string;
  createdBy: string;
  createdAt: string;
  month: {
    key: string;
    label: string;
    monthStart: string;
    nextMonthStart: string;
  };
  totalExpenseCents: number;
  expenseCount: number;
  calculationStatus: PersistableCalculationStatus;
  memberBalances: SettlementSnapshotMemberBalance[];
  transferSuggestion: SettlementSnapshotTransferSuggestion | null;
  calculationWarnings: string[];
  readWarning: string | null;
  source: {
    fingerprint: string;
    expenseCount: number;
  };
};

export type SettlementSnapshotInsertPayload = {
  household_id: string;
  month_start: string;
  created_by: string;
  total_expense_cents: number;
  transfer_from_user_id: string | null;
  transfer_to_user_id: string | null;
  transfer_amount_cents: number;
  expense_count: number;
  calculation_version: typeof SETTLEMENT_CALCULATION_VERSION;
  calculation_status: PersistableCalculationStatus;
  source_fingerprint: string;
  snapshot: SettlementSnapshotJson;
};

export type BuildSettlementSnapshotPayloadInput = {
  householdId: string;
  createdBy: string;
  createdAt: Date | string;
  summaryResult: SettlementSummaryResult;
};

export type BuildSettlementSnapshotPayloadErrorCode =
  | "invalid_created_at"
  | "invalid_money_amount"
  | "invalid_transfer_shape"
  | "unsupported_calculation_status";

export type BuildSettlementSnapshotPayloadResult =
  | {
      ok: true;
      payload: SettlementSnapshotInsertPayload;
    }
  | {
      ok: false;
      errorCode: BuildSettlementSnapshotPayloadErrorCode;
    };

export function buildSettlementSnapshotPayload({
  householdId,
  createdBy,
  createdAt,
  summaryResult
}: BuildSettlementSnapshotPayloadInput): BuildSettlementSnapshotPayloadResult {
  const { summary, warning } = summaryResult;
  const calculationStatus = summary.calculation.status;

  if (!isPersistableCalculationStatus(calculationStatus)) {
    return { ok: false, errorCode: "unsupported_calculation_status" };
  }

  const createdAtIso = normalizeCreatedAt(createdAt);

  if (!createdAtIso) {
    return { ok: false, errorCode: "invalid_created_at" };
  }

  const totalExpenseCents = parseMoneyToCents(summary.totalExpense);

  if (totalExpenseCents === null || totalExpenseCents < 0) {
    return { ok: false, errorCode: "invalid_money_amount" };
  }

  const memberBalances = [];

  for (const balance of summary.calculation.memberBalances) {
    const paidAmountCents = parseMoneyToCents(balance.paidAmount);
    const shareAmountCents = parseMoneyToCents(balance.shareAmount);
    const netAmountCents = parseMoneyToCents(balance.netAmount);

    if (
      paidAmountCents === null ||
      shareAmountCents === null ||
      netAmountCents === null ||
      paidAmountCents < 0 ||
      shareAmountCents < 0
    ) {
      return { ok: false, errorCode: "invalid_money_amount" };
    }

    memberBalances.push({
      userId: balance.userId,
      displayName: balance.displayName,
      paidAmountCents,
      shareAmountCents,
      netAmountCents
    });
  }

  const transferSuggestion = mapTransferSuggestion(summary.calculation.transferSuggestion);

  if (transferSuggestion === "invalid_money") {
    return { ok: false, errorCode: "invalid_money_amount" };
  }

  if (transferSuggestion === "invalid_shape") {
    return { ok: false, errorCode: "invalid_transfer_shape" };
  }

  const transferAmountCents = transferSuggestion?.amountCents ?? 0;
  const sourceFingerprintInput = {
    calculationStatus,
    calculationVersion: SETTLEMENT_CALCULATION_VERSION,
    expenseCount: summary.includedExpenseCount,
    householdId,
    memberBalances,
    monthStart: summary.month.monthStart,
    nextMonthStart: summary.month.nextMonthStart,
    totalExpenseCents,
    transferSuggestion
  };
  const sourceFingerprint = createSourceFingerprint(sourceFingerprintInput);
  const snapshot: SettlementSnapshotJson = {
    schemaVersion: SETTLEMENT_SNAPSHOT_SCHEMA_VERSION,
    calculationVersion: SETTLEMENT_CALCULATION_VERSION,
    householdId,
    createdBy,
    createdAt: createdAtIso,
    month: {
      key: summary.month.month,
      label: summary.month.monthLabel,
      monthStart: summary.month.monthStart,
      nextMonthStart: summary.month.nextMonthStart
    },
    totalExpenseCents,
    expenseCount: summary.includedExpenseCount,
    calculationStatus,
    memberBalances,
    transferSuggestion,
    calculationWarnings: [...summary.calculation.warnings],
    readWarning: warning,
    source: {
      fingerprint: sourceFingerprint,
      expenseCount: summary.includedExpenseCount
    }
  };

  return {
    ok: true,
    payload: {
      household_id: householdId,
      month_start: summary.month.monthStart,
      created_by: createdBy,
      total_expense_cents: totalExpenseCents,
      transfer_from_user_id: transferSuggestion?.fromUserId ?? null,
      transfer_to_user_id: transferSuggestion?.toUserId ?? null,
      transfer_amount_cents: transferAmountCents,
      expense_count: summary.includedExpenseCount,
      calculation_version: SETTLEMENT_CALCULATION_VERSION,
      calculation_status: calculationStatus,
      source_fingerprint: sourceFingerprint,
      snapshot
    }
  };
}

function isPersistableCalculationStatus(
  status: SettlementCalculationStatus
): status is PersistableCalculationStatus {
  return status === "ready" || status === "no_settlement_needed";
}

function normalizeCreatedAt(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;

  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function mapTransferSuggestion(
  suggestion: SettlementTransferSuggestion | null
): SettlementSnapshotTransferSuggestion | null | "invalid_money" | "invalid_shape" {
  if (!suggestion) {
    return null;
  }

  const amountCents = parseMoneyToCents(suggestion.amount);

  if (amountCents === null) {
    return "invalid_money";
  }

  if (
    amountCents <= 0 ||
    !suggestion.fromUserId ||
    !suggestion.toUserId ||
    suggestion.fromUserId === suggestion.toUserId
  ) {
    return "invalid_shape";
  }

  return {
    fromUserId: suggestion.fromUserId,
    toUserId: suggestion.toUserId,
    amountCents
  };
}

function parseMoneyToCents(value: string | number) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return null;
    }

    const cents = Math.round(value * 100);

    if (Math.abs(value * 100 - cents) > 0.000001 || !Number.isSafeInteger(cents)) {
      return null;
    }

    return cents;
  }

  const normalized = value.trim().replace(/,/g, "");

  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const sign = normalized.startsWith("-") ? -1 : 1;
  const unsigned = sign === -1 ? normalized.slice(1) : normalized;
  const [yuanPart, centPart = ""] = unsigned.split(".");
  const yuan = Number(yuanPart);
  const cents = Number(centPart.padEnd(2, "0"));
  const totalCents = sign * (yuan * 100 + cents);

  return Number.isSafeInteger(totalCents) ? totalCents : null;
}

function createSourceFingerprint(value: unknown) {
  return `sha256:${createHash("sha256").update(stableStringify(value)).digest("hex")}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(",")}}`;
}
