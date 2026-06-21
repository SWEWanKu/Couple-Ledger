import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const TEST_RECORD_NOTE_PREFIX = "Codex 测试";

type HouseholdMembershipRow = {
  household_id: string;
  role: string;
};

type LedgerEntryRow = {
  id: string;
};

function getRedirectUrl(request: NextRequest, pathname: string) {
  const requestUrl = new URL(request.url);
  const host = request.headers.get("host") ?? request.headers.get("x-forwarded-host");
  const protocol =
    request.headers.get("x-forwarded-proto") ?? requestUrl.protocol.replace(":", "");
  const origin = host ? `${protocol}://${host}` : requestUrl.origin;

  return new URL(pathname, origin);
}

function isDevCleanupEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.ENABLE_DEV_LOGIN === "true";
}

export async function GET(request: NextRequest) {
  if (!isDevCleanupEnabled()) {
    return NextResponse.redirect(getRedirectUrl(request, "/login"));
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(getRedirectUrl(request, "/login"));
  }

  const { data: membership, error: membershipError } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return NextResponse.redirect(getRedirectUrl(request, "/records?devCleanup=failed"));
  }

  if (!membership) {
    return NextResponse.redirect(getRedirectUrl(request, "/not-invited"));
  }

  const householdMembership = membership as HouseholdMembershipRow;
  const { data: entries, error: entriesError } = await supabase
    .from("ledger_entries")
    .select("id")
    .eq("household_id", householdMembership.household_id)
    .like("note", `${TEST_RECORD_NOTE_PREFIX}%`);

  if (entriesError) {
    return NextResponse.redirect(getRedirectUrl(request, "/records?devCleanup=failed"));
  }

  const entryIds = ((entries ?? []) as LedgerEntryRow[]).map((entry) => entry.id);

  if (entryIds.length > 0) {
    const { error: splitsError } = await supabase
      .from("ledger_entry_splits")
      .delete()
      .in("entry_id", entryIds);

    if (splitsError) {
      return NextResponse.redirect(getRedirectUrl(request, "/records?devCleanup=failed"));
    }

    const { error: recordsError } = await supabase
      .from("ledger_entries")
      .delete()
      .eq("household_id", householdMembership.household_id)
      .like("note", `${TEST_RECORD_NOTE_PREFIX}%`);

    if (recordsError) {
      return NextResponse.redirect(getRedirectUrl(request, "/records?devCleanup=failed"));
    }
  }

  return NextResponse.redirect(getRedirectUrl(request, "/records"));
}
