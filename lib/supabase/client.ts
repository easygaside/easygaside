"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client — used ONLY for login/identity on the client
 * (email/password sign-in & sign-up). No privileged data access.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
