import { NextResponse, type NextRequest } from "next/server";
import { acquireProjectRun, releaseProjectRun } from "@/lib/agent-lock";
import { mapGoogleError } from "@/lib/api-helpers";
import { getTarget } from "@/lib/deployment-targets";
import { probeExec } from "@/lib/gas-verify";
import { getConnectionStatus, markAppsScriptReady } from "@/lib/google-connection";
import { getProject } from "@/lib/projects";
import { snapshotProject } from "@/lib/versions";
import { DEPLOY_RATE, checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

/** POST /api/deploy/[id] → deploy the project's egs_files to the user's own Google account. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  if (!(await checkRateLimit(user.id, DEPLOY_RATE)))
    return NextResponse.json(
      { error: "rate_limited", message: "deploy ถี่เกินไป — รอสักครู่แล้วลองใหม่" },
      { status: 429 },
    );

  const project = await getProject(id); // RLS-scoped
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // P0-4: share the per-project run lock with agent/verify. Without it, a double-click (or a
  // deploy overlapping an in-flight generation) could create duplicate scripts / two webapp
  // deployment rows and push a half-written file set. The partial unique index on
  // egs_deployments(project_id) WHERE entry_type='webapp' is the structural backstop.
  if (!(await acquireProjectRun(id)))
    return NextResponse.json(
      { error: "already_running", message: "โปรเจกต์นี้กำลังประมวลผลอยู่ — รอให้เสร็จก่อนแล้วลองใหม่นะครับ" },
      { status: 409 },
    );

  try {
    const target = getTarget(project.target ?? "gas");
    const result = await target.deploy(user.id, project);
    // A real deploy succeeded → the Apps Script API is provably enabled for this account.
    await markAppsScriptReady(user.id);
    // nothing changed → no new code went live, so don't pile up an identical version snapshot
    if (!result.unchanged) await snapshotProject(id, "deploy"); // version the exact code that went live
    // P1-6: auto-probe the live /exec so the user gets an immediate "opened OK / has a problem" verdict
    // without pressing ทดสอบรันจริง. Repair stays MANUAL (the client offers a button) — no surprise
    // auto-rewrite of their deployed code. Best-effort + non-blocking.
    let probe: Awaited<ReturnType<typeof probeExec>> | undefined;
    if (result.execUrl) {
      try {
        probe = await probeExec(result.execUrl);
      } catch {
        /* probe is a bonus — never fail the deploy over it */
      }
    }
    return NextResponse.json({ ok: true, ...result, probe });
  } catch (e) {
    return mapGoogleError(e, (await getConnectionStatus(user.id)).email);
  } finally {
    await releaseProjectRun(id); // always free the per-project lock
  }
}
