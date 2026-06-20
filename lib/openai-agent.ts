import OpenAI from "openai";
import { buildCodegenSystemPrompt, validateGasFiles } from "@/lib/gas-codegen";
import { reviewProject } from "@/lib/critic";
import { getFiles } from "@/lib/files";
import { appendRawMessages, getRawHistory } from "@/lib/messages";
import {
  EGS_TOOLS,
  executeEgsTool,
  type AgentRunResult,
  type Emit,
  type RunAgentArgs,
} from "@/lib/anthropic-agent";
import type { ProviderConfig } from "@/lib/llm/provider";

/**
 * OpenAI-wire-format agent loop for the A/B (ChatGPT native + DeepSeek via baseURL). Mirrors the
 * Anthropic loop but in OpenAI's messages/tool_calls shape. Reuses executeEgsTool (file ops) and,
 * for the critic, the SAME Claude reviewer as every arm — so "critic issues" is a consistent
 * yardstick across providers. The auto-repair runs on the project's own provider (keeps history
 * format consistent).
 */

const MAX_ITERATIONS = 8;
const REPAIR_MAX_ITERATIONS = 6;
const MAX_TOKENS_FALLBACK = 16000; // used when an arm has no explicit maxOutputTokens (≈ gpt-4o ceiling)
const AUTO_CONTINUE_MAX = 2; // auto-fire "ทำต่อ" this many times when a build caps mid-way

type Msg = OpenAI.Chat.Completions.ChatCompletionMessageParam;

const OPENAI_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = EGS_TOOLS.map((t) => ({
  type: "function",
  function: { name: t.name, description: t.description, parameters: t.input_schema as Record<string, unknown> },
}));

interface TurnResult {
  mutated: boolean;
  capped: boolean;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

async function runOpenAiTurn(
  client: OpenAI,
  cfg: ProviderConfig,
  { projectId, project, userMessage, images = [], internal = false, emit }: RunAgentArgs,
): Promise<TurnResult> {
  // The rulebook goes in the FIRST system message and is byte-identical across turns. OpenAI,
  // DeepSeek and Gemini all auto-cache a stable prompt prefix, so this is what makes caching work
  // on the non-Claude arms — do NOT prepend dynamic content to `system` (it would bust the cache;
  // put any per-turn context on the user message instead, like the Claude arm's RAG seam).
  const system = buildCodegenSystemPrompt({ kind: project.kind });
  // Drop blank assistant turns (a prior empty completion with no text and no tool_calls) — some
  // providers choke when replaying them and just return empty again, snowballing the silence.
  const history = ((await getRawHistory(projectId)) as Msg[]).filter(
    (m) =>
      !(
        m.role === "assistant" &&
        (m.content == null || m.content === "") &&
        !(m as { tool_calls?: unknown[] }).tool_calls?.length
      ),
  );

  // live user turn (images only for vision-capable providers; DeepSeek is text-only)
  const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] | string =
    images.length && cfg.provider !== "deepseek"
      ? [
          { type: "text", text: userMessage },
          ...images.map((img) => ({
            type: "image_url" as const,
            image_url: { url: `data:${img.mediaType};base64,${img.dataBase64}` },
          })),
        ]
      : userMessage;

  const base: Msg[] = [{ role: "system", content: system }, ...history];
  const messages: Msg[] = [...base, { role: "user", content: userContent }];

  let mutated = false;
  let capped = false;
  let emittedText = false;
  let forcedToolRetry = false;
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0; // OpenAI-format providers (DeepSeek/z.ai/…) auto-cache; capture the split

  for (let iter = 0; iter < (internal ? REPAIR_MAX_ITERATIONS : MAX_ITERATIONS); iter++) {
    const stream = await client.chat.completions.create({
      model: cfg.model,
      max_tokens: cfg.maxOutputTokens ?? MAX_TOKENS_FALLBACK,
      messages,
      tools: OPENAI_TOOLS,
      tool_choice: forcedToolRetry ? "required" : "auto",
      stream: true,
      stream_options: { include_usage: true },
    });

    let text = "";
    const toolAcc = new Map<string | number, { id: string; name: string; args: string }>();
    let lastToolKey: string | number | null = null;
    let toolSeq = 0;
    let finish: string | null = null;

    let lastUsage: OpenAI.Completions.CompletionUsage | undefined; // capture ONCE per request
    for await (const chunk of stream) {
      // Some OpenAI-compat providers (DeepSeek notably) emit a `usage` object on MORE than one chunk
      // (the finish chunk AND the trailing empty chunk), each carrying the SAME cumulative request
      // total — so OVERWRITE here and apply exactly once after the stream. Accumulating per-chunk
      // double-counts (~2× on DeepSeek) and inflated the COGS view.
      if (chunk.usage) lastUsage = chunk.usage;
      const choice = chunk.choices[0];
      if (!choice) continue;
      if (choice.finish_reason) finish = choice.finish_reason;
      const delta = choice.delta;
      if (delta?.content) {
        text += delta.content;
        emittedText = true;
        emit({ type: "text", delta: delta.content });
      }
      for (const tc of delta?.tool_calls ?? []) {
        // OpenAI always sends a numeric `index`; Gemini's OpenAI-compat layer often OMITS it (and may
        // deliver a whole call in one delta). Key by index when present; otherwise start a new entry
        // on each `id`, and treat an index-less + id-less delta as a continuation of the last call.
        let key: string | number;
        if (typeof tc.index === "number") key = tc.index;
        else if (tc.id) key = `k${toolSeq++}`;
        else key = lastToolKey ?? `k${toolSeq++}`;
        lastToolKey = key;
        let entry = toolAcc.get(key);
        if (!entry) {
          entry = { id: "", name: "", args: "" };
          toolAcc.set(key, entry);
        }
        if (tc.id) entry.id = tc.id;
        if (tc.function?.name) entry.name = tc.function.name;
        if (tc.function?.arguments) entry.args += tc.function.arguments;
      }
    }

    // bill this request's usage exactly once (per create() call; summed across loop iterations).
    if (lastUsage) {
      const usage = lastUsage;
      // cache hit lives in different fields per provider: DeepSeek = prompt_cache_hit_tokens,
      // OpenAI/z.ai = prompt_tokens_details.cached_tokens. prompt_tokens INCLUDES the cached part,
      // so the full-price input is (prompt_tokens − hit). These providers don't bill cache writes.
      const cacheHit =
        (usage as { prompt_cache_hit_tokens?: number }).prompt_cache_hit_tokens ??
        usage.prompt_tokens_details?.cached_tokens ??
        0;
      inputTokens += Math.max(0, (usage.prompt_tokens ?? 0) - cacheHit);
      cacheReadTokens += cacheHit;
      outputTokens += usage.completion_tokens ?? 0;
    }

    // preserve arrival order; synthesize an id when the provider omits one (Gemini sometimes does) —
    // the assistant tool_calls AND the matching tool results both need a stable, non-empty id.
    const calls = Array.from(toolAcc.values()).map((c, i) => ({
      ...c,
      id: c.id || `call_${i}`,
    }));

    if (calls.length === 0) {
      // Weak tool-users (Gemini's OpenAI-compat) sometimes "describe" the build as chat text on the
      // first step instead of calling write_file. If a non-repair turn opens with text/empty and no
      // tool call, force ONE retry with tool_choice:"required" so files actually get written.
      if (iter === 0 && !forcedToolRetry && !internal) {
        forcedToolRetry = true;
        continue; // re-run this step; any text already streamed stands as a preamble
      }
      messages.push({ role: "assistant", content: text });
      break;
    }
    forcedToolRetry = false; // got tool calls → relax back to auto for subsequent steps

    // assistant turn that requested tools
    messages.push({
      role: "assistant",
      content: text || null,
      tool_calls: calls.map((c) => ({
        id: c.id,
        type: "function",
        function: { name: c.name, arguments: c.args || "{}" },
      })),
    });

    for (const c of calls) {
      let input: Record<string, unknown> = {};
      try {
        input = c.args ? (JSON.parse(c.args) as Record<string, unknown>) : {};
      } catch {
        /* truncated/invalid args → executeEgsTool returns a usable error */
      }
      emit({ type: "tool_call", name: c.name, input });
      const outcome = await executeEgsTool(projectId, c.name, input, emit);
      if (c.name === "write_file" || c.name === "delete_file") mutated = true;
      else if (c.name === "edit_file" && !outcome.isError) mutated = true;
      messages.push({ role: "tool", tool_call_id: c.id, content: outcome.content });
    }

    // project-level lint fed back (parity with the Anthropic loop)
    const all = await getFiles(projectId);
    const plint = validateGasFiles(
      all.map((f) => ({ name: f.path, content: f.content })),
      { isWebApp: project.kind !== "bound" },
    );
    const issues = [...plint.errors, ...plint.warnings].map((i) => i.message);
    if (issues.length > 0) {
      const last = messages[messages.length - 1] as { content: string };
      last.content = `${last.content}\n\n[ตรวจทั้งโปรเจกต์]\n${issues.map((m) => "- " + m).join("\n")}`;
    }

    if (finish !== "tool_calls") {
      capped = finish === "length";
      break;
    }
    if (iter === (internal ? REPAIR_MAX_ITERATIONS : MAX_ITERATIONS) - 1) capped = true;
  }

  // Guard: a provider (notably Gemini's OpenAI-compat) can return an EMPTY completion — no text, no
  // tool calls, no file changes. Never leave the chat dead-silent: surface a recoverable nudge and
  // overwrite the empty assistant turn so the stored history doesn't carry a blank message forward.
  if (!emittedText && !mutated) {
    const fallback =
      "ขออภัย รอบนี้ AI ตอบกลับมาว่าง ๆ (อาจมีจังหวะสะดุด) — ลองพิมพ์สั่งอีกครั้ง ถ้าเพิ่งสรุปสเปคไว้ พิมพ์ “สร้างเลย” เพื่อให้เริ่มเขียนโค้ดได้เลยครับ";
    emit({ type: "text", delta: fallback });
    const lastMsg = messages[messages.length - 1] as { role: string; content: unknown };
    if (lastMsg?.role === "assistant" && (lastMsg.content == null || lastMsg.content === "")) {
      lastMsg.content = fallback;
    }
  }

  // persist this turn's messages (everything after system+history); store the user turn TEXT-only.
  const added = messages.slice(base.length);
  if (added[0]?.role === "user") {
    const note = images.length ? `\n\n(แนบรูปอ้างอิง ${images.length} รูป)` : "";
    added[0] = { role: "user", content: userMessage + note };
  }
  await appendRawMessages(
    projectId,
    added.map((m) => ({ role: m.role, content: m })),
  );

  return { mutated, capped, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens: 0 };
}

async function runOpenAiCriticGate(
  client: OpenAI,
  cfg: ProviderConfig,
  args: RunAgentArgs,
): Promise<{
  issues: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}> {
  const { projectId, project, emit } = args;
  try {
    // Working state in the status bar (not chat) — same as the Claude arm.
    emit({ type: "status", text: "กำลังตรวจสอบความถูกต้องของโค้ด…" });
    // consistent yardstick: the SAME shared rulebook critic for every arm (lib/critic CRITIC_PROVIDER)
    const review = await reviewProject(project, projectId);
    if (review.issues.length === 0) {
      emit({ type: "text", delta: "\n\n✓ ตรวจคุณภาพ (rulebook critic) — ผ่าน" });
      return { issues: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 };
    }
    const lines = review.issues.map((i) => `- [${i.severity}] ${i.file}: ${i.problem} → ${i.fix}`);
    emit({ type: "text", delta: `\n\n🔍 ตรวจคุณภาพพบ ${review.issues.length} จุด:\n${lines.join("\n")}` });

    const actionable = review.issues.filter((i) => i.severity !== "low");
    if (actionable.length === 0)
      return { issues: review.issues.length, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 };

    emit({ type: "status", text: "กำลังแก้ตามผลตรวจคุณภาพ…" });
    const repairMsg =
      "ตรวจคุณภาพ (rulebook critic) พบปัญหาต่อไปนี้ แก้ไฟล์ที่เกี่ยวข้องให้เรียบร้อยด้วย edit_file/write_file:\n" +
      actionable.map((i) => `- ${i.file}: ${i.problem} — แนวทาง: ${i.fix}`).join("\n");
    const repair = await runOpenAiTurn(client, cfg, { ...args, userMessage: repairMsg, internal: true });
    emit({
      type: "text",
      delta: repair.capped
        ? '\n\n✓ แก้ตามผลตรวจคุณภาพบางส่วนแล้ว — ถ้ายังมีจุดค้าง พิมพ์ "แก้ต่อ" ได้ครับ'
        : "\n\n✓ แก้ตามผลตรวจคุณภาพแล้ว",
    });
    return {
      issues: review.issues.length,
      inputTokens: repair.inputTokens,
      outputTokens: repair.outputTokens,
      cacheReadTokens: repair.cacheReadTokens,
      cacheCreationTokens: repair.cacheCreationTokens,
    };
  } catch (e) {
    console.error("[openai-agent] critic gate failed (non-fatal):", e);
    emit({ type: "text", delta: "\n\n⚠️ ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้งภายหลังได้ครับ" });
    return { issues: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 };
  }
}

export async function runOpenAiAgentLoop(
  args: RunAgentArgs,
  cfg: ProviderConfig,
): Promise<AgentRunResult> {
  const client = new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseURL });
  const main = await runOpenAiTurn(client, cfg, args);
  let inputTokens = main.inputTokens;
  let outputTokens = main.outputTokens;
  let cacheReadTokens = main.cacheReadTokens;
  let cacheCreationTokens = main.cacheCreationTokens;
  let criticIssues = 0;
  const isCodegen = (args.turn ?? "codegen") === "codegen";

  // Auto-continue a build that capped mid-way (parity with the Claude loop): fire "ทำต่อ" ourselves a
  // couple of times so big apps finish without the user re-prompting. Each round streams live status.
  let mutated = main.mutated;
  let capped = main.capped;
  for (let round = 1; isCodegen && capped && mutated && round <= AUTO_CONTINUE_MAX; round++) {
    args.emit({ type: "status", text: `เนื้อหายาว — กำลังเขียนต่อให้อัตโนมัติ (${round}/${AUTO_CONTINUE_MAX})…` });
    const cont = await runOpenAiTurn(client, cfg, { ...args, userMessage: "ทำต่อ" });
    inputTokens += cont.inputTokens;
    outputTokens += cont.outputTokens;
    cacheReadTokens += cont.cacheReadTokens;
    cacheCreationTokens += cont.cacheCreationTokens;
    mutated = mutated || cont.mutated;
    capped = cont.capped;
  }

  // Skip the critic when the build is still incomplete (changed nothing, or still capped after auto-
  // continue) — reviewing it would emit a misleading "✓ ผ่าน". The user already saw the "ทำต่อ" nudge.
  if (isCodegen && mutated && !capped && !args.skipCritic) {
    const c = await runOpenAiCriticGate(client, cfg, args);
    criticIssues = c.issues;
    inputTokens += c.inputTokens;
    outputTokens += c.outputTokens;
    cacheReadTokens += c.cacheReadTokens;
    cacheCreationTokens += c.cacheCreationTokens;
  }
  return { inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, criticIssues };
}
