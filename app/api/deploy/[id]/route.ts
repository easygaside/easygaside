import { NextResponse, type NextRequest } from "next/server";
import { mapGoogleError } from "@/lib/api-helpers";
import { deployProject } from "@/lib/deploy";
import { getProject } from "@/lib/projects";
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

  const project = await getProject(id); // RLS-scoped
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    const result = await deployProject(user.id, project);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return mapGoogleError(e);
  }
}
