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

function isDevLoginEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.ENABLE_DEV_LOGIN === "true";
}

export async function GET(request: NextRequest) {
  if (!isDevLoginEnabled()) {
    return NextResponse.redirect(getRedirectUrl(request, "/login"));
  }

  const email = process.env.DEV_LOGIN_EMAIL?.trim();
  const password = process.env.DEV_LOGIN_PASSWORD;

  if (!email || !password) {
    return NextResponse.redirect(getRedirectUrl(request, "/login?devLogin=failed"));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    return NextResponse.redirect(getRedirectUrl(request, "/login?devLogin=failed"));
  }

  return NextResponse.redirect(getRedirectUrl(request, "/dashboard"));
}
