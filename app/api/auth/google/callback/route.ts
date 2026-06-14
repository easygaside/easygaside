import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { decodeIdToken, exchangeCode } from "@/lib/google-oauth";
import { storeConnection } from "@/lib/google-connection";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * GET /api/auth/google/callback?code=...&state=...
 *
 * Verifies state, exchanges the code, then:
 *  - if NOT logged in → signs the user in from the Google id_token (Google login),
 *  - if already logged in → keeps that identity (connecting Google to an existing account),
 * then encrypts + stores the refresh token and lands on /projects. One Google consent does both.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const origin = url.origin;
  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?error=${reason}`, origin));

  if (oauthError) return fail(oauthError);
  if (!code || !state) return fail("missing_code_or_state");

  // CSRF: state must match the cookie we set in /start.
  const cookieStore = await cookies();
  const expected = cookieStore.get("eg_oauth_state")?.value;
  cookieStore.delete("eg_oauth_state");
  if (!expected || expected !== state) return fail("bad_state");

  let tokens;
  try {
    tokens = await exchangeCode(code);
  } catch {
    return fail("exchange_failed");
  }
  if (!tokens.refresh_token) return fail("no_refresh_token"); // guarded by prompt=consent
  if (!tokens.id_token) return fail("no_id_token");

  const supabase = await createClient();

  // Already logged in (email/pw user connecting Google) → keep that identity.
  // Otherwise sign in via the Google id_token (Supabase verifies it against the configured
  // Google provider; nonce checks are disabled because this is a server-side code flow).
  let userId: string;
  const {
    data: { user: existing },
  } = await supabase.auth.getUser();
  if (existing) {
    userId = existing.id;
  } else {
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: tokens.id_token,
    });
    if (error || !data.user) return fail("signin_failed");
    userId = data.user.id;
  }

  const { sub } = decodeIdToken(tokens.id_token);
  try {
    await storeConnection({
      userId,
      googleSub: sub,
      scope: tokens.scope,
      refreshToken: tokens.refresh_token,
    });
  } catch {
    return fail("store_failed");
  }

  return NextResponse.redirect(new URL("/projects", origin));
}
