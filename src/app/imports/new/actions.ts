"use server";

import { redirect } from "next/navigation";
import {
  createImportBatchFromFile,
  getImportReviewHouseholdMembership
} from "@/lib/import-review/batches";
import { createClient } from "@/lib/supabase/server";

export async function createImportBatchAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getImportReviewHouseholdMembership(supabase, user.id);

  if (!membership) {
    redirect("/not-invited");
  }

  const source = getFormString(formData, "source");
  const file = getFormFile(formData, "file");
  const result = await createImportBatchFromFile(supabase, {
    householdId: membership.household_id,
    source,
    file
  });

  if (!result.ok) {
    redirect(`/imports/new?error=${encodeURIComponent(result.errorCode)}`);
  }

  const notice = result.duplicate ? "?notice=duplicate" : "";
  redirect(`/imports/${result.batchId}/review${notice}`);
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : null;
}

function getFormFile(formData: FormData, key: string) {
  const value = formData.get(key);

  if (!value || typeof value === "string") {
    return null;
  }

  return value;
}
