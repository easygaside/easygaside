import { NextResponse } from "next/server";
import { isSuperAdmin } from "@/lib/admin";
import { getCurrentUser } from "@/lib/projects";
import { listSupportThreads } from "@/lib/support";

/** Admin inbox: all customer threads (unread first, then most recent). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !isSuperAdmin(user.email))
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  try {
    const threads = await listSupportThreads();
    return NextResponse.json({ threads });
  } catch (e) {
    console.error("[admin/support] threads failed:", e);
    return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  }
}
