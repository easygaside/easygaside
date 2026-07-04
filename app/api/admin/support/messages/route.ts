import { NextResponse } from "next/server";
import { isSuperAdmin } from "@/lib/admin";
import { getCurrentUser } from "@/lib/projects";
import { sendPushToUser } from "@/lib/push";
import {
  SUPPORT_MAX_BODY,
  getProjectNameMap,
  insertSupportMessage,
  listSupportMessages,
  markSupportRead,
} from "@/lib/support";

/** Admin side of the live chat: read a thread / reply to a customer. */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !isSuperAdmin(user.email))
    return { error: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) };
  return { user };
}

export async function GET(req: Request) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const userId = new URL(req.url).searchParams.get("userId") ?? "";
  if (!UUID_RE.test(userId)) return NextResponse.json({ error: "BAD_USER" }, { status: 400 });
  try {
    // Opening a thread counts as reading it — mark first so the returned rows
    // (and the next /threads poll) already reflect it.
    await markSupportRead(userId, "admin");
    const messages = await listSupportMessages(userId);
    const projects = await getProjectNameMap([
      ...new Set(messages.map((m) => m.project_id).filter((id): id is string => !!id)),
    ]);
    return NextResponse.json({ messages, projects });
  } catch (e) {
    console.error("[admin/support] list failed:", e);
    return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;

  let input: { userId?: string; body?: string };
  try {
    input = (await req.json()) as { userId?: string; body?: string };
  } catch {
    return NextResponse.json({ error: "BAD_JSON" }, { status: 400 });
  }
  const userId = input.userId ?? "";
  const body = (input.body ?? "").trim().slice(0, SUPPORT_MAX_BODY);
  if (!UUID_RE.test(userId)) return NextResponse.json({ error: "BAD_USER" }, { status: 400 });
  if (!body) return NextResponse.json({ error: "EMPTY" }, { status: 400 });

  try {
    const message = await insertSupportMessage({
      userId,
      sender: "admin",
      body,
      email: gate.user.email ?? null,
    });
    await sendPushToUser(userId, {
      title: "💬 ทีมงาน EasyGAS ตอบกลับแล้ว",
      body: body.slice(0, 120),
      url: "/projects",
      tag: "support-chat",
    });
    return NextResponse.json({ message });
  } catch (e) {
    console.error("[admin/support] send failed:", e);
    return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  }
}
