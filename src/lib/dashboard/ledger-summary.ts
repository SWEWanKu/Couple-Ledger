import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DashboardCategory,
  DashboardCategoryBreakdownItem,
  DashboardLedgerEntryType,
  DashboardLedgerSummary,
  DashboardLedgerSummaryResult,
  DashboardRecentRecord
} from "@/types/dashboard";

type LedgerEntryRow = {
  id: string;
  amount: number | string;
  entry_type: DashboardLedgerEntryType;
  category_id: string | null;
  paid_by: string;
  occurred_on: string;
  note: string | null;
  created_at: string;
};

type LedgerSummaryInput = {
  householdId: string;
  categories: DashboardCategory[];
  now?: Date;
};

type MonthRange = {
  monthStart: string;
  nextMonthStart: string;
};

const ledgerSummaryWarning = "本月流水读取暂时不完整，正在显示安全的空账本状态。";
const uncategorizedName = "未分类";

export async function getDashboardLedgerSummary(
  supabase: SupabaseClient,
  { householdId, categories, now = new Date() }: LedgerSummaryInput
): Promise<DashboardLedgerSummaryResult> {
  const range = getCurrentMonthRange(now);
  const { data, error } = await supabase
    .from("ledger_entries")
    .select("id, amount, entry_type, category_id, paid_by, occurred_on, note, created_at")
    .eq("household_id", householdId)
    .gte("occurred_on", range.monthStart)
    .lt("occurred_on", range.nextMonthStart)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return {
      summary: createEmptyLedgerSummary(range),
      warning: ledgerSummaryWarning
    };
  }

  return {
    summary: summarizeLedgerRows((data ?? []) as LedgerEntryRow[], categories, range),
    warning: null
  };
}

function getCurrentMonthRange(now: Date): MonthRange {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return {
    monthStart: formatDateOnly(monthStart),
    nextMonthStart: formatDateOnly(nextMonthStart)
  };
}

function summarizeLedgerRows(
  entries: LedgerEntryRow[],
  categories: DashboardCategory[],
  range: MonthRange
): DashboardLedgerSummary {
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const categoryTotals = new Map<string, DashboardCategoryBreakdownItem>();
  let expenseTotal = 0;
  let incomeTotal = 0;

  const recentRecords = entries.slice(0, 5).map<DashboardRecentRecord>((entry) => {
    const category = entry.category_id ? categoryMap.get(entry.category_id) : null;
    const amount = toAmount(entry.amount);

    return {
      id: entry.id,
      entryType: entry.entry_type,
      amount,
      note: entry.note,
      categoryId: entry.category_id,
      categoryName: category?.name ?? uncategorizedName,
      categoryIcon: category?.icon ?? null,
      categoryColor: category?.color ?? null,
      paidBy: entry.paid_by,
      occurredOn: entry.occurred_on
    };
  });

  entries.forEach((entry) => {
    const amount = toAmount(entry.amount);

    if (entry.entry_type === "income") {
      incomeTotal += amount;
      return;
    }

    expenseTotal += amount;

    const category = entry.category_id ? categoryMap.get(entry.category_id) : null;
    const key = entry.category_id ?? "uncategorized";
    const current = categoryTotals.get(key) ?? {
      categoryId: entry.category_id,
      categoryName: category?.name ?? uncategorizedName,
      categoryIcon: category?.icon ?? null,
      categoryColor: category?.color ?? null,
      expenseTotal: 0,
      recordCount: 0
    };

    current.expenseTotal += amount;
    current.recordCount += 1;
    categoryTotals.set(key, current);
  });

  return {
    ...range,
    expenseTotal,
    incomeTotal,
    balance: incomeTotal - expenseTotal,
    entryCount: entries.length,
    recentRecords,
    categoryBreakdown: Array.from(categoryTotals.values()).sort((left, right) => {
      if (right.expenseTotal !== left.expenseTotal) {
        return right.expenseTotal - left.expenseTotal;
      }

      return left.categoryName.localeCompare(right.categoryName);
    })
  };
}

function createEmptyLedgerSummary(range: MonthRange): DashboardLedgerSummary {
  return {
    ...range,
    expenseTotal: 0,
    incomeTotal: 0,
    balance: 0,
    entryCount: 0,
    recentRecords: [],
    categoryBreakdown: []
  };
}

function toAmount(value: number | string): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function formatDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
