export type ImportSource = "wechat" | "alipay";

export type ImportDirection = "expense" | "income" | "transfer" | "refund" | "unknown";

export type ImportReviewStatus = "pending" | "imported" | "skipped" | "need_discussion";

export type SuggestedReviewAction = "review" | "skip" | "need_discussion";

export type ImportRawJsonValue = string | number | boolean | null;

export type ImportRawJson = Record<string, ImportRawJsonValue>;

export type NormalizedImportItemDraft = {
  source: ImportSource;
  sourceTransactionId: string | null;
  transactionTime: string;
  monthKey: string;
  direction: ImportDirection;
  amountCents: number;
  counterparty: string | null;
  description: string | null;
  paymentMethod: string | null;
  sourceCategory: string | null;
  sourceStatus: string | null;
  rawJson: ImportRawJson;
  reviewStatus: "pending";
  suggestedCategory: string | null;
  suggestedReviewAction: SuggestedReviewAction;
};

export type ImportReviewParserErrorCode =
  | "missing_header"
  | "missing_required_field"
  | "invalid_amount"
  | "invalid_transaction_time";

export class ImportReviewParserError extends Error {
  readonly code: ImportReviewParserErrorCode;

  constructor(code: ImportReviewParserErrorCode, message: string) {
    super(message);
    this.name = "ImportReviewParserError";
    this.code = code;
  }
}
