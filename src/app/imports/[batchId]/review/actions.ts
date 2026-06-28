"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getImportReviewHouseholdMembership } from "@/lib/import-review/batches";
import {
  confirmImportItemToLedger,
  markImportItemPersonal,
  normalizeImportReviewStatusFilter,
  reopenImportItemToPending,
  updateImportItemReviewStatus,
  type ConfirmImportItemToLedgerResult,
  type ImportReviewStatusFilter,
  type MarkImportItemPersonalResult,
  type ReopenImportItemToPendingResult,
  type UpdateImportItemReviewStatusResult
} from "@/lib/import-review/review-items";
import { clearShortCache } from "@/lib/server/short-cache";
import { createClient } from "@/lib/supabase/server";

type ReviewActionReturnContext = {
  batchId: string | null;
  itemId: string | null;
  statusFilter: ImportReviewStatusFilter;
  index: string | null;
};

export async function updateImportItemReviewStatusAction(formData: FormData) {
  const returnContext = getReviewActionReturnContext(formData);
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

  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    redirect("/login");
  }

  const actionSupabase = createAuthenticatedActionClient(session.access_token);
  const result = await updateImportItemReviewStatus(actionSupabase, {
    batchId: returnContext.batchId,
    itemId: returnContext.itemId,
    reviewStatus: getFormString(formData, "review_status")
  });

  if (returnContext.batchId) {
    revalidatePath("/imports");
    revalidatePath(`/imports/${returnContext.batchId}/review`);
  }

  if (result.status === "unauthenticated") {
    redirect("/login");
  }

  if (result.status === "not_household_member") {
    redirect("/not-invited");
  }

  clearShortCache();
  redirect(getReviewActionRedirectHref(returnContext, result));
}

export async function markImportItemPersonalAction(formData: FormData) {
  const returnContext = getReviewActionReturnContext(formData);
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

  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    redirect("/login");
  }

  const actionSupabase = createAuthenticatedActionClient(session.access_token);
  const result = await markImportItemPersonal(actionSupabase, {
    batchId: returnContext.batchId,
    itemId: returnContext.itemId,
    ownerUserId: getFormString(formData, "owner_user_id"),
    note: normalizePersonalNote(getFormString(formData, "note"))
  });

  if (returnContext.batchId) {
    revalidatePath("/imports");
    revalidatePath(`/imports/${returnContext.batchId}/review`);
  }

  if (result.status === "unauthenticated") {
    redirect("/login");
  }

  if (result.status === "not_household_member") {
    redirect("/not-invited");
  }

  clearShortCache();
  redirect(getPersonalActionRedirectHref(returnContext, result));
}

export async function reopenImportItemToPendingAction(formData: FormData) {
  const returnContext = getReviewActionReturnContext(formData);
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

  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    redirect("/login");
  }

  const actionSupabase = createAuthenticatedActionClient(session.access_token);
  const result = await reopenImportItemToPending(actionSupabase, {
    batchId: returnContext.batchId,
    itemId: returnContext.itemId
  });

  if (returnContext.batchId) {
    revalidatePath("/imports");
    revalidatePath(`/imports/${returnContext.batchId}/review`);
  }

  if (result.status === "unauthenticated") {
    redirect("/login");
  }

  if (result.status === "not_household_member") {
    redirect("/not-invited");
  }

  clearShortCache();
  redirect(getReopenActionRedirectHref(returnContext, result));
}

export async function confirmImportItemToLedgerAction(formData: FormData) {
  const returnContext = getReviewActionReturnContext(formData);
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

  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    redirect("/login");
  }

  const actionSupabase = createAuthenticatedActionClient(session.access_token);
  const result = await confirmImportItemToLedger(actionSupabase, {
    batchId: returnContext.batchId,
    itemId: returnContext.itemId,
    categoryId: getFormString(formData, "category_id"),
    paidByUserId: getFormString(formData, "paid_by_user_id"),
    splitType: getFormString(formData, "split_type"),
    note: normalizeConfirmNote(getFormString(formData, "note"))
  });

  if (returnContext.batchId) {
    revalidatePath("/imports");
    revalidatePath(`/imports/${returnContext.batchId}/review`);
    revalidatePath("/records");
    revalidatePath("/dashboard");
    revalidatePath("/settlement");
    revalidatePath("/reports/monthly");
  }

  if (result.status === "unauthenticated") {
    redirect("/login");
  }

  if (result.status === "not_household_member") {
    redirect("/not-invited");
  }

  clearShortCache();
  redirect(getConfirmActionRedirectHref(returnContext, result));
}

function createAuthenticatedActionClient(accessToken: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    );
  }

  return createSupabaseClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });
}

function getReviewActionReturnContext(formData: FormData): ReviewActionReturnContext {
  return {
    batchId: getFormString(formData, "batch_id"),
    itemId: getFormString(formData, "item_id"),
    statusFilter: normalizeImportReviewStatusFilter(getFormString(formData, "return_status")),
    index: normalizeIndex(getFormString(formData, "return_index"))
  };
}

function getReviewActionRedirectHref(
  returnContext: ReviewActionReturnContext,
  result: Exclude<UpdateImportItemReviewStatusResult, { status: "unauthenticated" | "not_household_member" }>
) {
  const batchId = result.status === "updated" ? result.batchId : returnContext.batchId;

  if (!batchId) {
    return "/imports";
  }

  const params = new URLSearchParams();

  if (result.status === "updated") {
    params.set("status", "pending");

    if (result.nextItemId) {
      params.set("item", result.nextItemId);
    }

    params.set("import_review_result", result.reviewStatus);
  } else {
    params.set("status", returnContext.statusFilter);

    if (returnContext.itemId) {
      params.set("item", returnContext.itemId);
    } else if (returnContext.index) {
      params.set("index", returnContext.index);
    }

    params.set("import_review_result", "error");
    params.set("import_review_error", getReviewActionErrorCode(result.status));
  }

  return `/imports/${batchId}/review?${params.toString()}`;
}

function getReviewActionErrorCode(status: Exclude<UpdateImportItemReviewStatusResult["status"], "updated">) {
  if (status === "already_imported") {
    return "already_imported";
  }

  if (status === "invalid_status" || status === "invalid_transition" || status === "invalid_input") {
    return "invalid_status";
  }

  if (status === "not_found") {
    return "not_found";
  }

  return "action_failed";
}

function getPersonalActionRedirectHref(
  returnContext: ReviewActionReturnContext,
  result: Exclude<MarkImportItemPersonalResult, { status: "unauthenticated" | "not_household_member" }>
) {
  const batchId = result.status === "personal_skipped" ? result.batchId : result.batchId ?? returnContext.batchId;

  if (!batchId) {
    return "/imports";
  }

  const params = new URLSearchParams();

  if (result.status === "personal_skipped") {
    params.set("status", "pending");

    if (result.nextItemId) {
      params.set("item", result.nextItemId);
    }

    params.set("import_review_result", "personal_skipped");
  } else if (result.status === "already_imported") {
    params.set("status", "imported");

    if (result.itemId ?? returnContext.itemId) {
      params.set("item", result.itemId ?? returnContext.itemId ?? "");
    }

    params.set("import_review_result", "already_imported");
  } else if (result.status === "invalid_owner") {
    params.set("status", returnContext.statusFilter);

    if (returnContext.itemId) {
      params.set("item", returnContext.itemId);
    } else if (returnContext.index) {
      params.set("index", returnContext.index);
    }

    params.set("import_review_result", "invalid_owner");
  } else if (result.status === "not_found") {
    params.set("status", returnContext.statusFilter);

    if (returnContext.itemId) {
      params.set("item", returnContext.itemId);
    } else if (returnContext.index) {
      params.set("index", returnContext.index);
    }

    params.set("import_review_result", "not_found");
  } else {
    params.set("status", returnContext.statusFilter);

    if (returnContext.itemId) {
      params.set("item", returnContext.itemId);
    } else if (returnContext.index) {
      params.set("index", returnContext.index);
    }

    params.set("import_review_result", "error");
    params.set("import_review_error", getPersonalActionErrorCode(result.status));
  }

  return `/imports/${batchId}/review?${params.toString()}`;
}

function getPersonalActionErrorCode(
  status: Exclude<
    MarkImportItemPersonalResult["status"],
    "personal_skipped" | "already_imported" | "invalid_owner" | "not_found"
  >
) {
  if (status === "invalid_transition" || status === "invalid_input") {
    return "invalid_status";
  }

  return "action_failed";
}

function getReopenActionRedirectHref(
  returnContext: ReviewActionReturnContext,
  result: Exclude<ReopenImportItemToPendingResult, { status: "unauthenticated" | "not_household_member" }>
) {
  const batchId = result.status === "reopened" ? result.batchId : result.batchId ?? returnContext.batchId;

  if (!batchId) {
    return "/imports";
  }

  const params = new URLSearchParams();

  if (result.status === "reopened") {
    params.set("status", "pending");
    params.set("item", result.itemId);
    params.set("import_review_result", "reopened");
  } else if (result.status === "already_pending") {
    params.set("status", "pending");

    if (result.itemId ?? returnContext.itemId) {
      params.set("item", result.itemId ?? returnContext.itemId ?? "");
    }

    params.set("import_review_result", "already_pending");
  } else if (result.status === "already_imported") {
    params.set("status", "imported");

    if (result.itemId ?? returnContext.itemId) {
      params.set("item", result.itemId ?? returnContext.itemId ?? "");
    }

    params.set("import_review_result", "already_imported");
  } else if (result.status === "not_found") {
    params.set("status", returnContext.statusFilter);

    if (returnContext.itemId) {
      params.set("item", returnContext.itemId);
    } else if (returnContext.index) {
      params.set("index", returnContext.index);
    }

    params.set("import_review_result", "not_found");
  } else {
    params.set("status", returnContext.statusFilter);

    if (returnContext.itemId) {
      params.set("item", returnContext.itemId);
    } else if (returnContext.index) {
      params.set("index", returnContext.index);
    }

    params.set("import_review_result", "error");
    params.set("import_review_error", getReopenActionErrorCode(result.status));
  }

  return `/imports/${batchId}/review?${params.toString()}`;
}

function getReopenActionErrorCode(
  status: Exclude<
    ReopenImportItemToPendingResult["status"],
    "reopened" | "already_pending" | "already_imported" | "not_found"
  >
) {
  if (status === "invalid_transition" || status === "invalid_input") {
    return "invalid_status";
  }

  return "action_failed";
}

function getConfirmActionRedirectHref(
  returnContext: ReviewActionReturnContext,
  result: Exclude<ConfirmImportItemToLedgerResult, { status: "unauthenticated" | "not_household_member" }>
) {
  const batchId = result.status === "confirmed" ? result.batchId : returnContext.batchId;

  if (!batchId) {
    return "/imports";
  }

  const params = new URLSearchParams();

  if (result.status === "confirmed") {
    params.set("status", "pending");

    if (result.nextItemId) {
      params.set("item", result.nextItemId);
    }

    params.set("import_review_result", "imported");
    params.set("ledger_entry_id", result.ledgerEntryId);
  } else {
    params.set("status", returnContext.statusFilter);

    if (returnContext.itemId) {
      params.set("item", returnContext.itemId);
    } else if (returnContext.index) {
      params.set("index", returnContext.index);
    }

    params.set("import_review_result", "error");
    params.set("import_review_error", getConfirmActionErrorCode(result.status));
  }

  return `/imports/${batchId}/review?${params.toString()}`;
}

function getConfirmActionErrorCode(
  status: Exclude<ConfirmImportItemToLedgerResult["status"], "confirmed">
) {
  if (status === "already_reviewed") {
    return "already_reviewed";
  }

  if (status === "blocked_pending_replacement") {
    return "blocked_pending_replacement";
  }

  if (status === "unsupported_direction") {
    return "unsupported_direction";
  }

  if (
    status === "invalid_category" ||
    status === "invalid_paid_by" ||
    status === "invalid_split_type" ||
    status === "invalid_amount" ||
    status === "missing_members" ||
    status === "invalid_input"
  ) {
    return "invalid_confirm_input";
  }

  if (status === "not_found") {
    return "not_found";
  }

  return "confirm_failed";
}

function normalizeIndex(value: string | null) {
  if (!value || !/^\d+$/.test(value)) {
    return null;
  }

  return value;
}

function normalizeConfirmNote(value: string | null) {
  const note = value?.trim();

  return note ? note.slice(0, 80) : null;
}

function normalizePersonalNote(value: string | null) {
  const note = value?.trim();

  return note ? note.slice(0, 120) : "个人支出，不进入共同账本";
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() || null : null;
}
