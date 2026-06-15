import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness probe for Railway (healthcheckPath in railway.json).
 * Intentionally does NOT touch the DB or any external service — it only confirms the
 * Next.js server booted and can serve a request, so a transient Supabase/AI hiccup
 * never marks the deployment unhealthy and triggers a restart loop.
 */
export function GET() {
  return NextResponse.json({ status: "ok", service: "easygas", time: new Date().toISOString() });
}
