import { NextResponse, type NextRequest } from "next/server";
import { acquireProjectRun, releaseProjectRun } from "@/lib/agent-lock";
import { runAgentLoop, type AgentEvent } from "@/lib/anthropic-agent";
import { checkAndConsumeQuota, getAccessGate, getOwnApiKey } from "@/lib/beta";
import { AGENT_RATE, checkRateLimit } from "@/lib/rate-limit";
import { parseAttachedImages, storeChatImages, type AttachedImage } from "@/lib/chat-images";
import { getProject } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300; // needs Vercel Pro for >60s; fine for local dev

/**
 * POST /api/agent/[id]  body: { message: string }
 * Streams the agent loop as SSE (text deltas, tool_call, file_mutation, lint, done).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const project = await getProject(id); // RLS-scoped → null if not owned
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Closed-beta gate (BYOK users + allowlisted users pass; bypassed when BETA_MODE=off)
  const gate = await getAccessGate(user.id, user.email);
  if (!gate.allowed)
    return NextResponse.json(
      { error: "not_in_beta", message: "ยังไม่เปิดให้ใช้งานทั่วไป — บัญชีนี้ยังไม่อยู่ในรอบทดสอบ" },
      { status: 403 },
    );

  // burst limiter (backstop on top of the daily cap + per-project run lock)
  if (!(await checkRateLimit(user.id, AGENT_RATE)))
    return NextResponse.json(
      { error: "rate_limited", message: "เร็วไปนิดนึง — รอสักครู่แล้วลองใหม่นะครับ" },
      { status: 429 },
    );

  let message = "";
  let images: AttachedImage[] = [];
  try {
    const body = (await req.json()) as { message?: string; images?: unknown };
    message = (body.message ?? "").trim();
    images = parseAttachedImages(body.images);
  } catch {
    /* empty body */
  }
  // a turn must carry text or at least one image
  if (!message && images.length === 0)
    return NextResponse.json({ error: "empty_message" }, { status: 400 });
  // image-only turn → give the model a direction
  if (!message && images.length > 0)
    message = "ดูรูปอ้างอิงที่แนบมา แล้วออกแบบ/ปรับหน้าตาให้ใกล้เคียงรูป";

  // H-2: one agent run per project at a time (prevents interleaved writes + double cost)
  if (!(await acquireProjectRun(id)))
    return NextResponse.json(
      { error: "already_running", message: "โปรเจกต์นี้กำลังประมวลผลอยู่ — รอให้เสร็จก่อนสักครู่นะครับ" },
      { status: 409 },
    );

  // BYOK: run on the user's own key (and skip the daily cap — their cost). Else the platform key
  // under a per-user daily generation cap. (lock acquired → release it on any early exit below.)
  const apiKey = (await getOwnApiKey(user.id)) ?? undefined;
  if (!apiKey) {
    const quota = await checkAndConsumeQuota(user.id);
    if (!quota.ok) {
      await releaseProjectRun(id);
      return NextResponse.json(
        {
          error: "quota_exceeded",
          message: `วันนี้ใช้ครบโควตาแล้ว (${quota.limit} ครั้ง/วัน) — ลองใหม่พรุ่งนี้ หรือใส่ Anthropic API key ของคุณเองในหน้า ตั้งค่า เพื่อใช้แบบไม่จำกัด`,
        },
        { status: 429 },
      );
    }
  }

  // persist attachments to the project's history bucket (best-effort; never blocks the turn)
  if (images.length > 0) await storeChatImages(id, images);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const emit = (ev: AgentEvent) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
      };
      try {
        await runAgentLoop({ projectId: id, project, userMessage: message, images, apiKey, emit });
      } catch (e) {
        console.error("[agent] loop error:", e);
        emit({ type: "error", message: "agent_error" });
      } finally {
        await releaseProjectRun(id); // always free the per-project lock
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
