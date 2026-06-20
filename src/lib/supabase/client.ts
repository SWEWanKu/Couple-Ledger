"use client";

import { createBrowserClient } from "@supabase/ssr";

function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    );
  }

  return { supabaseUrl, supabasePublishableKey };
}

export function createClient() {
  const { supabaseUrl, supabasePublishableKey } = getSupabaseConfig();

  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
