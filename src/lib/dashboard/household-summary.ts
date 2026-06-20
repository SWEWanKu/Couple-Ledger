import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DashboardCategory,
  DashboardHouseholdMember,
  DashboardHouseholdSummaryResult,
  HouseholdMemberRole
} from "@/types/dashboard";

type HouseholdRow = {
  id: string;
  name: string;
};

type HouseholdMemberRow = {
  user_id: string;
  role: HouseholdMemberRole;
  joined_at: string | null;
};

type CategoryRow = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  sort_order: number | null;
};

type HouseholdSummaryInput = {
  householdId: string;
  currentUserId: string;
};

const summaryWarning = "小岛资料读取不完整，正在显示已取得的资料。";

export async function getDashboardHouseholdSummary(
  supabase: SupabaseClient,
  { householdId, currentUserId }: HouseholdSummaryInput
): Promise<DashboardHouseholdSummaryResult> {
  const [householdResult, membersResult, categoriesResult] = await Promise.all([
    supabase.from("households").select("id, name").eq("id", householdId).maybeSingle(),
    supabase
      .from("household_members")
      .select("user_id, role, joined_at")
      .eq("household_id", householdId)
      .order("joined_at", { ascending: true }),
    supabase
      .from("categories")
      .select("id, name, icon, color, sort_order")
      .eq("household_id", householdId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
  ]);

  const hasWarning = Boolean(householdResult.error || membersResult.error || categoriesResult.error);
  const household = householdResult.data as HouseholdRow | null;
  const members = ((membersResult.data ?? []) as HouseholdMemberRow[]).map<DashboardHouseholdMember>(
    (member) => ({
      userId: member.user_id,
      role: member.role,
      joinedAt: member.joined_at,
      isCurrentUser: member.user_id === currentUserId
    })
  );
  const categories = ((categoriesResult.data ?? []) as CategoryRow[]).map<DashboardCategory>(
    (category) => ({
      id: category.id,
      name: category.name,
      icon: category.icon,
      color: category.color,
      sortOrder: category.sort_order ?? 0
    })
  );

  return {
    summary: {
      householdId,
      householdName: household?.name ?? "共同小岛",
      members,
      categories
    },
    warning: hasWarning ? summaryWarning : null
  };
}
