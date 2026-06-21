import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardCategory, DashboardHouseholdMember } from "@/types/dashboard";
import {
  formatMoney,
  type LedgerRecordEntryType,
  type LedgerRecordSplitMode
} from "@/lib/ledger/list-records";

export type RecordDetailSplit = {
  userId: string;
  userLabel: string;
  shareAmount: number;
  shareAmountLabel: string;
};

export type RecordDetail = {
  id: string;
  householdId: string;
  amount: number;
  amountLabel: string;
  entryType: LedgerRecordEntryType;
  entryTypeLabel: string;
  categoryId: string | null;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  paidBy: string;
  paidByLabel: string;
  splitMode: LedgerRecordSplitMode;
  splitModeLabel: string;
  occurredOn: string;
  note: string | null;
  createdBy: string;
  createdByLabel: string;
  createdAt: string;
  splits: RecordDetailSplit[];
};

export type RecordDetailResult =
  | {
      status: "found";
      record: RecordDetail;
      warning: string | null;
    }
  | {
      status: "not_found";
      record: null;
      warning: null;
    }
  | {
      status: "error";
      record: null;
      warning: string;
    };

type RecordDetailInput = {
  recordId: string;
  householdId: string;
  currentUserId: string;
  categories: DashboardCategory[];
  members: DashboardHouseholdMember[];
};

type LedgerEntryRow = {
  id: string;
  household_id: string;
  amount: number | string;
  entry_type: LedgerRecordEntryType;
  category_id: string | null;
  paid_by: string;
  split_mode: LedgerRecordSplitMode;
  occurred_on: string;
  note: string | null;
  created_by: string;
  created_at: string;
};

type LedgerEntrySplitRow = {
  user_id: string;
  share_amount: number | string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
};

const detailReadWarning = "账单详情读取暂时不完整，请稍后再试。";
const partialDetailWarning = "账单分摊或成员资料读取不完整，正在显示已确认的账单信息。";
const uncategorizedName = "未分类";

export async function getRecordDetail(
  supabase: SupabaseClient,
  { recordId, householdId, currentUserId, categories, members }: RecordDetailInput
): Promise<RecordDetailResult> {
  if (!isUuid(recordId)) {
    return {
      status: "not_found",
      record: null,
      warning: null
    };
  }

  const { data: entryData, error: entryError } = await supabase
    .from("ledger_entries")
    .select(
      "id, household_id, amount, entry_type, category_id, paid_by, split_mode, occurred_on, note, created_by, created_at"
    )
    .eq("id", recordId)
    .eq("household_id", householdId)
    .maybeSingle();

  if (entryError) {
    return {
      status: "error",
      record: null,
      warning: detailReadWarning
    };
  }

  if (!entryData) {
    return {
      status: "not_found",
      record: null,
      warning: null
    };
  }

  const entry = entryData as LedgerEntryRow;
  const { data: splitData, error: splitError } = await supabase
    .from("ledger_entry_splits")
    .select("user_id, share_amount")
    .eq("entry_id", entry.id)
    .order("user_id", { ascending: true });
  const splits = (splitData ?? []) as LedgerEntrySplitRow[];
  const profileIds = getProfileIds(entry, splits);
  const { data: profileData, error: profileError } = profileIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", profileIds)
    : { data: [], error: null };
  const profiles = (profileData ?? []) as ProfileRow[];
  const labelMap = createPersonLabelMap({
    members,
    profiles,
    currentUserId
  });
  const category = entry.category_id
    ? categories.find((candidate) => candidate.id === entry.category_id)
    : null;

  return {
    status: "found",
    record: {
      id: entry.id,
      householdId: entry.household_id,
      amount: toAmount(entry.amount),
      amountLabel: formatSignedAmount(entry.entry_type, toAmount(entry.amount)),
      entryType: entry.entry_type,
      entryTypeLabel: getEntryTypeLabel(entry.entry_type),
      categoryId: entry.category_id,
      categoryName: category?.name ?? uncategorizedName,
      categoryIcon: category?.icon ?? null,
      categoryColor: category?.color ?? null,
      paidBy: entry.paid_by,
      paidByLabel: getPersonLabel(entry.paid_by, labelMap, currentUserId),
      splitMode: entry.split_mode,
      splitModeLabel: getRecordSplitModeLabel(entry.split_mode),
      occurredOn: entry.occurred_on,
      note: entry.note,
      createdBy: entry.created_by,
      createdByLabel: getPersonLabel(entry.created_by, labelMap, currentUserId),
      createdAt: entry.created_at,
      splits: splits.map((split) => {
        const shareAmount = toAmount(split.share_amount);

        return {
          userId: split.user_id,
          userLabel: getPersonLabel(split.user_id, labelMap, currentUserId),
          shareAmount,
          shareAmountLabel: formatMoney(shareAmount)
        };
      })
    },
    warning: splitError || profileError ? partialDetailWarning : null
  };
}

function getProfileIds(entry: LedgerEntryRow, splits: LedgerEntrySplitRow[]) {
  return Array.from(
    new Set([entry.paid_by, entry.created_by, ...splits.map((split) => split.user_id)])
  ).filter(Boolean);
}

function createPersonLabelMap({
  members,
  profiles,
  currentUserId
}: {
  members: DashboardHouseholdMember[];
  profiles: ProfileRow[];
  currentUserId: string;
}) {
  const memberLabels = new Map(
    members.map((member, index) => [member.userId, formatMemberLabel(member, index)])
  );

  profiles.forEach((profile) => {
    if (profile.display_name?.trim()) {
      memberLabels.set(
        profile.id,
        profile.id === currentUserId ? `${profile.display_name.trim()}（你）` : profile.display_name.trim()
      );
    }
  });

  return memberLabels;
}

function getPersonLabel(userId: string, labelMap: Map<string, string>, currentUserId: string) {
  return labelMap.get(userId) ?? (userId === currentUserId ? "你" : "小岛成员");
}

function formatMemberLabel(member: DashboardHouseholdMember, index: number) {
  const role = member.role === "owner" ? "岛主" : "伙伴";
  const name = member.isCurrentUser ? "你" : `成员 ${index + 1}`;

  return `${role} · ${name}`;
}

function getEntryTypeLabel(entryType: LedgerRecordEntryType) {
  return entryType === "income" ? "收入" : "支出";
}

function getRecordSplitModeLabel(splitMode: LedgerRecordSplitMode) {
  if (splitMode === "personal") {
    return "个人承担";
  }

  if (splitMode === "custom") {
    return "自定义分摊";
  }

  return "两人平分";
}

function formatSignedAmount(entryType: LedgerRecordEntryType, amount: number) {
  const prefix = entryType === "income" ? "+" : "-";

  return `${prefix}${formatMoney(amount)}`;
}

function toAmount(value: number | string) {
  const amount = Number(value);

  return Number.isFinite(amount) ? amount : 0;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}
