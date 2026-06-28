import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-couple-ledger-user-id");
  const cookiesToApply: Parameters<NextResponse["cookies"]["set"]>[] = [];
  const headersToApply = new Headers();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    // Allow public pages to render during local setup before Supabase env vars exist.
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          cookiesToApply.push([name, value, options]);
        });

        Object.entries(headers).forEach(([key, value]) => {
          headersToApply.set(key, value);
        });
      }
    }
  });

  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;

  if (userId) {
    requestHeaders.set("x-couple-ledger-user-id", userId);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  cookiesToApply.forEach((args) => {
    response.cookies.set(...args);
  });
  headersToApply.forEach((value, key) => {
    response.headers.set(key, value);
  });

  return response;
}
