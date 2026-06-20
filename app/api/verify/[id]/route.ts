import { NextResponse, type NextRequest } from "next/server";
import { acquireProjectRun, releaseProjectRun } from "@/lib/agent-lock";
import { runAgentLoop, type AgentEvent } from "@/lib/anthropic-agent";
import { runOpenAiAgentLoop } from "@/lib/openai-agent";
import { resolveProjectProvider, resolveProvider } from "@/lib/llm/provider";
import { getAccessGate, getOwnApiKey } from "@/lib/beta";
import { deployProject } from "@/lib/deploy";
import { ENERGY_EXHAUSTED_MSG, getEnergyTank, getProjectEnergyUsed } from "@/lib/energy";
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
 * Probes the live /exec; if it failed at runtime, repairs on the project's own arm (no rulebook
 * critic — the live run is the stronger oracle) and re-deploys (same URL), looping up to MAX_REPAIRS.
 * Streams SSE like /api/agent.
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

  // per-project energy tank — platform-key users are capped; BYOK (own key) bypasses (own cost)
  if (!(await getOwnApiKey(user.id))) {
    const used = await getProjectEnergyUsed(id);
    if (used >= (await getEnergyTank(user.email, project.llm_provider)))
      return NextResponse.json({ error: "energy_exhausted", message: ENERGY_EXHAUSTED_MSG }, { status: 429 });
  }

  // share the per-project run lock with the agent (no overlapping writes/deploys)
  if (!(await acquireProjectRun(id)))
    return NextResponse.json(
      { error: "already_running", message: "โปรเจกต์นี้กำลังประมวลผลอยู่ — รอให้เสร็จก่อนนะครับ" },
      { status: 409 },
    );

  // Route the repair to the project's OWN arm (same as /api/agent) — a DeepSeek project repairs on
  // DeepSeek, a Claude project on Claude. The live /exec run is the oracle either way; this keeps
  // verify cost on the arm the user is actually testing instead of silently billing Claude.
  const provider = await resolveProjectProvider(id, user.id);
  const cfg = await resolveProvider(provider);
  const byok = provider === "claude" ? (await getOwnApiKey(user.id)) ?? undefined : undefined;
  const repairKey = byok ?? cfg.apiKey;
  if (!repairKey) {
    await releaseProjectRun(id);
    return NextResponse.json(
      { error: "provider_not_configured", message: `ยังไม่ได้ตั้งค่า API key ของ ${cfg.label} ในระบบ` },
      { status: 400 },
    );
  }

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
      let cacheReadTokens = 0;
      let cacheCreationTokens = 0;
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
          if (probe.authRequired) {
            // not a code bug — the owner just needs to authorize once. Don't burn a repair on it.
            emit({ type: "text", delta: `\n\n🔐 ${probe.error}` });
            emit({
              type: "text",
              delta: '\n\nเปิดแอปของคุณ 1 ครั้ง กด Review permissions → Advanced → Allow (อนุญาตครั้งเดียว) แล้วค่อยกด "ทดสอบรันจริง" อีกที',
            });
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
          // repair on the project's arm, skip the rulebook critic — the live run is the real oracle.
          const repairArgs = {
            projectId: id,
            project,
            userMessage: repairPrompt(probe.error ?? "เปิดแอปแล้วไม่ทำงาน"),
            turn: "codegen" as const,
            internal: true,
            skipCritic: true,
            emit,
          };
          const r =
            provider === "claude"
              ? await runAgentLoop({ ...repairArgs, apiKey: repairKey })
              : await runOpenAiAgentLoop(repairArgs, { ...cfg, apiKey: repairKey });
          inputTokens += r.inputTokens;
          outputTokens += r.outputTokens;
          cacheReadTokens += r.cacheReadTokens ?? 0;
          cacheCreationTokens += r.cacheCreationTokens ?? 0;
          const dep = await deployProject(user.id, project); // same deployment → same /exec URL
          url = dep.execUrl ?? url;
        }

        await logGeneration({
          projectId: id,
          userId: user.id,
          provider,
          model: cfg.model,
          inputTokens,
          outputTokens,
          cacheReadTokens,
          cacheCreationTokens,
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
