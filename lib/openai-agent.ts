import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
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
const MAX_TOKENS = 16000;

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
}

async function runOpenAiTurn(
  client: OpenAI,
  cfg: ProviderConfig,
  { projectId, project, userMessage, images = [], internal = false, emit }: RunAgentArgs,
): Promise<TurnResult> {
  const system = buildCodegenSystemPrompt({ kind: project.kind });
  const history = (await getRawHistory(projectId)) as Msg[];

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
  let inputTokens = 0;
  let outputTokens = 0;

  for (let iter = 0; iter < (internal ? REPAIR_MAX_ITERATIONS : MAX_ITERATIONS); iter++) {
    const stream = await client.chat.completions.create({
      model: cfg.model,
      max_tokens: MAX_TOKENS,
      messages,
      tools: OPENAI_TOOLS,
      tool_choice: "auto",
      stream: true,
      stream_options: { include_usage: true },
    });

    let text = "";
    const toolAcc: Record<number, { id: string; name: string; args: string }> = {};
    let finish: string | null = null;

    for await (const chunk of stream) {
      if (chunk.usage) {
        inputTokens += chunk.usage.prompt_tokens ?? 0;
        outputTokens += chunk.usage.completion_tokens ?? 0;
      }
      const choice = chunk.choices[0];
      if (!choice) continue;
      if (choice.finish_reason) finish = choice.finish_reason;
      const delta = choice.delta;
      if (delta?.content) {
        text += delta.content;
        emit({ type: "text", delta: delta.content });
      }
      for (const tc of delta?.tool_calls ?? []) {
        const idx = tc.index;
        toolAcc[idx] ??= { id: "", name: "", args: "" };
        if (tc.id) toolAcc[idx].id = tc.id;
        if (tc.function?.name) toolAcc[idx].name = tc.function.name;
        if (tc.function?.arguments) toolAcc[idx].args += tc.function.arguments;
      }
    }

    const calls = Object.keys(toolAcc)
      .map(Number)
      .sort((a, b) => a - b)
      .map((i) => toolAcc[i]);

    if (calls.length === 0) {
      messages.push({ role: "assistant", content: text });
      break;
    }

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

  return { mutated, capped, inputTokens, outputTokens };
}

async function runOpenAiCriticGate(
  client: OpenAI,
  cfg: ProviderConfig,
  args: RunAgentArgs,
): Promise<{ issues: number; inputTokens: number; outputTokens: number }> {
  const { projectId, project, emit } = args;
  try {
    // Working state in the status bar (not chat) — same as the Claude arm.
    emit({ type: "status", text: "กำลังตรวจสอบความถูกต้องของโค้ด…" });
    // consistent yardstick: the SAME Claude reviewer for every arm
    const review = await reviewProject(new Anthropic(), project, projectId);
    if (review.issues.length === 0) {
      emit({ type: "text", delta: "\n\n✓ ตรวจคุณภาพ (rulebook critic) — ผ่าน" });
      return { issues: 0, inputTokens: 0, outputTokens: 0 };
    }
    const lines = review.issues.map((i) => `- [${i.severity}] ${i.file}: ${i.problem} → ${i.fix}`);
    emit({ type: "text", delta: `\n\n🔍 ตรวจคุณภาพพบ ${review.issues.length} จุด:\n${lines.join("\n")}` });

    const actionable = review.issues.filter((i) => i.severity !== "low");
    if (actionable.length === 0) return { issues: review.issues.length, inputTokens: 0, outputTokens: 0 };

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
    return { issues: review.issues.length, inputTokens: repair.inputTokens, outputTokens: repair.outputTokens };
  } catch (e) {
    console.error("[openai-agent] critic gate failed (non-fatal):", e);
    emit({ type: "text", delta: "\n\n(ข้ามการแก้อัตโนมัติรอบนี้ — โค้ดที่สร้างยังใช้ได้)" });
    return { issues: 0, inputTokens: 0, outputTokens: 0 };
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
  let criticIssues = 0;
  if ((args.turn ?? "codegen") === "codegen" && main.mutated) {
    const c = await runOpenAiCriticGate(client, cfg, args);
    criticIssues = c.issues;
    inputTokens += c.inputTokens;
    outputTokens += c.outputTokens;
  }
  return { inputTokens, outputTokens, criticIssues };
}
