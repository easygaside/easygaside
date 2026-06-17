import { NextResponse, type NextRequest } from "next/server";
import { writeFile } from "@/lib/files";
import { getProject } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";
import { snapshotProject } from "@/lib/versions";

export const runtime = "nodejs";

const VALID_PATH = /^[A-Za-z0-9_-]+\.(gs|html|json)$/;

/** PUT /api/files/[id]  body { path, content } — autosave editor edits into egs_files. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const project = await getProject(id); // RLS-scoped → ownership
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let path = "";
  let content = "";
  try {
    const body = (await req.json()) as { path?: string; content?: string };
    path = String(body.path ?? "");
    content = String(body.content ?? "");
  } catch {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }
  if (!VALID_PATH.test(path) || path.includes("..") || path.includes("/")) {
    return NextResponse.json({ error: "bad_path" }, { status: 400 });
  }

  try {
    await writeFile(id, path, content);
    // version the manual edit (coalesces a burst of autosaves into one snapshot)
    await snapshotProject(id, "manual", { throttleSeconds: 120 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[files] save error:", e);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
}
