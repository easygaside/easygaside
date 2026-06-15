import { NextResponse, type NextRequest } from "next/server";
import { acquireProjectRun, releaseProjectRun } from "@/lib/agent-lock";
import { runAgentLoop, type AgentEvent } from "@/lib/anthropic-agent";
import { getAccessGate } from "@/lib/beta";
import { deployProject } from "@/lib/deploy";
import { probeExec } from "@/lib/gas-verify";
import { logGeneration } from "@/lib/metrics";
import { AGENT_RATE, checkRateLimit } from "@/lib/rate-limit";
import { getDeployedUrl, getProject } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_REPAIRS = 2; // bound the run-and-repair loop (research: unbounded loops "fix" by deleting)

const repairPrompt = (error: string) =>
  `ตอนเปิดใช้งานจริง (deploy แล้ว) แอปขึ้นปัญหานี้:\n${error}\n\n` +
  `ช่วยหาสาเหตุแล้วแก้ไฟล์ที่เกี่ยวข้องให้รันได้จริง (อ่านโปรเจกต์ก่อนถ้าจำเป็น) — แก้ให้เลย ไม่ต้องอธิบายยาว`;

/**
 * POST /api/verify/[id] — Gate 2 (run-and-repair), the on-demand "ทดสอบรันจริง / ซ่อมให้" button.
 * Probes the live /exec; if it failed at runtime, repairs (Claude, no rulebook critic — execution is
 * the stronger oracle) and re-deploys (same URL), looping up to MAX_REPAIRS. Streams SSE like /api/agent.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const gate = await getAccessGate(user.id, user.email);
  if (!gate.allowed)
    return NextResponse.json({ error: "not_in_beta", message: "บัญชีนี้ยังไม่อยู่ในรอบทดสอบ" }, { status: 403 });

  if (!(await checkRateLimit(user.id, AGENT_RATE)))
    return NextResponse.json({ error: "rate_limited", message: "เร็วไปนิดนึง — รอสักครู่นะครับ" }, { status: 429 });

  // share the per-project run lock with the agent (no overlapping writes/deploys)
  if (!(await acquireProjectRun(id)))
    return NextResponse.json(
      { error: "already_running", message: "โปรเจกต์นี้กำลังประมวลผลอยู่ — รอให้เสร็จก่อนนะครับ" },
      { status: 409 },
    );

  const startedAt = Date.now();
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const emit = (ev: AgentEvent) => {
        if (!closed) controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
      };
      let inputTokens = 0;
      let outputTokens = 0;
      let verified = false;
      try {
        let url = await getDeployedUrl(id);
        if (!url) {
          emit({
            type: "text",
            delta: '\n\nยังไม่ได้ deploy โปรเจกต์นี้ — กดปุ่ม "Deploy เข้า Google" มุมขวาบนก่อน แล้วค่อยกดทดสอบรันจริงอีกครั้งครับ',
          });
          emit({ type: "done" });
          return;
        }

        for (let i = 0; i <= MAX_REPAIRS; i++) {
          emit({ type: "status", text: "กำลังเปิดแอปเพื่อทดสอบการรันจริง…" });
          const probe = await probeExec(url);
          if (probe.ok) {
            emit({ type: "text", delta: "\n\n✅ ทดสอบรันจริงผ่าน — แอปเปิดและทำงานได้ที่ลิงก์ของคุณ" });
            verified = true;
            break;
          }
          emit({ type: "text", delta: `\n\n🔧 พบปัญหาตอนรันจริง:\n${probe.error ?? "(ไม่ทราบสาเหตุ)"}` });
          if (i === MAX_REPAIRS) {
            emit({
              type: "text",
              delta: '\n\nยังแก้ไม่หมดในรอบนี้ — กด "ทดสอบรันจริง" อีกครั้ง หรือพิมพ์บอกรายละเอียดเพิ่มได้ครับ',
            });
            break;
          }
          emit({ type: "status", text: "กำลังแก้แล้ว deploy ใหม่ (ลิงก์เดิม)…" });
          // repair with Claude, skip the rulebook critic — the live run is the real oracle here.
          const r = await runAgentLoop({
            projectId: id,
            project,
            userMessage: repairPrompt(probe.error ?? "เปิดแอปแล้วไม่ทำงาน"),
            turn: "codegen",
            internal: true,
            skipCritic: true,
            emit,
          });
          inputTokens += r.inputTokens;
          outputTokens += r.outputTokens;
          const dep = await deployProject(user.id, project); // same deployment → same /exec URL
          url = dep.execUrl ?? url;
        }

        await logGeneration({
          projectId: id,
          userId: user.id,
          provider: "claude",
          model: "claude-sonnet-4-6",
          inputTokens,
          outputTokens,
          criticIssues: 0,
          durationMs: Date.now() - startedAt,
          outcome: verified ? "ok" : "error",
        }).catch(() => {});
        emit({ type: "done", tokens: inputTokens + outputTokens });
      } catch (e) {
        console.error("[verify] loop error:", e);
        const msg = e instanceof Error && /NEEDS_REAUTH|invalid_grant|NOT_CONNECTED/.test(e.message)
          ? "การเชื่อมต่อ Google หมดอายุ — เชื่อมต่อใหม่ที่หน้า /connect แล้วลองอีกครั้ง"
          : "ทดสอบ/ซ่อมไม่สำเร็จ ลองใหม่อีกครั้งครับ";
        emit({ type: "text", delta: `\n\n⚠️ ${msg}` });
        emit({ type: "done" });
      } finally {
        await releaseProjectRun(id);
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
