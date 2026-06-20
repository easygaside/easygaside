import { NextResponse, type NextRequest } from "next/server";
import { mapGoogleError } from "@/lib/api-helpers";
import { getTarget } from "@/lib/deployment-targets";
import { getConnectionStatus } from "@/lib/google-connection";
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

  try {
    const target = getTarget(project.target ?? "gas");
    const result = await target.deploy(user.id, project);
    // nothing changed → no new code went live, so don't pile up an identical version snapshot
    if (!result.unchanged) await snapshotProject(id, "deploy"); // version the exact code that went live
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return mapGoogleError(e, (await getConnectionStatus(user.id)).email);
  }
}
