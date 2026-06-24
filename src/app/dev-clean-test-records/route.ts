import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  return NextResponse.json({
    status: "retired",
    message: "Dev cleanup hard deletes have been retired. Use the normal soft-void flow for smoke records."
  });
}
