import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardCategory, DashboardHouseholdMember } from "@/types/dashboard";

export type LedgerRecordEntryType = "expense" | "income";
export type LedgerRecordSplitMode = "equal" | "custom" | "personal";

export type LedgerRecord = {
  id: string;
  entryType: LedgerRecordEntryType;
  amount: number;
  note: string | null;
  categoryId: string | null;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  paidBy: string;
  paidByLabel: string;
  splitMode: LedgerRecordSplitMode;
  splitModeLabel: string;
  occurredOn: string;
  createdAt: string;
};

export type LedgerRecordTypeFilter = "all" | LedgerRecordEntryType;

export type LedgerRecordFilters = {
  type?: LedgerRecordTypeFilter;
  categoryId?: string | null;
  paidBy?: string | null;
  keyword?: string | null;
};

export type RecordsMonthRange = {
  month: string;
  monthLabel: string;
  monthStart: string;
  nextMonthStart: string;
  previousMonth: string;
  nextMonth: string;
};

export type LedgerRecordsResult = {
  records: LedgerRecord[];
  range: RecordsMonthRange;
  totalRecordCount: number;
  filteredRecordCount: number;
  warning: string | null;
};

type LedgerRecordsInput = {
  householdId: string;
  currentUserId: string;
  categories: DashboardCategory[];
  members: DashboardHouseholdMember[];
  month?: string | null;
  filters?: LedgerRecordFilters;
  limit?: number;
  now?: Date;
};

type LedgerEntryRow = {
  id: string;
  amount: number | string;
  entry_type: LedgerRecordEntryType;
  category_id: string | null;
  paid_by: string;
  split_mode: LedgerRecordSplitMode;
  occurred_on: string;
  note: string | null;
  created_at: string;
};

const recordsWarning = "本月流水读取暂时不完整，正在显示安全的空账本状态。";
const uncategorizedName = "未分类";

export async function getLedgerRecords(
  supabase: SupabaseClient,
  {
    householdId,
    currentUserId,
    categories,
    members,
    month,
    filters,
    limit,
    now = new Date()
  }: LedgerRecordsInput
): Promise<LedgerRecordsResult> {
  const range = getRecordsMonthRange(month, now);
  let query = supabase
    .from("ledger_entries")
    .select("id, amount, entry_type, category_id, paid_by, split_mode, occurred_on, note, created_at")
    .eq("household_id", householdId)
    .is("voided_at", null)
    .gte("occurred_on", range.monthStart)
    .lt("occurred_on", range.nextMonthStart)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (limit) {
    query = query.limit(clampRecordLimit(limit));
  }

  const { data, error } = await query;

  if (error) {
    return {
      records: [],
      range,
      totalRecordCount: 0,
      filteredRecordCount: 0,
      warning: recordsWarning
    };
  }

  const allRecords = mapLedgerRecordRows((data ?? []) as LedgerEntryRow[], {
    categories,
    members,
    currentUserId
  });
  const filteredRecords = filterLedgerRecords(allRecords, filters);

  return {
    records: filteredRecords.slice(0, 50),
    range,
    totalRecordCount: allRecords.length,
    filteredRecordCount: filteredRecords.length,
    warning: null
  };
}

function clampRecordLimit(limit: number) {
  if (!Number.isFinite(limit)) {
    return 50;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), 50);
}

export function getCurrentMonthRange(now: Date = new Date()): RecordsMonthRange {
  return getRecordsMonthRange(null, now);
}

export function getRecordsMonthRange(
  month: string | null | undefined,
  now: Date = new Date()
): RecordsMonthRange {
  const monthKey = normalizeRecordsMonth(month) ?? formatMonthKey(now);
  const [year, monthNumber] = monthKey.split("-").map(Number);
  const monthStart = createLocalMonthDate(year, monthNumber - 1);
  const nextMonthStart = createLocalMonthDate(year, monthNumber);
  const previousMonthStart = createLocalMonthDate(year, monthNumber - 2);

  return {
    month: monthKey,
    monthLabel: `${year}年${monthNumber}月`,
    monthStart: formatDateOnly(monthStart),
    nextMonthStart: formatDateOnly(nextMonthStart),
    previousMonth: formatMonthKey(previousMonthStart),
    nextMonth: formatMonthKey(nextMonthStart)
  };
}

export function normalizeRecordsMonth(month: string | null | undefined) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return null;
  }

  const [year, monthNumber] = month.split("-").map(Number);

  if (year < 1 || year > 9999 || monthNumber < 1 || monthNumber > 12) {
    return null;
  }

  return `${String(year).padStart(4, "0")}-${String(monthNumber).padStart(2, "0")}`;
}

export function getSplitModeLabel(splitMode: LedgerRecordSplitMode) {
  if (splitMode === "personal") {
    return "个人承担";
  }

  if (splitMode === "custom") {
    return "自定义分摊";
  }

  return "两人平分";
}

export function formatMoney(amount: number) {
  return `¥${amount.toFixed(2)}`;
}

function mapLedgerRecordRows(
  rows: LedgerEntryRow[],
  {
    categories,
    members,
    currentUserId
  }: {
    categories: DashboardCategory[];
    members: DashboardHouseholdMember[];
    currentUserId: string;
  }
): LedgerRecord[] {
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const memberMap = new Map(members.map((member, index) => [member.userId, formatMemberLabel(member, index)]));

  return rows.map((row) => {
    const category = row.category_id ? categoryMap.get(row.category_id) : null;

    return {
      id: row.id,
      entryType: row.entry_type,
      amount: toAmount(row.amount),
      note: row.note,
      categoryId: row.category_id,
      categoryName: category?.name ?? uncategorizedName,
      categoryIcon: category?.icon ?? null,
      categoryColor: category?.color ?? null,
      paidBy: row.paid_by,
      paidByLabel: memberMap.get(row.paid_by) ?? (row.paid_by === currentUserId ? "你" : "小岛成员"),
      splitMode: row.split_mode,
      splitModeLabel: getSplitModeLabel(row.split_mode),
      occurredOn: row.occurred_on,
      createdAt: row.created_at
    };
  });
}

function filterLedgerRecords(records: LedgerRecord[], filters: LedgerRecordFilters | undefined) {
  if (!filters) {
    return records;
  }

  const keyword = normalizeSearchText(filters.keyword);

  return records.filter((record) => {
    if (filters.type && filters.type !== "all" && record.entryType !== filters.type) {
      return false;
    }

    if (filters.categoryId && record.categoryId !== filters.categoryId) {
      return false;
    }

    if (filters.paidBy && record.paidBy !== filters.paidBy) {
      return false;
    }

    if (keyword && !recordMatchesKeyword(record, keyword)) {
      return false;
    }

    return true;
  });
}

function recordMatchesKeyword(record: LedgerRecord, keyword: string) {
  const fields = [
    record.note,
    record.categoryName,
    record.paidByLabel,
    record.splitModeLabel,
    getEntryTypeLabel(record.entryType)
  ];

  return fields.some((field) => normalizeSearchText(field).includes(keyword));
}

function normalizeSearchText(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase("zh-CN") ?? "";
}

function formatMemberLabel(member: DashboardHouseholdMember, index: number) {
  const role = member.role === "owner" ? "岛主" : "伙伴";
  const name = member.isCurrentUser ? "你" : `成员 ${index + 1}`;

  return `${role} · ${name}`;
}

function getEntryTypeLabel(entryType: LedgerRecordEntryType) {
  return entryType === "income" ? "收入" : "支出";
}

function toAmount(value: number | string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function formatDateOnly(date: Date) {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatMonthKey(date: Date) {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function createLocalMonthDate(year: number, monthIndex: number) {
  const date = new Date(0, 0, 1);
  date.setFullYear(year, monthIndex, 1);
  date.setHours(0, 0, 0, 0);

  return date;
}
