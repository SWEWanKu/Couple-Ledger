import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardCategory, DashboardHouseholdMember } from "@/types/dashboard";
import { getRecordsMonthRange, type LedgerRecordEntryType, type RecordsMonthRange } from "@/lib/ledger/list-records";

export type MonthlyLedgerCategoryBreakdownItem = {
  categoryId: string | null;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  expenseTotal: number;
  incomeTotal: number;
  totalAmount: number;
  expenseCount: number;
  incomeCount: number;
  recordCount: number;
};

export type MonthlyLedgerPayerBreakdownItem = {
  userId: string;
  userLabel: string;
  expenseTotal: number;
  incomeTotal: number;
  totalHandled: number;
  expenseCount: number;
  incomeCount: number;
  recordCount: number;
};

export type MonthlyLedgerMood = {
  title: string;
  body: string;
};

export type MonthlyLedgerSummary = {
  range: RecordsMonthRange;
  expenseTotal: number;
  incomeTotal: number;
  netAmount: number;
  expenseCount: number;
  incomeCount: number;
  entryCount: number;
  categoryBreakdown: MonthlyLedgerCategoryBreakdownItem[];
  payerBreakdown: MonthlyLedgerPayerBreakdownItem[];
  mood: MonthlyLedgerMood;
};

export type MonthlyLedgerSummaryResult =
  | {
      status: "ok" | "empty";
      summary: MonthlyLedgerSummary;
      warning: null;
    }
  | {
      status: "error";
      summary: MonthlyLedgerSummary;
      warning: string;
    };

type MonthlyLedgerSummaryInput = {
  householdId: string;
  currentUserId: string;
  categories: DashboardCategory[];
  members: DashboardHouseholdMember[];
  month?: string | null;
  now?: Date;
};

type LedgerEntryRow = {
  id: string;
  amount: number | string;
  entry_type: LedgerRecordEntryType;
  category_id: string | null;
  paid_by: string;
  occurred_on: string;
  created_at: string;
};

const summaryReadWarning = "本月账本小结暂时读不完整，正在显示安全的空账本便签。";
const uncategorizedName = "未分类";

export async function getMonthlyLedgerSummary(
  supabase: SupabaseClient,
  {
    householdId,
    currentUserId,
    categories,
    members,
    month,
    now = new Date()
  }: MonthlyLedgerSummaryInput
): Promise<MonthlyLedgerSummaryResult> {
  const range = getRecordsMonthRange(month, now);
  const { data, error } = await supabase
    .from("ledger_entries")
    .select("id, amount, entry_type, category_id, paid_by, occurred_on, created_at")
    .eq("household_id", householdId)
    .is("voided_at", null)
    .gte("occurred_on", range.monthStart)
    .lt("occurred_on", range.nextMonthStart)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return {
      status: "error",
      summary: createEmptyMonthlySummary(range),
      warning: summaryReadWarning
    };
  }

  const rows = (data ?? []) as LedgerEntryRow[];
  const summary = summarizeMonthlyLedgerRows(rows, {
    categories,
    members,
    currentUserId,
    range
  });

  return {
    status: summary.entryCount > 0 ? "ok" : "empty",
    summary,
    warning: null
  };
}

function summarizeMonthlyLedgerRows(
  rows: LedgerEntryRow[],
  {
    categories,
    members,
    currentUserId,
    range
  }: {
    categories: DashboardCategory[];
    members: DashboardHouseholdMember[];
    currentUserId: string;
    range: RecordsMonthRange;
  }
): MonthlyLedgerSummary {
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const memberLabelMap = createMemberLabelMap(members, currentUserId);
  const categoryTotals = new Map<string, MonthlyLedgerCategoryBreakdownItem>();
  const payerTotals = new Map<string, MonthlyLedgerPayerBreakdownItem>();
  let expenseTotal = 0;
  let incomeTotal = 0;
  let expenseCount = 0;
  let incomeCount = 0;

  rows.forEach((row) => {
    const amount = toAmount(row.amount);
    const isIncome = row.entry_type === "income";

    if (isIncome) {
      incomeTotal += amount;
      incomeCount += 1;
    } else {
      expenseTotal += amount;
      expenseCount += 1;
    }

    addCategoryTotal(categoryTotals, categoryMap, row, amount);
    addPayerTotal(payerTotals, memberLabelMap, row, amount);
  });

  const entryCount = rows.length;
  const netAmount = incomeTotal - expenseTotal;
  const categoryBreakdown = Array.from(categoryTotals.values()).sort(sortBreakdownItems);
  const payerBreakdown = Array.from(payerTotals.values()).sort(sortPayerItems);

  return {
    range,
    expenseTotal,
    incomeTotal,
    netAmount,
    expenseCount,
    incomeCount,
    entryCount,
    categoryBreakdown,
    payerBreakdown,
    mood: createMonthlyMood({
      entryCount,
      expenseCount,
      incomeCount,
      expenseTotal,
      incomeTotal,
      netAmount
    })
  };
}

function addCategoryTotal(
  categoryTotals: Map<string, MonthlyLedgerCategoryBreakdownItem>,
  categoryMap: Map<string, DashboardCategory>,
  row: LedgerEntryRow,
  amount: number
) {
  const category = row.category_id ? categoryMap.get(row.category_id) : null;
  const key = row.category_id ?? "uncategorized";
  const current = categoryTotals.get(key) ?? {
    categoryId: row.category_id,
    categoryName: category?.name ?? uncategorizedName,
    categoryIcon: category?.icon ?? null,
    categoryColor: category?.color ?? null,
    expenseTotal: 0,
    incomeTotal: 0,
    totalAmount: 0,
    expenseCount: 0,
    incomeCount: 0,
    recordCount: 0
  };

  if (row.entry_type === "income") {
    current.incomeTotal += amount;
    current.incomeCount += 1;
  } else {
    current.expenseTotal += amount;
    current.expenseCount += 1;
  }

  current.totalAmount += amount;
  current.recordCount += 1;
  categoryTotals.set(key, current);
}

function addPayerTotal(
  payerTotals: Map<string, MonthlyLedgerPayerBreakdownItem>,
  memberLabelMap: Map<string, string>,
  row: LedgerEntryRow,
  amount: number
) {
  const current = payerTotals.get(row.paid_by) ?? {
    userId: row.paid_by,
    userLabel: memberLabelMap.get(row.paid_by) ?? "小岛成员",
    expenseTotal: 0,
    incomeTotal: 0,
    totalHandled: 0,
    expenseCount: 0,
    incomeCount: 0,
    recordCount: 0
  };

  if (row.entry_type === "income") {
    current.incomeTotal += amount;
    current.incomeCount += 1;
  } else {
    current.expenseTotal += amount;
    current.expenseCount += 1;
  }

  current.totalHandled += amount;
  current.recordCount += 1;
  payerTotals.set(row.paid_by, current);
}

function createEmptyMonthlySummary(range: RecordsMonthRange): MonthlyLedgerSummary {
  return {
    range,
    expenseTotal: 0,
    incomeTotal: 0,
    netAmount: 0,
    expenseCount: 0,
    incomeCount: 0,
    entryCount: 0,
    categoryBreakdown: [],
    payerBreakdown: [],
    mood: createMonthlyMood({
      entryCount: 0,
      expenseCount: 0,
      incomeCount: 0,
      expenseTotal: 0,
      incomeTotal: 0,
      netAmount: 0
    })
  };
}

function createMemberLabelMap(members: DashboardHouseholdMember[], currentUserId: string) {
  return new Map(
    members.map((member, index) => {
      const role = member.role === "owner" ? "岛主" : "伙伴";
      const name = member.userId === currentUserId || member.isCurrentUser ? "你" : `成员 ${index + 1}`;

      return [member.userId, `${role} · ${name}`];
    })
  );
}

function createMonthlyMood({
  entryCount,
  expenseCount,
  incomeCount,
  expenseTotal,
  incomeTotal,
  netAmount
}: {
  entryCount: number;
  expenseCount: number;
  incomeCount: number;
  expenseTotal: number;
  incomeTotal: number;
  netAmount: number;
}): MonthlyLedgerMood {
  if (entryCount === 0) {
    return {
      title: "这个月的小岛还很安静",
      body: "还没有真实流水贴上来，等第一张小票出现后这里会自动长出月度小结。"
    };
  }

  if (expenseCount > 0 && incomeCount === 0) {
    return {
      title: "这个月主要是生活小票",
      body: `已经记录 ${expenseCount} 笔支出，合计 ${formatAmountText(expenseTotal)}，收入还没有贴进本月账本。`
    };
  }

  if (incomeCount > 0 && expenseCount === 0) {
    return {
      title: "这个月先收到一些回流",
      body: `已经记录 ${incomeCount} 笔收入，合计 ${formatAmountText(incomeTotal)}，支出小票还没有出现。`
    };
  }

  if (netAmount >= 0) {
    return {
      title: "这个月的小岛现金流偏轻松",
      body: `收入减支出为 ${formatSignedAmountText(netAmount)}，这里只按真实流水做只读小结。`
    };
  }

  return {
    title: "这个月的小岛花费更热闹",
    body: `收入减支出为 ${formatSignedAmountText(netAmount)}，结算分摊仍以结算页为准。`
  };
}

function sortBreakdownItems(
  left: MonthlyLedgerCategoryBreakdownItem,
  right: MonthlyLedgerCategoryBreakdownItem
) {
  if (right.totalAmount !== left.totalAmount) {
    return right.totalAmount - left.totalAmount;
  }

  return left.categoryName.localeCompare(right.categoryName);
}

function sortPayerItems(left: MonthlyLedgerPayerBreakdownItem, right: MonthlyLedgerPayerBreakdownItem) {
  if (right.totalHandled !== left.totalHandled) {
    return right.totalHandled - left.totalHandled;
  }

  return left.userLabel.localeCompare(right.userLabel);
}

function toAmount(value: number | string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function formatAmountText(amount: number) {
  return `¥${amount.toFixed(2)}`;
}

function formatSignedAmountText(amount: number) {
  if (amount === 0) {
    return formatAmountText(0);
  }

  return `${amount > 0 ? "+" : "-"}${formatAmountText(Math.abs(amount))}`;
}
