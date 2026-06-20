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

export type RecordsMonthRange = {
  monthStart: string;
  nextMonthStart: string;
};

export type LedgerRecordsResult = {
  records: LedgerRecord[];
  range: RecordsMonthRange;
  warning: string | null;
};

type LedgerRecordsInput = {
  householdId: string;
  currentUserId: string;
  categories: DashboardCategory[];
  members: DashboardHouseholdMember[];
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
  { householdId, currentUserId, categories, members, now = new Date() }: LedgerRecordsInput
): Promise<LedgerRecordsResult> {
  const range = getCurrentMonthRange(now);
  const { data, error } = await supabase
    .from("ledger_entries")
    .select("id, amount, entry_type, category_id, paid_by, split_mode, occurred_on, note, created_at")
    .eq("household_id", householdId)
    .gte("occurred_on", range.monthStart)
    .lt("occurred_on", range.nextMonthStart)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return {
      records: [],
      range,
      warning: recordsWarning
    };
  }

  return {
    records: mapLedgerRecordRows((data ?? []) as LedgerEntryRow[], {
      categories,
      members,
      currentUserId
    }),
    range,
    warning: null
  };
}

export function getCurrentMonthRange(now: Date = new Date()): RecordsMonthRange {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return {
    monthStart: formatDateOnly(monthStart),
    nextMonthStart: formatDateOnly(nextMonthStart)
  };
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

function formatMemberLabel(member: DashboardHouseholdMember, index: number) {
  const role = member.role === "owner" ? "岛主" : "伙伴";
  const name = member.isCurrentUser ? "你" : `成员 ${index + 1}`;

  return `${role} · ${name}`;
}

function toAmount(value: number | string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function formatDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
