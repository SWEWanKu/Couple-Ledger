import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateSettlement } from "@/lib/settlement/calculate-settlement";
import type {
  SettlementCalculationResult,
  SettlementEntryInput,
  SettlementMonthMetadata,
  SettlementSplitInput,
  SettlementSummary,
  SettlementSummaryMember,
  SettlementSummaryResult
} from "@/types/settlement";

type SettlementSummaryInput = {
  householdId: string;
  currentUserId?: string | null;
  month?: string | null;
  now?: Date;
};

type HouseholdMemberRow = {
  user_id: string;
  role: string;
  joined_at: string | null;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
};

type LedgerEntryRow = {
  id: string;
  amount: number | string;
  entry_type: "expense";
  paid_by: string;
  occurred_on: string;
  created_at: string;
};

type LedgerEntrySplitRow = {
  entry_id: string;
  user_id: string;
  share_amount: number | string;
};

const settlementReadWarning =
  "\u7ed3\u7b97\u6570\u636e\u8bfb\u53d6\u6682\u65f6\u4e0d\u5b8c\u6574\uff0c\u6b63\u5728\u663e\u793a\u5b89\u5168\u7684\u7a7a\u7ed3\u7b97\u72b6\u6001\u3002";
const settlementPartialReadWarning =
  "\u7ed3\u7b97\u6570\u636e\u8bfb\u53d6\u6682\u65f6\u4e0d\u5b8c\u6574\uff0c\u5df2\u6309\u5df2\u8bfb\u53d6\u7684\u8bb0\u5f55\u8ba1\u7b97\u3002";
const currentUserLabel = "\u4f60";
const ownerRoleLabel = "\u5c9b\u4e3b";
const partnerRoleLabel = "\u4f19\u4f34";
const islandMemberLabel = "\u5c0f\u5c9b\u6210\u5458";

export async function getSettlementSummary(
  supabase: SupabaseClient,
  { householdId, currentUserId = null, month, now = new Date() }: SettlementSummaryInput
): Promise<SettlementSummaryResult> {
  const monthMetadata = getSettlementMonthRange(month, now);
  const { data: memberData, error: memberError } = await supabase
    .from("household_members")
    .select("user_id, role, joined_at")
    .eq("household_id", householdId)
    .order("joined_at", { ascending: true });

  if (memberError) {
    return createSettlementSummaryResult({
      month: monthMetadata,
      members: [],
      entries: [],
      splits: [],
      warning: settlementReadWarning
    });
  }

  const memberRows = (memberData ?? []) as HouseholdMemberRow[];
  const [profileResult, entryResult] = await Promise.all([
    memberRows.length
      ? supabase.from("profiles").select("id, display_name").in("id", getMemberIds(memberRows))
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("ledger_entries")
      .select("id, amount, entry_type, paid_by, occurred_on, created_at")
      .eq("household_id", householdId)
      .eq("entry_type", "expense")
      .is("voided_at", null)
      .gte("occurred_on", monthMetadata.monthStart)
      .lt("occurred_on", monthMetadata.nextMonthStart)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
  ]);
  const { data: profileData, error: profileError } = profileResult;
  const { data: entryData, error: entryError } = entryResult;
  const members = mapSettlementMembers({
    memberRows,
    profiles: (profileData ?? []) as ProfileRow[],
    currentUserId
  });

  if (entryError) {
    return createSettlementSummaryResult({
      month: monthMetadata,
      members,
      entries: [],
      splits: [],
      warning: settlementReadWarning
    });
  }

  const entries = (entryData ?? []) as LedgerEntryRow[];

  if (entries.length === 0) {
    return createSettlementSummaryResult({
      month: monthMetadata,
      members,
      entries,
      splits: [],
      warning: profileError ? settlementPartialReadWarning : null
    });
  }

  const { data: splitData, error: splitError } = await supabase
    .from("ledger_entry_splits")
    .select("entry_id, user_id, share_amount")
    .in("entry_id", entries.map((entry) => entry.id))
    .order("entry_id", { ascending: true })
    .order("user_id", { ascending: true });

  return createSettlementSummaryResult({
    month: monthMetadata,
    members,
    entries,
    splits: (splitData ?? []) as LedgerEntrySplitRow[],
    warning: profileError || splitError ? settlementPartialReadWarning : null
  });
}

export function getSettlementMonthRange(
  month: string | null | undefined,
  now: Date = new Date()
): SettlementMonthMetadata {
  const monthKey = normalizeSettlementMonth(month) ?? formatMonthKey(now);
  const [year, monthNumber] = monthKey.split("-").map(Number);
  const monthStart = createLocalMonthDate(year, monthNumber - 1);
  const nextMonthStart = createLocalMonthDate(year, monthNumber);
  const previousMonthStart = createLocalMonthDate(year, monthNumber - 2);

  return {
    month: monthKey,
    monthLabel: `${year}\u5e74${monthNumber}\u6708`,
    monthStart: formatDateOnly(monthStart),
    nextMonthStart: formatDateOnly(nextMonthStart),
    previousMonth: formatMonthKey(previousMonthStart),
    nextMonth: formatMonthKey(nextMonthStart)
  };
}

export function normalizeSettlementMonth(month: string | null | undefined) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return null;
  }

  const [year, monthNumber] = month.split("-").map(Number);

  if (year < 1 || year > 9999 || monthNumber < 1 || monthNumber > 12) {
    return null;
  }

  return `${String(year).padStart(4, "0")}-${String(monthNumber).padStart(2, "0")}`;
}

function createSettlementSummaryResult({
  month,
  members,
  entries,
  splits,
  warning
}: {
  month: SettlementMonthMetadata;
  members: SettlementSummaryMember[];
  entries: LedgerEntryRow[];
  splits: LedgerEntrySplitRow[];
  warning: string | null;
}): SettlementSummaryResult {
  const calculation = calculateSettlement({
    members: members.map(({ userId, displayName }) => ({ userId, displayName })),
    entries: mapCalculationEntries(entries),
    splits: mapCalculationSplits(splits)
  });

  return {
    summary: createSettlementSummary({
      month,
      members,
      entries,
      calculation
    }),
    warning
  };
}

function createSettlementSummary({
  month,
  members,
  entries,
  calculation
}: {
  month: SettlementMonthMetadata;
  members: SettlementSummaryMember[];
  entries: LedgerEntryRow[];
  calculation: SettlementCalculationResult;
}): SettlementSummary {
  return {
    month,
    members,
    includedExpenseCount: entries.length,
    totalExpense: calculation.totalExpense,
    calculation
  };
}

function mapSettlementMembers({
  memberRows,
  profiles,
  currentUserId
}: {
  memberRows: HouseholdMemberRow[];
  profiles: ProfileRow[];
  currentUserId: string | null;
}): SettlementSummaryMember[] {
  const profileMap = new Map(
    profiles
      .filter((profile) => profile.display_name?.trim())
      .map((profile) => [profile.id, profile.display_name?.trim() ?? ""])
  );

  return memberRows.map((member, index) => ({
    userId: member.user_id,
    displayName: profileMap.get(member.user_id) ?? getMemberFallbackLabel(member, index, currentUserId),
    role: member.role,
    joinedAt: member.joined_at,
    isCurrentUser: member.user_id === currentUserId
  }));
}

function mapCalculationEntries(entries: LedgerEntryRow[]): SettlementEntryInput[] {
  return entries.map((entry) => ({
    id: entry.id,
    amount: entry.amount,
    entryType: entry.entry_type,
    paidBy: entry.paid_by
  }));
}

function mapCalculationSplits(splits: LedgerEntrySplitRow[]): SettlementSplitInput[] {
  return splits.map((split) => ({
    entryId: split.entry_id,
    userId: split.user_id,
    shareAmount: split.share_amount
  }));
}

function getMemberIds(members: HouseholdMemberRow[]) {
  return members.map((member) => member.user_id).filter(Boolean);
}

function getMemberFallbackLabel(member: HouseholdMemberRow, index: number, currentUserId: string | null) {
  if (member.user_id === currentUserId) {
    return currentUserLabel;
  }

  const role =
    member.role === "owner"
      ? ownerRoleLabel
      : member.role === "partner"
        ? partnerRoleLabel
        : islandMemberLabel;

  return `${role} \u00b7 ${islandMemberLabel} ${index + 1}`;
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
