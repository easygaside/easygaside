import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness probe for Railway (healthcheckPath in railway.json).
 * Intentionally does NOT touch the DB or any external service — it only confirms the
 * Next.js server booted and can serve a request, so a transient Supabase/AI hiccup
 * never marks the deployment unhealthy and triggers a restart loop.
 *
 * `commit` echoes Railway's injected RAILWAY_GIT_COMMIT_SHA (shortened) so you can verify which
 * build is actually live in one line: curl /api/health → match `commit` to your latest pushed SHA.
 * Falls back to "dev" locally where the var is absent.
 */
export function GET() {
  const sha = process.env.RAILWAY_GIT_COMMIT_SHA ?? "";
  return NextResponse.json({
    status: "ok",
    service: "easygas",
    commit: sha ? sha.slice(0, 7) : "dev",
    branch: process.env.RAILWAY_GIT_BRANCH ?? null,
    time: new Date().toISOString(),
  });
}
