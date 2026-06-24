import { createNormalizedImportItemDraft, normalizeHeader, stringifyCell } from "./normalize-import-item";
import { suggestImportReviewFields } from "./suggestions";
import { ImportReviewParserError, type ImportDirection, type NormalizedImportItemDraft } from "./types";

type HeaderKey =
  | "sourceTransactionId"
  | "transactionTime"
  | "sourceCategory"
  | "counterparty"
  | "description"
  | "direction"
  | "amount"
  | "paymentMethod"
  | "sourceStatus";

type HeaderMap = Partial<Record<HeaderKey, number>>;

export function parseAlipayCsv(csvText: string): NormalizedImportItemDraft[] {
  const rows = parseCsv(csvText);
  const headerIndex = findHeaderIndex(rows);

  if (headerIndex < 0) {
    throw new ImportReviewParserError("missing_header", "Could not find Alipay CSV header row");
  }

  const headerMap = createHeaderMap(rows[headerIndex]);
  requireHeaders(headerMap, ["transactionTime", "amount"]);

  return rows
    .slice(headerIndex + 1)
    .filter((row) => row.some((cell) => cell.trim()))
    .map((row) => normalizeAlipayRow(row, rows[headerIndex], headerMap));
}

function normalizeAlipayRow(
  row: string[],
  headers: string[],
  headerMap: HeaderMap
): NormalizedImportItemDraft {
  const rawJson = Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]));
  const direction = inferAlipayDirection({
    directionText: pick(row, headerMap.direction),
    amountText: pick(row, headerMap.amount),
    sourceCategory: pick(row, headerMap.sourceCategory),
    description: pick(row, headerMap.description),
    sourceStatus: pick(row, headerMap.sourceStatus)
  });
  const suggestion = suggestImportReviewFields({
    direction,
    counterparty: pick(row, headerMap.counterparty),
    description: pick(row, headerMap.description),
    sourceCategory: pick(row, headerMap.sourceCategory),
    sourceStatus: pick(row, headerMap.sourceStatus),
    paymentMethod: pick(row, headerMap.paymentMethod)
  });

  return createNormalizedImportItemDraft({
    source: "alipay",
    sourceTransactionId: pick(row, headerMap.sourceTransactionId),
    transactionTime: pick(row, headerMap.transactionTime),
    direction,
    amount: pick(row, headerMap.amount),
    counterparty: pick(row, headerMap.counterparty),
    description: pick(row, headerMap.description),
    paymentMethod: pick(row, headerMap.paymentMethod),
    sourceCategory: pick(row, headerMap.sourceCategory),
    sourceStatus: pick(row, headerMap.sourceStatus),
    rawJson,
    ...suggestion
  });
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const normalized = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        cell += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }

  return rows;
}

function findHeaderIndex(rows: string[][]) {
  return rows.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    return (
      headers.some((header) => headerAliases.transactionTime.includes(header)) &&
      headers.some((header) => headerAliases.amount.includes(header))
    );
  });
}

function createHeaderMap(headers: string[]): HeaderMap {
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
      throw new ImportReviewParserError("missing_required_field", `Missing Alipay field: ${key}`);
    }
  }
}

function inferAlipayDirection({
  directionText,
  amountText,
  sourceCategory,
  description,
  sourceStatus
}: {
  directionText: string;
  amountText: string;
  sourceCategory: string;
  description: string;
  sourceStatus: string;
}): ImportDirection {
  const combined = [directionText, sourceCategory, description, sourceStatus].join(" ");

  if (includesAny(combined, ["退款", "退回", "已退款"])) {
    return "refund";
  }

  if (includesAny(combined, ["不计收支", "转账", "提现", "充值", "余额宝", "理财"])) {
    return "transfer";
  }

  if (directionText.includes("支出") || amountText.trim().startsWith("-")) {
    return "expense";
  }

  if (directionText.includes("收入") || amountText.trim().startsWith("+")) {
    return "income";
  }

  return "unknown";
}

function includesAny(value: string, tokens: string[]) {
  return tokens.some((token) => value.includes(token));
}

function pick(row: string[], index: number | undefined) {
  return index === undefined ? "" : stringifyCell(row[index]);
}

const headerAliases: Record<HeaderKey, string[]> = {
  sourceTransactionId: ["交易号", "交易订单号", "支付宝交易号", "商家订单号"],
  transactionTime: ["交易创建时间", "交易时间", "付款时间", "创建时间"],
  sourceCategory: ["交易分类", "分类"],
  counterparty: ["交易对方", "对方", "商户名称", "收款方"],
  description: ["商品说明", "商品名称", "备注", "交易备注"],
  direction: ["收支", "收/支", "收入支出"],
  amount: ["金额", "金额元", "交易金额"],
  paymentMethod: ["收付款方式", "收/付款方式", "付款方式", "支付方式"],
  sourceStatus: ["交易状态", "状态", "当前状态"]
};
