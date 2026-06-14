import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildAuthUrl } from "@/lib/google-oauth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * GET /api/auth/google/start
 * Starts the custom Google OAuth grant. Requires the user to be logged into easygas first.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL("/login", process.env.GOOGLE_OAUTH_REDIRECT_URI ?? "http://localhost:3000"),
    );
  }

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
