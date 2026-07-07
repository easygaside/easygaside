import { NextResponse } from "next/server";
import { getUserPlan, isPaidPlan } from "@/lib/plan";
import { sendPushToAdmins } from "@/lib/push";
import {
  SUPPORT_MAX_BODY,
  insertSupportMessage,
  listSupportMessages,
} from "@/lib/support";
import { getProject } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";
import { notifyTelegram } from "@/lib/telegram";

/**
 * User side of the live chat. Paid plans only — the widget is hidden for free
 * users, but the gate is enforced HERE (never trust the client).
 */

async function requirePaidUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }) };
  const plan = await getUserPlan(user.id, user.email);
  if (!isPaidPlan(plan))
    return { error: NextResponse.json({ error: "PAID_ONLY" }, { status: 403 }) };
  return { user };
}

export async function GET() {
  const gate = await requirePaidUser();
  if ("error" in gate) return gate.error;
  try {
    const messages = await listSupportMessages(gate.user.id);
    return NextResponse.json({ messages });
  } catch (e) {
    console.error("[support] list failed:", e);
    return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const gate = await requirePaidUser();
  if ("error" in gate) return gate.error;
  const { user } = gate;

  let input: { body?: string; projectId?: string | null };
  try {
    input = (await req.json()) as { body?: string; projectId?: string | null };
  } catch {
    return NextResponse.json({ error: "BAD_JSON" }, { status: 400 });
  }
  const body = (input.body ?? "").trim().slice(0, SUPPORT_MAX_BODY);
  if (!body) return NextResponse.json({ error: "EMPTY" }, { status: 400 });

  try {
    // P2-10: only attach a project the sender actually OWNS (getProject is RLS-scoped → null if not);
    // else a paid user could plant another tenant's project reference into the admin inbox.
    const rawPid = typeof input.projectId === "string" ? input.projectId : null;
    const projectId = rawPid && (await getProject(rawPid)) ? rawPid : null;
    const message = await insertSupportMessage({
      userId: user.id,
      sender: "user",
      body,
      email: user.email ?? null,
      projectId,
    });
    // Best-effort admin alerts (Telegram + push); the message is already stored.
    await notifyTelegram(
      `💬 แชทสดใหม่จาก ${user.email ?? user.id}\n${body.slice(0, 500)}\nตอบที่ /admin → แท็บ แชทสด`,
    );
    await sendPushToAdmins({
      title: `💬 แชทใหม่จาก ${user.email ?? "ลูกค้า"}`,
      body: body.slice(0, 120),
      url: "/admin",
      tag: `support-${user.id}`,
    });
    return NextResponse.json({ message });
  } catch (e) {
    console.error("[support] send failed:", e);
    return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  }
}
