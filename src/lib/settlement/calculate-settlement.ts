import type {
  SettlementCalculationInput,
  SettlementCalculationResult,
  SettlementEntryInput,
  SettlementMemberBalance,
  SettlementMemberInput,
  SettlementMoneyInput,
  SettlementSplitInput,
  SettlementTransferSuggestion
} from "@/types/settlement";

type MutableMemberBalance = {
  userId: string;
  displayName: string;
  paidCents: number;
  shareCents: number;
};

type MoneyParseResult =
  | {
      ok: true;
      cents: number;
    }
  | {
      ok: false;
    };

const incompleteSplitCopy = "分摊数据待完善";
const missingMemberCopy = "成员数据待完善";

export function calculateSettlement({
  members,
  entries,
  splits
}: SettlementCalculationInput): SettlementCalculationResult {
  const warnings: string[] = [];
  const balances = createMemberBalanceMap(members, warnings);
  const expenseEntries = entries.filter((entry) => entry.entryType === "expense");

  if (expenseEntries.length === 0) {
    return createResult("no_settlement_needed", 0, balances, null, warnings);
  }

  const splitsByEntryId = groupSplitsByEntryId(splits);
  let totalExpenseCents = 0;

  expenseEntries.forEach((entry) => {
    const amount = parseMoneyToCents(entry.amount);

    if (!amount.ok || amount.cents <= 0) {
      addWarning(warnings, `${incompleteSplitCopy}: entry ${entry.id} has an invalid amount.`);
      return;
    }

    totalExpenseCents += amount.cents;
    addPaidAmount(entry, amount.cents, balances, warnings);
    addSplitAmounts(entry, amount.cents, splitsByEntryId.get(entry.id) ?? [], balances, warnings);
  });

  const paidTotalCents = sumBalances(balances, "paidCents");
  const shareTotalCents = sumBalances(balances, "shareCents");

  if (paidTotalCents !== totalExpenseCents) {
    addWarning(warnings, `${incompleteSplitCopy}: paid total does not match expense total.`);
  }

  if (shareTotalCents !== totalExpenseCents) {
    addWarning(warnings, `${incompleteSplitCopy}: split total does not match expense total.`);
  }

  if (warnings.length > 0) {
    return createResult("incomplete", totalExpenseCents, balances, null, warnings);
  }

  if (members.length <= 1 || areAllMembersBalanced(balances)) {
    return createResult("no_settlement_needed", totalExpenseCents, balances, null, warnings);
  }

  if (members.length > 2) {
    return createResult("unsupported_member_count", totalExpenseCents, balances, null, [
      "More than two members need a separately designed transfer suggestion algorithm."
    ]);
  }

  const transferSuggestion = createTwoMemberTransferSuggestion(Array.from(balances.values()));

  return createResult(
    transferSuggestion ? "ready" : "no_settlement_needed",
    totalExpenseCents,
    balances,
    transferSuggestion,
    warnings
  );
}

export function assertSettlementCalculationExamples(): string[] {
  const passed: string[] = [];
  const owner: SettlementMemberInput = { userId: "owner", displayName: "Owner" };
  const partner: SettlementMemberInput = { userId: "partner", displayName: "Partner" };
  const third: SettlementMemberInput = { userId: "third", displayName: "Third" };
  const twoMembers = [owner, partner];

  assertCase("no entries -> no settlement", passed, () => {
    const result = calculateSettlement({ members: twoMembers, entries: [], splits: [] });

    return result.status === "no_settlement_needed" && result.totalExpense === "0.00";
  });

  assertCase("income-only -> no settlement", passed, () => {
    const result = calculateSettlement({
      members: twoMembers,
      entries: [{ id: "income-1", amount: "800.00", entryType: "income", paidBy: owner.userId }],
      splits: [{ entryId: "income-1", userId: owner.userId, shareAmount: "800.00" }]
    });

    return result.status === "no_settlement_needed" && result.totalExpense === "0.00";
  });

  assertCase("one equal expense paid by owner -> partner owes half", passed, () => {
    const result = calculateSettlement({
      members: twoMembers,
      entries: [{ id: "expense-1", amount: "100.00", entryType: "expense", paidBy: owner.userId }],
      splits: [
        { entryId: "expense-1", userId: owner.userId, shareAmount: "50.00" },
        { entryId: "expense-1", userId: partner.userId, shareAmount: "50.00" }
      ]
    });

    return (
      result.status === "ready" &&
      result.transferSuggestion?.fromUserId === partner.userId &&
      result.transferSuggestion.toUserId === owner.userId &&
      result.transferSuggestion.amount === "50.00"
    );
  });

  assertCase("one equal expense paid by partner -> owner owes half", passed, () => {
    const result = calculateSettlement({
      members: twoMembers,
      entries: [{ id: "expense-1", amount: "80.00", entryType: "expense", paidBy: partner.userId }],
      splits: [
        { entryId: "expense-1", userId: owner.userId, shareAmount: "40.00" },
        { entryId: "expense-1", userId: partner.userId, shareAmount: "40.00" }
      ]
    });

    return (
      result.status === "ready" &&
      result.transferSuggestion?.fromUserId === owner.userId &&
      result.transferSuggestion.toUserId === partner.userId &&
      result.transferSuggestion.amount === "40.00"
    );
  });

  assertCase("one personal expense paid by responsible user -> no settlement", passed, () => {
    const result = calculateSettlement({
      members: twoMembers,
      entries: [{ id: "expense-1", amount: "45.00", entryType: "expense", paidBy: owner.userId }],
      splits: [{ entryId: "expense-1", userId: owner.userId, shareAmount: "45.00" }]
    });

    return result.status === "no_settlement_needed" && result.transferSuggestion === null;
  });

  assertCase("mixed income + expense -> income ignored", passed, () => {
    const result = calculateSettlement({
      members: twoMembers,
      entries: [
        { id: "income-1", amount: "999.00", entryType: "income", paidBy: owner.userId },
        { id: "expense-1", amount: "60.00", entryType: "expense", paidBy: owner.userId }
      ],
      splits: [
        { entryId: "income-1", userId: owner.userId, shareAmount: "999.00" },
        { entryId: "expense-1", userId: owner.userId, shareAmount: "30.00" },
        { entryId: "expense-1", userId: partner.userId, shareAmount: "30.00" }
      ]
    });

    return result.totalExpense === "60.00" && result.transferSuggestion?.amount === "30.00";
  });

  assertCase("multiple expenses with opposite payers -> nets combine correctly", passed, () => {
    const result = calculateSettlement({
      members: twoMembers,
      entries: [
        { id: "expense-1", amount: "100.00", entryType: "expense", paidBy: owner.userId },
        { id: "expense-2", amount: "40.00", entryType: "expense", paidBy: partner.userId }
      ],
      splits: [
        { entryId: "expense-1", userId: owner.userId, shareAmount: "50.00" },
        { entryId: "expense-1", userId: partner.userId, shareAmount: "50.00" },
        { entryId: "expense-2", userId: owner.userId, shareAmount: "20.00" },
        { entryId: "expense-2", userId: partner.userId, shareAmount: "20.00" }
      ]
    });

    return (
      result.status === "ready" &&
      result.transferSuggestion?.fromUserId === partner.userId &&
      result.transferSuggestion.toUserId === owner.userId &&
      result.transferSuggestion.amount === "30.00"
    );
  });

  assertCase("missing split rows -> incomplete", passed, () => {
    const result = calculateSettlement({
      members: twoMembers,
      entries: [{ id: "expense-1", amount: "100.00", entryType: "expense", paidBy: owner.userId }],
      splits: []
    });

    return (
      result.status === "incomplete" &&
      result.transferSuggestion === null &&
      result.warnings.some((warning) => warning.includes(incompleteSplitCopy))
    );
  });

  assertCase("split mismatch -> incomplete", passed, () => {
    const result = calculateSettlement({
      members: twoMembers,
      entries: [{ id: "expense-1", amount: "100.00", entryType: "expense", paidBy: owner.userId }],
      splits: [{ entryId: "expense-1", userId: owner.userId, shareAmount: "50.00" }]
    });

    return result.status === "incomplete" && result.transferSuggestion === null;
  });

  assertCase("one household member -> no settlement needed", passed, () => {
    const result = calculateSettlement({
      members: [owner],
      entries: [{ id: "expense-1", amount: "25.00", entryType: "expense", paidBy: owner.userId }],
      splits: [{ entryId: "expense-1", userId: owner.userId, shareAmount: "25.00" }]
    });

    return result.status === "no_settlement_needed" && result.transferSuggestion === null;
  });

  assertCase("more than two members -> no two-person transfer shortcut", passed, () => {
    const result = calculateSettlement({
      members: [owner, partner, third],
      entries: [{ id: "expense-1", amount: "90.00", entryType: "expense", paidBy: owner.userId }],
      splits: [
        { entryId: "expense-1", userId: owner.userId, shareAmount: "30.00" },
        { entryId: "expense-1", userId: partner.userId, shareAmount: "30.00" },
        { entryId: "expense-1", userId: third.userId, shareAmount: "30.00" }
      ]
    });

    return result.status === "unsupported_member_count" && result.transferSuggestion === null;
  });

  return passed;
}

function createMemberBalanceMap(members: SettlementMemberInput[], warnings: string[]) {
  const balances = new Map<string, MutableMemberBalance>();

  members.forEach((member) => {
    if (!member.userId) {
      addWarning(warnings, `${missingMemberCopy}: a member is missing userId.`);
      return;
    }

    if (balances.has(member.userId)) {
      addWarning(warnings, `${missingMemberCopy}: duplicate member ${member.userId}.`);
      return;
    }

    balances.set(member.userId, {
      userId: member.userId,
      displayName: member.displayName,
      paidCents: 0,
      shareCents: 0
    });
  });

  return balances;
}

function groupSplitsByEntryId(splits: SettlementSplitInput[]) {
  const groups = new Map<string, SettlementSplitInput[]>();

  splits.forEach((split) => {
    const group = groups.get(split.entryId) ?? [];
    group.push(split);
    groups.set(split.entryId, group);
  });

  return groups;
}

function addPaidAmount(
  entry: SettlementEntryInput,
  amountCents: number,
  balances: Map<string, MutableMemberBalance>,
  warnings: string[]
) {
  const payer = balances.get(entry.paidBy);

  if (!payer) {
    addWarning(warnings, `${missingMemberCopy}: paid_by ${entry.paidBy} is not in household members.`);
    return;
  }

  payer.paidCents += amountCents;
}

function addSplitAmounts(
  entry: SettlementEntryInput,
  entryAmountCents: number,
  entrySplits: SettlementSplitInput[],
  balances: Map<string, MutableMemberBalance>,
  warnings: string[]
) {
  if (entrySplits.length === 0) {
    addWarning(warnings, `${incompleteSplitCopy}: entry ${entry.id} has no split rows.`);
    return;
  }

  let splitTotalCents = 0;

  entrySplits.forEach((split) => {
    const shareAmount = parseMoneyToCents(split.shareAmount);

    if (!shareAmount.ok || shareAmount.cents < 0) {
      addWarning(warnings, `${incompleteSplitCopy}: entry ${entry.id} has an invalid split amount.`);
      return;
    }

    splitTotalCents += shareAmount.cents;
    const member = balances.get(split.userId);

    if (!member) {
      addWarning(warnings, `${missingMemberCopy}: split user ${split.userId} is not in household members.`);
      return;
    }

    member.shareCents += shareAmount.cents;
  });

  if (splitTotalCents !== entryAmountCents) {
    addWarning(
      warnings,
      `${incompleteSplitCopy}: entry ${entry.id} split total ${formatCents(splitTotalCents)} does not match amount ${formatCents(entryAmountCents)}.`
    );
  }
}

function createTwoMemberTransferSuggestion(
  balances: MutableMemberBalance[]
): SettlementTransferSuggestion | null {
  const debtor = balances.find((balance) => getNetCents(balance) < 0);
  const creditor = balances.find((balance) => getNetCents(balance) > 0);

  if (!debtor || !creditor) {
    return null;
  }

  return {
    fromUserId: debtor.userId,
    toUserId: creditor.userId,
    amount: formatCents(Math.abs(getNetCents(debtor)))
  };
}

function createResult(
  status: SettlementCalculationResult["status"],
  totalExpenseCents: number,
  balances: Map<string, MutableMemberBalance>,
  transferSuggestion: SettlementTransferSuggestion | null,
  warnings: string[]
): SettlementCalculationResult {
  return {
    status,
    totalExpense: formatCents(totalExpenseCents),
    memberBalances: Array.from(balances.values()).map(formatMemberBalance),
    transferSuggestion,
    warnings
  };
}

function formatMemberBalance(balance: MutableMemberBalance): SettlementMemberBalance {
  return {
    userId: balance.userId,
    displayName: balance.displayName,
    paidAmount: formatCents(balance.paidCents),
    shareAmount: formatCents(balance.shareCents),
    netAmount: formatCents(getNetCents(balance))
  };
}

function getNetCents(balance: MutableMemberBalance) {
  return balance.paidCents - balance.shareCents;
}

function areAllMembersBalanced(balances: Map<string, MutableMemberBalance>) {
  return Array.from(balances.values()).every((balance) => getNetCents(balance) === 0);
}

function sumBalances(
  balances: Map<string, MutableMemberBalance>,
  field: "paidCents" | "shareCents"
) {
  return Array.from(balances.values()).reduce((sum, balance) => sum + balance[field], 0);
}

function parseMoneyToCents(value: SettlementMoneyInput): MoneyParseResult {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return { ok: false };
    }

    const cents = Math.round(value * 100);

    if (Math.abs(value * 100 - cents) > 0.000001) {
      return { ok: false };
    }

    return { ok: true, cents };
  }

  const normalized = value.trim().replace(/,/g, "");

  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) {
    return { ok: false };
  }

  const sign = normalized.startsWith("-") ? -1 : 1;
  const unsigned = sign === -1 ? normalized.slice(1) : normalized;
  const [yuanPart, centPart = ""] = unsigned.split(".");
  const yuan = Number(yuanPart);
  const cents = Number(centPart.padEnd(2, "0"));
  const totalCents = sign * (yuan * 100 + cents);

  return Number.isSafeInteger(totalCents) ? { ok: true, cents: totalCents } : { ok: false };
}

function formatCents(cents: number) {
  const sign = cents < 0 ? "-" : "";
  const absoluteCents = Math.abs(cents);
  const yuan = Math.floor(absoluteCents / 100);
  const centPart = String(absoluteCents % 100).padStart(2, "0");

  return `${sign}${yuan}.${centPart}`;
}

function addWarning(warnings: string[], warning: string) {
  if (!warnings.includes(warning)) {
    warnings.push(warning);
  }
}

function assertCase(name: string, passed: string[], check: () => boolean) {
  if (!check()) {
    throw new Error(`Settlement calculation example failed: ${name}`);
  }

  passed.push(name);
}
