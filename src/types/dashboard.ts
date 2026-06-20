export type HouseholdMemberRole = "owner" | "partner";

export type DashboardHouseholdMember = {
  userId: string;
  role: HouseholdMemberRole;
  joinedAt: string | null;
  isCurrentUser: boolean;
};

export type DashboardCategory = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  sortOrder: number;
};

export type DashboardHouseholdSummary = {
  householdId: string;
  householdName: string;
  members: DashboardHouseholdMember[];
  categories: DashboardCategory[];
};

export type DashboardHouseholdSummaryResult = {
  summary: DashboardHouseholdSummary;
  warning: string | null;
};

export type DashboardLedgerEntryType = "expense" | "income";

export type DashboardRecentRecord = {
  id: string;
  entryType: DashboardLedgerEntryType;
  amount: number;
  note: string | null;
  categoryId: string | null;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  paidBy: string;
  occurredOn: string;
};

export type DashboardCategoryBreakdownItem = {
  categoryId: string | null;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  expenseTotal: number;
  recordCount: number;
};

export type DashboardLedgerSummary = {
  monthStart: string;
  nextMonthStart: string;
  expenseTotal: number;
  incomeTotal: number;
  balance: number;
  entryCount: number;
  recentRecords: DashboardRecentRecord[];
  categoryBreakdown: DashboardCategoryBreakdownItem[];
};

export type DashboardLedgerSummaryResult = {
  summary: DashboardLedgerSummary;
  warning: string | null;
};
