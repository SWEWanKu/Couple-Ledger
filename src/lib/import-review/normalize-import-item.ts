import {
  ImportReviewParserError,
  type ImportDirection,
  type ImportRawJson,
  type ImportRawJsonValue,
  type ImportSource,
  type NormalizedImportItemDraft,
  type SuggestedReviewAction
} from "./types";

type NormalizeImportItemInput = {
  source: ImportSource;
  sourceTransactionId?: unknown;
  transactionTime: unknown;
  direction: ImportDirection;
  amount: unknown;
  counterparty?: unknown;
  description?: unknown;
  paymentMethod?: unknown;
  sourceCategory?: unknown;
  sourceStatus?: unknown;
  rawJson: Record<string, unknown>;
  suggestedCategory: string | null;
  suggestedReviewAction: SuggestedReviewAction;
};

export function createNormalizedImportItemDraft({
  source,
  sourceTransactionId,
  transactionTime,
  direction,
  amount,
  counterparty,
  description,
  paymentMethod,
  sourceCategory,
  sourceStatus,
  rawJson,
  suggestedCategory,
  suggestedReviewAction
}: NormalizeImportItemInput): NormalizedImportItemDraft {
  const transactionIso = parseTransactionTimeToIso(transactionTime);
  const amountCents = parseAmountToCents(amount);

  return {
    source,
    sourceTransactionId: normalizeOptionalText(sourceTransactionId),
    transactionTime: transactionIso,
    monthKey: transactionIso.slice(0, 7),
    direction,
    amountCents,
    counterparty: normalizeOptionalText(counterparty),
    description: normalizeOptionalText(description),
    paymentMethod: normalizeOptionalText(paymentMethod),
    sourceCategory: normalizeOptionalText(sourceCategory),
    sourceStatus: normalizeOptionalText(sourceStatus),
    rawJson: normalizeRawJson(rawJson),
    reviewStatus: "pending",
    suggestedCategory,
    suggestedReviewAction
  };
}

export function normalizeOptionalText(value: unknown) {
  const normalized = stringifyCell(value).trim();
  return normalized ? normalized : null;
}

export function stringifyCell(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value).replace(/^\uFEFF/, "");
}

export function normalizeHeader(value: unknown) {
  return stringifyCell(value)
    .replace(/^\uFEFF/, "")
    .replace(/\s+/g, "")
    .replace(/[：:]/g, "")
    .trim();
}

export function parseAmountToCents(value: unknown) {
  const raw = stringifyCell(value)
    .replace(/,/g, "")
    .replace(/[￥¥元]/g, "")
    .replace(/\s+/g, "")
    .trim();
  const match = raw.match(/[+-]?\d+(?:\.\d+)?/);

  if (!match) {
    throw new ImportReviewParserError("invalid_amount", `Invalid amount: ${stringifyCell(value)}`);
  }

  const [integerPart, decimalPart = ""] = match[0].replace(/^[+-]/, "").split(".");

  if (!/^\d+$/.test(integerPart) || (decimalPart && !/^\d+$/.test(decimalPart))) {
    throw new ImportReviewParserError("invalid_amount", `Invalid amount: ${stringifyCell(value)}`);
  }

  const cents = Number(integerPart) * 100 + Number(decimalPart.slice(0, 2).padEnd(2, "0"));

  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new ImportReviewParserError("invalid_amount", `Invalid amount: ${stringifyCell(value)}`);
  }

  return cents;
}

export function parseTransactionTimeToIso(value: unknown) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }

  const text = stringifyCell(value).trim();

  if (!text) {
    throw new ImportReviewParserError("invalid_transaction_time", "Missing transaction time");
  }

  const normalized = text
    .replace(/\//g, "-")
    .replace(/年|月/g, "-")
    .replace(/日/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const dateTimeMatch = normalized.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/
  );

  if (!dateTimeMatch) {
    const parsed = new Date(text);

    if (Number.isFinite(parsed.getTime())) {
      return parsed.toISOString();
    }

    throw new ImportReviewParserError(
      "invalid_transaction_time",
      `Invalid transaction time: ${text}`
    );
  }

  const [, yearText, monthText, dayText, hourText = "0", minuteText = "0", secondText = "0"] =
    dateTimeMatch;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second
  ) {
    throw new ImportReviewParserError(
      "invalid_transaction_time",
      `Invalid transaction time: ${text}`
    );
  }

  return date.toISOString();
}

export function normalizeRawJson(row: Record<string, unknown>): ImportRawJson {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, normalizeRawJsonValue(value)])
  );
}

function normalizeRawJsonValue(value: unknown): ImportRawJsonValue {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  return String(value);
}
