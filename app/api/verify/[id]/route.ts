import { NextResponse, type NextRequest } from "next/server";
import { acquireProjectRun, releaseProjectRun } from "@/lib/agent-lock";
import { runAgentLoop, type AgentEvent, type RunAgentArgs } from "@/lib/anthropic-agent";
import { runOpenAiAgentLoop } from "@/lib/openai-agent";
import { resolveProjectProvider, resolveProvider, resolveRepairProvider } from "@/lib/llm/provider";
import { getAccessGate, getOwnApiKey } from "@/lib/beta";
import { deployProject } from "@/lib/deploy";
import { NeedsReauthError, NotConnectedError } from "@/lib/errors";
import { POOL_EXHAUSTED_MSG, getMonthlyPool, getUserMonthlyEnergyUsed } from "@/lib/energy";
import { probeExec } from "@/lib/gas-verify";
import { logGeneration } from "@/lib/metrics";
import { AGENT_RATE, checkRateLimit } from "@/lib/rate-limit";
import { getDeployedUrl, getProject } from "@/lib/projects";
import { snapshotProject } from "@/lib/versions";
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

  // monthly credit pool — platform-key users are capped; BYOK (own key) bypasses (own cost)
  if (!(await getOwnApiKey(user.id))) {
    const used = await getUserMonthlyEnergyUsed(user.id);
    if (used >= (await getMonthlyPool(user.id, user.email)))
      return NextResponse.json({ error: "energy_exhausted", message: POOL_EXHAUSTED_MSG }, { status: 429 });
  }

  // share the per-project run lock with the agent (no overlapping writes/deploys)
  if (!(await acquireProjectRun(id)))
    return NextResponse.json(
      { error: "already_running", message: "โปรเจกต์นี้กำลังประมวลผลอยู่ — รอให้เสร็จก่อนนะครับ" },
      { status: 409 },
    );

  // The project's OWN arm (Anthropic vs OpenAI wire format is locked per project) — the guaranteed
  // fallback + the key baseline. BYOK (Claude) uses the user's own key.
  const projectProvider = await resolveProjectProvider(id, user.id);
  const ownCfg = await resolveProvider(projectProvider);
  const byok = projectProvider === "claude" ? (await getOwnApiKey(user.id)) ?? undefined : undefined;
  const ownKey = byok ?? ownCfg.apiKey;
  if (!ownKey) {
    await releaseProjectRun(id);
    return NextResponse.json(
      { error: "provider_not_configured", message: `ยังไม่ได้ตั้งค่า API key ของ ${ownCfg.label} ในระบบ` },
      { status: 400 },
    );
  }

  // Escalate the Gate-2 REPAIR to a stronger arm — GLM (z.ai) by default (admin: 'repair_provider') —
  // for OpenAI-family projects; Claude projects stay on Claude (format lock). runRepair falls back to
  // the project's own arm at run time if GLM errors (e.g. z.ai ToS block), so repair never dead-ends.
  const repairProvider = await resolveRepairProvider(projectProvider);
  const crossModel = repairProvider !== projectProvider;
  const repairCfgBase = crossModel ? await resolveProvider(repairProvider) : ownCfg;
  // glm-5.x / deepseek-v4-pro are thinking models: they 400 on tool_choice and stream reasoning_content.
  const repairCfg = {
    ...repairCfgBase,
    reasoning: repairCfgBase.reasoning || /glm-5|v4-pro|reasoner/i.test(repairCfgBase.model),
  };
  const repairKey = (repairProvider === "claude" ? byok : undefined) ?? repairCfgBase.apiKey ?? ownKey;

  const startedAt = Date.now();
  const encoder = new TextEncoder();
  let closed = false; // flipped by cancel() on client disconnect, and in finally
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (ev: AgentEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
        } catch {
          closed = true; // client left — let the repair loop finish + log usage
        }
      };

      // One repair turn on the escalated arm (GLM); on ANY GLM failure fall back to the project's own
      // arm so a bad / ToS-blocked GLM call never dead-ends the repair loop.
      const runRepair = (base: RunAgentArgs) => {
        if (crossModel) {
          return runOpenAiAgentLoop(
            { ...base, stripHistoryReasoning: true },
            { ...repairCfg, apiKey: repairKey },
          ).catch((e) => {
            console.error("[verify] escalated (GLM) repair failed — falling back to project arm:", e);
            emit({ type: "status", text: "สลับไปซ่อมด้วยอาร์มเดิม…" });
            return projectProvider === "claude"
              ? runAgentLoop({ ...base, apiKey: ownKey })
              : runOpenAiAgentLoop(base, { ...ownCfg, apiKey: ownKey });
          });
        }
        return projectProvider === "claude"
          ? runAgentLoop({ ...base, apiKey: ownKey })
          : runOpenAiAgentLoop(base, { ...ownCfg, apiKey: ownKey });
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
            emit({
              type: "verdict",
              ok: true,
              text: "หน้าแอปเปิดได้ ✓ (ทดสอบเฉพาะการเปิดหน้า — ปุ่ม/การบันทึกข้อมูลยังไม่ได้ทดสอบ) ลองกดใช้งานจริงดูอีกที",
            });
            verified = true;
            break;
          }
          // P1-8: infra failure (timeout / network / deleted deployment) is NOT a code bug — never
          // repair it (that would rewrite healthy code). Ask the user to retry instead.
          if (probe.infraError) {
            emit({ type: "text", delta: `\n\n⏳ ${probe.error}` });
            emit({
              type: "text",
              delta: '\n\nไม่ใช่ปัญหาโค้ด — แอปอาจเพิ่งเย็นเครื่องหรือช้า รอสักครู่แล้วกด "ทดสอบรันจริง" อีกครั้งครับ',
            });
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
          const r = await runRepair(repairArgs);
          inputTokens += r.inputTokens;
          outputTokens += r.outputTokens;
          cacheReadTokens += r.cacheReadTokens ?? 0;
          cacheCreationTokens += r.cacheCreationTokens ?? 0;
          const dep = await deployProject(user.id, project); // same deployment → same /exec URL
          url = dep.execUrl ?? url;
          // P2-4: version the code that actually went live so an auto-repair is undoable (ย้อนเวอร์ชัน).
          if (!dep.unchanged) await snapshotProject(id, "deploy", { label: "auto-repair" });
        }

        // P2-2: only log a generation when a repair actually ran (tokens > 0). A probe-only pass /
        // authRequired / infra path burned no model tokens — a 0-token row would pollute the arm's
        // ok-rate + error-rate that the A/B decision reads.
        if (inputTokens + outputTokens > 0) {
          const genId = await logGeneration({
            projectId: id,
            userId: user.id,
            provider: repairProvider, // the arm that actually ran the fix (GLM when escalated)
            model: repairCfg.model,
            inputTokens,
            outputTokens,
            cacheReadTokens,
            cacheCreationTokens,
            criticIssues: 0,
            durationMs: Date.now() - startedAt,
            outcome: verified ? "ok" : "error",
          }).catch(() => null);
          // P2-1: make Gate-2 runs ratable — the most information-dense 👍/👎 moment ("did the deployed
          // app actually work for you?"). Was never emitted, so verify runs couldn't be rated at all.
          if (genId) emit({ type: "generation", id: genId });
        }
        emit({ type: "done", tokens: inputTokens + outputTokens });
      } catch (e) {
        console.error("[verify] loop error:", e);
        // Reauth/connection errors carry their code on .code (NeedsReauthError/NotConnectedError),
        // NOT in the message — the old `.test(e.message)` never matched, so users always got the
        // generic dead-end. Classify by instanceof/code instead.
        const code = (e as { code?: string } | null)?.code;
        const needsReauth =
          e instanceof NeedsReauthError ||
          e instanceof NotConnectedError ||
          code === "NEEDS_REAUTH" ||
          code === "NOT_CONNECTED";
        const msg = needsReauth
          ? "การเชื่อมต่อ Google หมดอายุ — เชื่อมต่อใหม่ที่หน้า /connect แล้วลองอีกครั้ง"
          : "ทดสอบ/ซ่อมไม่สำเร็จ ลองใหม่อีกครั้งครับ";
        emit({ type: "text", delta: `\n\n⚠️ ${msg}` });
        emit({ type: "done" });
      } finally {
        await releaseProjectRun(id);
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed by the client's cancel() — ignore */
        }
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
