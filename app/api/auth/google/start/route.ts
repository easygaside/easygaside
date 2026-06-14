import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildAuthUrl } from "@/lib/google-oauth";

export const runtime = "nodejs";

/**
 * GET /api/auth/google/start
 *
 * Entry point for BOTH "Sign in with Google" (no prior session) and connecting Google to an
 * existing email/password session. No login required up front — the callback signs the user in
 * via the returned id_token when there's no session yet, then stores the encrypted refresh token.
 */
export async function GET() {
  const state = randomBytes(32).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("eg_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // lax (not strict) so the cookie survives Google's cross-site redirect back
    maxAge: 600, // 10 minutes
    path: "/api/auth/google", // scope to the OAuth routes only
  });

  return NextResponse.redirect(buildAuthUrl(state));
}
