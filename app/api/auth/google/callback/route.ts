import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { decodeIdToken, exchangeCode } from "@/lib/google-oauth";
import { storeConnection } from "@/lib/google-connection";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * GET /api/auth/google/callback?code=...&state=...
 * Verifies state, exchanges the code, encrypts + stores the refresh token, then
 * redirects to /connect/done.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const origin = url.origin;
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/connect?error=${reason}`, origin));

  if (oauthError) return fail(oauthError);
  if (!code || !state) return fail("missing_code_or_state");

  // CSRF: state must match the cookie we set in /start.
  const cookieStore = await cookies();
  const expected = cookieStore.get("eg_oauth_state")?.value;
  cookieStore.delete("eg_oauth_state");
  if (!expected || expected !== state) return fail("bad_state");

  // Must still be logged in.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", origin));

  let tokens;
  try {
    tokens = await exchangeCode(code);
  } catch {
    return fail("exchange_failed");
  }

  if (!tokens.refresh_token) {
    // Should not happen with prompt=consent, but guard anyway.
    return fail("no_refresh_token");
  }

  const { sub } = tokens.id_token
    ? decodeIdToken(tokens.id_token)
    : { sub: "" };

  try {
    await storeConnection({
      userId: user.id,
      googleSub: sub,
      scope: tokens.scope,
      refreshToken: tokens.refresh_token,
    });
  } catch {
    return fail("store_failed");
  }

  return NextResponse.redirect(new URL("/connect/done", origin));
}
