import type { SupabaseClient } from "@supabase/supabase-js";

import { createShortCacheKey, getShortCache } from "@/lib/server/short-cache";

export type HouseholdMembership = {
  household_id: string;
  role: string;
};

export function getHouseholdMembership(
  supabase: SupabaseClient,
  userId: string
): Promise<HouseholdMembership | null> {
  return getShortCache(
    createShortCacheKey("household-membership", {
      userId
    }),
    async () => {
      const { data, error } = await supabase
        .from("household_members")
        .select("household_id, role")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return data as HouseholdMembership;
    }
  );
}
