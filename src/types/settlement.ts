export type SettlementEntryType = "expense" | "income";

export type SettlementMoneyInput = number | string;

export type SettlementCalculationStatus =
  | "ready"
  | "no_settlement_needed"
  | "incomplete"
  | "unsupported_member_count";

export type SettlementMemberInput = {
  userId: string;
  displayName: string;
};

export type SettlementEntryInput = {
  id: string;
  amount: SettlementMoneyInput;
  entryType: SettlementEntryType;
  paidBy: string;
};

export type SettlementSplitInput = {
  entryId: string;
  userId: string;
  shareAmount: SettlementMoneyInput;
};

export type SettlementCalculationInput = {
  members: SettlementMemberInput[];
  entries: SettlementEntryInput[];
  splits: SettlementSplitInput[];
};

export type SettlementMemberBalance = {
  userId: string;
  displayName: string;
  paidAmount: string;
  shareAmount: string;
  netAmount: string;
};

export type SettlementTransferSuggestion = {
  fromUserId: string;
  toUserId: string;
  amount: string;
};

export type SettlementCalculationResult = {
  status: SettlementCalculationStatus;
  totalExpense: string;
  memberBalances: SettlementMemberBalance[];
  transferSuggestion: SettlementTransferSuggestion | null;
  warnings: string[];
};
