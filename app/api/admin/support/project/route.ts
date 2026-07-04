import { NextResponse } from "next/server";
import { isSuperAdmin } from "@/lib/admin";
import { getCurrentUser } from "@/lib/projects";
import { getSupportProjectDetail } from "@/lib/support";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Detail behind an attached-project chip in the admin inbox (name, deploy URL, files). */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !isSuperAdmin(user.email))
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "BAD_ID" }, { status: 400 });
  try {
    const project = await getSupportProjectDetail(id);
    if (!project) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ project });
  } catch (e) {
    console.error("[admin/support] project detail failed:", e);
    return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  }
}
