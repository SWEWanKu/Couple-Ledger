import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

type DevLoginPersona = "primary" | "partner";

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

function getRequestedPersona(request: NextRequest): DevLoginPersona {
  return request.nextUrl.searchParams.get("persona") === "partner" ? "partner" : "primary";
}

function getDevLoginCredentials(persona: DevLoginPersona) {
  if (persona === "partner") {
    return {
      email: process.env.DEV_LOGIN_PARTNER_EMAIL?.trim(),
      password: process.env.DEV_LOGIN_PARTNER_PASSWORD,
      missingPath: "/login?devLogin=partner_missing",
      failedPath: "/login?devLogin=partner_failed"
    };
  }

  return {
    email: process.env.DEV_LOGIN_EMAIL?.trim(),
    password: process.env.DEV_LOGIN_PASSWORD,
    missingPath: "/login?devLogin=failed",
    failedPath: "/login?devLogin=failed"
  };
}

export async function GET(request: NextRequest) {
  if (!isDevLoginEnabled()) {
    return NextResponse.redirect(getRedirectUrl(request, "/login"));
  }

  const { email, password, missingPath, failedPath } = getDevLoginCredentials(getRequestedPersona(request));

  if (!email || !password) {
    return NextResponse.redirect(getRedirectUrl(request, missingPath));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    return NextResponse.redirect(getRedirectUrl(request, failedPath));
  }

  return NextResponse.redirect(getRedirectUrl(request, "/dashboard"));
}
