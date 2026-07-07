import { NextResponse, type NextRequest } from "next/server";
import { mapGoogleError } from "@/lib/api-helpers";
import { getTarget } from "@/lib/deployment-targets";
import { getConnectionStatus } from "@/lib/google-connection";
import { getProject } from "@/lib/projects";
import { PREVIEW_RATE, checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

/** POST /api/preview/[id] → push to a scratch script and return the live /dev URL (Tier-2). */
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

  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // P2-7: preview mints a Google token + pushes files — rate-limit it like deploy so a stuck client
  // can't burn the user's Apps Script API quota (which would then break their real deploys).
  if (!(await checkRateLimit(user.id, PREVIEW_RATE)))
    return NextResponse.json(
      { error: "rate_limited", message: "พรีวิวถี่เกินไป — รอสักครู่แล้วลองใหม่" },
      { status: 429 },
    );

  try {
    const target = getTarget(project.target ?? "gas");
    const { previewUrl } = await target.pushPreview(user.id, project);
    return NextResponse.json({ ok: true, devUrl: previewUrl }); // key kept for PreviewPane
  } catch (e) {
    return mapGoogleError(e, (await getConnectionStatus(user.id)).email);
  }
}
