import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — BYPASSES RLS. Server-only.
 *
 * Used for:
 *  - reading/writing the encrypted token columns in `google_connections`
 *    (no client ever SELECTs those columns)
 *  - the agent loop mutating egs_files in the owner's name
 *
 * Every call site MUST guard ownership (owner_id === auth.uid()) in code,
 * because this client does not enforce RLS.
 */
export function createServiceClient() {
  // M-2: prefer a server-only SUPABASE_URL; fall back to the public one for convenience.
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
