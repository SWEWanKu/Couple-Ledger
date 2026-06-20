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
