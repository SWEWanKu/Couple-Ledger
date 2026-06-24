import type { SupabaseClient } from "@supabase/supabase-js";
import { formatMoney, type LedgerRecordEntryType } from "@/lib/ledger/list-records";
import { getRecordDetailHref } from "@/lib/ledger/records-query";
import type { DashboardCategory, DashboardHouseholdMember } from "@/types/dashboard";

export type DashboardRecentActivityRecord = {
  id: string;
  entryType: LedgerRecordEntryType;
  typeLabel: string;
  amount: number;
  amountLabel: string;
  note: string | null;
  categoryId: string | null;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  paidBy: string;
  paidByLabel: string;
  occurredOn: string;
  createdAt: string;
  detailHref: string;
};

export type DashboardRecentActivityResult = {
  records: DashboardRecentActivityRecord[];
  warning: string | null;
};

type RecentActivityInput = {
  householdId: string;
  currentUserId: string;
  categories: DashboardCategory[];
  members: DashboardHouseholdMember[];
  limit?: number;
};

type LedgerEntryRow = {
  id: string;
  amount: number | string;
  entry_type: LedgerRecordEntryType;
  category_id: string | null;
  paid_by: string;
  occurred_on: string;
  note: string | null;
  created_at: string;
};

const recentActivityWarning = "最近流水便签暂时读不到，先保留其它小岛月记。";
const uncategorizedName = "未分类";

export async function getDashboardRecentActivity(
  supabase: SupabaseClient,
  { householdId, currentUserId, categories, members, limit = 6 }: RecentActivityInput
): Promise<DashboardRecentActivityResult> {
  const safeLimit = clampRecentLimit(limit);
  const { data, error } = await supabase
    .from("ledger_entries")
    .select("id, amount, entry_type, category_id, paid_by, occurred_on, note, created_at")
    .eq("household_id", householdId)
    .is("voided_at", null)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    return {
      records: [],
      warning: recentActivityWarning
    };
  }

  return {
    records: mapRecentActivityRows((data ?? []) as LedgerEntryRow[], {
      categories,
      currentUserId,
      members
    }),
    warning: null
  };
}

function mapRecentActivityRows(
  rows: LedgerEntryRow[],
  {
    categories,
    currentUserId,
    members
  }: {
    categories: DashboardCategory[];
    currentUserId: string;
    members: DashboardHouseholdMember[];
  }
) {
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const memberMap = new Map(members.map((member, index) => [member.userId, formatMemberLabel(member, index)]));

  return rows.map<DashboardRecentActivityRecord>((row) => {
    const category = row.category_id ? categoryMap.get(row.category_id) : null;
    const amount = toAmount(row.amount);
    const month = getMonthFromDateOnly(row.occurred_on);

    return {
      id: row.id,
      entryType: row.entry_type,
      typeLabel: getEntryTypeLabel(row.entry_type),
      amount,
      amountLabel: formatSignedRecordAmount(row.entry_type, amount),
      note: row.note,
      categoryId: row.category_id,
      categoryName: category?.name ?? uncategorizedName,
      categoryIcon: category?.icon ?? null,
      categoryColor: category?.color ?? null,
      paidBy: row.paid_by,
      paidByLabel: memberMap.get(row.paid_by) ?? (row.paid_by === currentUserId ? "你" : "小岛成员"),
      occurredOn: row.occurred_on,
      createdAt: row.created_at,
      detailHref: getRecordDetailHref(row.id, month, {})
    };
  });
}

function clampRecentLimit(limit: number) {
  if (!Number.isFinite(limit)) {
    return 6;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), 8);
}

function formatMemberLabel(member: DashboardHouseholdMember, index: number) {
  const role = member.role === "owner" ? "岛主" : "伙伴";
  const name = member.isCurrentUser ? "你" : `成员 ${index + 1}`;

  return `${role} · ${name}`;
}

function getEntryTypeLabel(entryType: LedgerRecordEntryType) {
  return entryType === "income" ? "收入" : "支出";
}

function formatSignedRecordAmount(entryType: LedgerRecordEntryType, amount: number) {
  const prefix = entryType === "income" ? "+" : "-";

  return `${prefix}${formatMoney(Math.abs(amount))}`;
}

function getMonthFromDateOnly(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(0, 7) : "";
}

function toAmount(value: number | string): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}
