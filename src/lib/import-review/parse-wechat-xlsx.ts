import { readSheet } from "read-excel-file/node";

import { createNormalizedImportItemDraft, normalizeHeader, stringifyCell } from "./normalize-import-item";
import { suggestImportReviewFields } from "./suggestions";
import { ImportReviewParserError, type ImportDirection, type NormalizedImportItemDraft } from "./types";

type SpreadsheetCell = string | number | boolean | Date | null;
type SpreadsheetRow = SpreadsheetCell[];

type HeaderKey =
  | "sourceTransactionId"
  | "transactionTime"
  | "transactionType"
  | "counterparty"
  | "description"
  | "direction"
  | "amount"
  | "paymentMethod"
  | "sourceStatus";

type HeaderMap = Partial<Record<HeaderKey, number>>;

export async function parseWeChatXlsx(input: Buffer | string): Promise<NormalizedImportItemDraft[]> {
  const rows = (await readSheet(input)) as SpreadsheetRow[];
  const headerIndex = findHeaderIndex(rows);

  if (headerIndex < 0) {
    throw new ImportReviewParserError("missing_header", "Could not find WeChat XLSX header row");
  }

  const headers = rows[headerIndex].map(stringifyCell);
  const headerMap = createHeaderMap(rows[headerIndex]);
  requireHeaders(headerMap, ["transactionTime", "amount"]);

  return rows
    .slice(headerIndex + 1)
    .filter((row) => row.some((cell) => stringifyCell(cell).trim()))
    .map((row) => normalizeWeChatRow(row, headers, headerMap));
}

function normalizeWeChatRow(
  row: SpreadsheetRow,
  headers: string[],
  headerMap: HeaderMap
): NormalizedImportItemDraft {
  const rawJson = Object.fromEntries(headers.map((header, index) => [header, row[index] ?? null]));
  const direction = inferWeChatDirection({
    directionText: pick(row, headerMap.direction),
    transactionType: pick(row, headerMap.transactionType),
    description: pick(row, headerMap.description),
    sourceStatus: pick(row, headerMap.sourceStatus)
  });
  const suggestion = suggestImportReviewFields({
    direction,
    counterparty: pick(row, headerMap.counterparty),
    description: pick(row, headerMap.description),
    sourceCategory: pick(row, headerMap.transactionType),
    sourceStatus: pick(row, headerMap.sourceStatus),
    paymentMethod: pick(row, headerMap.paymentMethod)
  });

  return createNormalizedImportItemDraft({
    source: "wechat",
    sourceTransactionId: pick(row, headerMap.sourceTransactionId),
    transactionTime: pick(row, headerMap.transactionTime),
    direction,
    amount: pick(row, headerMap.amount),
    counterparty: pick(row, headerMap.counterparty),
    description: pick(row, headerMap.description),
    paymentMethod: pick(row, headerMap.paymentMethod),
    sourceCategory: pick(row, headerMap.transactionType),
    sourceStatus: pick(row, headerMap.sourceStatus),
    rawJson,
    ...suggestion
  });
}

function findHeaderIndex(rows: SpreadsheetRow[]) {
  return rows.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    return (
      headers.some((header) => headerAliases.transactionTime.includes(header)) &&
      headers.some((header) => headerAliases.amount.includes(header))
    );
  });
}

function createHeaderMap(headers: SpreadsheetRow): HeaderMap {
  const normalizedHeaders = headers.map(normalizeHeader);
  const entries = Object.entries(headerAliases).map(([key, aliases]) => {
    const index = normalizedHeaders.findIndex((header) => aliases.includes(header));
    return [key, index >= 0 ? index : undefined] as const;
  });

  return Object.fromEntries(entries.filter(([, index]) => index !== undefined)) as HeaderMap;
}

function requireHeaders(headerMap: HeaderMap, required: HeaderKey[]) {
  for (const key of required) {
    if (headerMap[key] === undefined) {
      throw new ImportReviewParserError("missing_required_field", `Missing WeChat field: ${key}`);
    }
  }
}

function inferWeChatDirection({
  directionText,
  transactionType,
  description,
  sourceStatus
}: {
  directionText: string;
  transactionType: string;
  description: string;
  sourceStatus: string;
}): ImportDirection {
  const combined = [directionText, transactionType, description, sourceStatus].join(" ");

  if (includesAny(combined, ["退款", "退回", "已退款"])) {
    return "refund";
  }

  if (includesAny(combined, ["不计收支", "转账", "提现", "充值", "零钱通", "理财"])) {
    return "transfer";
  }

  if (directionText.includes("支出")) {
    return "expense";
  }

  if (directionText.includes("收入")) {
    return "income";
  }

  return "unknown";
}

function includesAny(value: string, tokens: string[]) {
  return tokens.some((token) => value.includes(token));
}

function pick(row: SpreadsheetRow, index: number | undefined) {
  return index === undefined ? "" : stringifyCell(row[index]);
}

const headerAliases: Record<HeaderKey, string[]> = {
  sourceTransactionId: ["交易单号", "微信支付订单号", "商户单号", "交易号", "交易编号"],
  transactionTime: ["交易时间", "交易创建时间", "支付时间"],
  transactionType: ["交易类型", "类型", "交易分类"],
  counterparty: ["交易对方", "对方", "商户名称"],
  description: ["商品", "商品名称", "商品说明", "备注"],
  direction: ["收支", "收/支", "收入支出"],
  amount: ["金额元", "金额(元)", "金额", "交易金额"],
  paymentMethod: ["支付方式", "付款方式", "收付款方式", "收/付款方式"],
  sourceStatus: ["当前状态", "交易状态", "状态"]
};
