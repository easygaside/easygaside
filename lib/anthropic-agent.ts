import Anthropic from "@anthropic-ai/sdk";
import { buildCodegenSystemPrompt, validateGasFiles } from "@/lib/gas-codegen";
import { reviewProject } from "@/lib/critic";
import { retrieveContext } from "@/lib/retrieval";
import { deleteFile, getFile, getFiles, writeFile } from "@/lib/files";
import { appendMessages, getHistory } from "@/lib/messages";
import { createServiceClient } from "@/lib/supabase/service";
import type { AttachedImage } from "@/lib/chat-images";
import type { EgsProject } from "@/types/db";

/**
 * The easygas agent loop — Claude writes/edits GAS files via tool-use, streamed over SSE.
 * Server owns egs_files; each mutation is echoed to the client. Gate 0 (validateGasFiles) runs
 * after each write and feeds errors back so the model self-corrects within the same turn.
 */

// ── model routing (§A6/A7) ──
const MODEL_CODEGEN = "claude-sonnet-4-6";
const MODEL_PLAN = "claude-opus-4-8";
function pickModel(turn: "codegen" | "plan"): string {
  return turn === "plan" ? MODEL_PLAN : MODEL_CODEGEN;
}

const MAX_ITERATIONS = 8;
const REPAIR_MAX_ITERATIONS = 6; // critic auto-repair — enough for a server+client multi-file fix, still bounded
const MAX_TOKENS = 16000; // higher cap → a big file rarely gets truncated mid-tool_use (would poison history)

// ── project spec (Guided UX §5 — proposed before generating, confirmed by the user) ──
export interface ProjectSpec {
  title: string;
  summary: string;
  features: string[];
  dataModel?: string[];
  storage?: string;
  outputs?: string[];
}

// ── SSE events emitted to the client ──
export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "tool_call"; name: string; input: unknown }
  | { type: "file_mutation"; op: "write" | "edit" | "delete"; path: string; content?: string }
  | { type: "lint"; messages: string[] }
  | { type: "spec"; spec: ProjectSpec }
  | { type: "done" }
  | { type: "error"; message: string };

export type Emit = (ev: AgentEvent) => void;

// ── tool definitions ──
export const EGS_TOOLS: Anthropic.Tool[] = [
  {
    name: "write_file",
    description: "สร้างหรือแทนที่ไฟล์ทั้งไฟล์ (Code.gs / Index.html / appsscript.json ฯลฯ)",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "ชื่อไฟล์ เช่น Code.gs, Index.html, appsscript.json" },
        content: { type: "string", description: "เนื้อหาไฟล์ทั้งหมด" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "edit_file",
    description: "แก้ไฟล์แบบเจาะจงด้วยการแทนข้อความ (old_str ต้องตรงและไม่ซ้ำ)",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        old_str: { type: "string", description: "ข้อความเดิมที่จะแทน (ต้อง unique ในไฟล์)" },
        new_str: { type: "string", description: "ข้อความใหม่" },
      },
      required: ["path", "old_str", "new_str"],
    },
  },
  {
    name: "delete_file",
    description: "ลบไฟล์",
    input_schema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
  {
    name: "read_project",
    description: "อ่านไฟล์ทั้งหมดในโปรเจกต์ปัจจุบัน",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "propose_spec",
    description:
      "สรุปสิ่งที่ผู้ใช้ต้องการเป็น spec แล้วแสดงให้ผู้ใช้ยืนยันก่อนเขียนโค้ด — เรียกตอนเริ่มงานใหม่ที่ยังไม่ยืนยัน แล้วหยุดรอผู้ใช้ (อย่าเขียนไฟล์ในเทิร์นเดียวกัน)",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "ชื่อระบบสั้น ๆ" },
        summary: { type: "string", description: "สรุประบบ 1-2 ประโยค" },
        features: { type: "array", items: { type: "string" }, description: "ฟีเจอร์หลักเป็นข้อ ๆ" },
        dataModel: {
          type: "array",
          items: { type: "string" },
          description: "ข้อมูล/คอลัมน์ที่เก็บ เช่น ชื่อ, เบอร์โทร, วันที่",
        },
        storage: { type: "string", description: "ที่เก็บข้อมูล เช่น 'Google Sheet ใหม่' หรือ 'ชีทเดิม (ลิงก์)'" },
        outputs: {
          type: "array",
          items: { type: "string" },
          description: "ผลลัพธ์/การกระทำ เช่น ส่งอีเมลยืนยัน, พิมพ์ PDF",
        },
      },
      required: ["title", "summary", "features"],
    },
  },
];

interface ToolOutcome {
  content: string;
  isError: boolean;
}

/**
 * Path allowlist — the AI controls the file path; only flat GAS file names are valid.
 * Blocks path traversal / odd names that would corrupt the deployed Apps Script project.
 */
const VALID_GAS_PATH = /^[A-Za-z0-9_-]+\.(gs|html|json)$/;
function isValidGasPath(p: string): boolean {
  return VALID_GAS_PATH.test(p) && !p.includes("..") && !p.includes("/") && !p.includes("\\");
}

async function lintWritten(path: string, content: string, emit: Emit): Promise<ToolOutcome> {
  const { errors } = validateGasFiles([{ name: path, content }], { isWebApp: false });
  if (errors.length > 0) {
    const messages = errors.map((e) => e.message);
    emit({ type: "lint", messages });
    return {
      isError: true,
      content: `บันทึก ${path} แล้ว แต่ผิดกติกา GAS:\n${messages.map((m) => "- " + m).join("\n")}\nแก้แล้วบันทึกใหม่`,
    };
  }
  return { isError: false, content: `บันทึก ${path} เรียบร้อย` };
}

async function executeEgsTool(
  projectId: string,
  name: string,
  input: Record<string, unknown>,
  emit: Emit,
): Promise<ToolOutcome> {
  try {
    if (
      (name === "write_file" || name === "edit_file" || name === "delete_file") &&
      !isValidGasPath(String(input.path ?? ""))
    ) {
      return {
        isError: true,
        content: `ชื่อไฟล์ไม่ถูกต้อง: "${String(input.path ?? "")}" — ใช้ได้เฉพาะ <ชื่อ>.gs / <ชื่อ>.html / appsscript.json (ห้ามมี / หรือ ..)`,
      };
    }
    if (name === "write_file") {
      const path = String(input.path);
      const content = String(input.content ?? "");
      await writeFile(projectId, path, content);
      emit({ type: "file_mutation", op: "write", path, content });
      return lintWritten(path, content, emit);
    }
    if (name === "edit_file") {
      const path = String(input.path);
      const oldStr = String(input.old_str ?? "");
      const newStr = String(input.new_str ?? "");
      const file = await getFile(projectId, path);
      if (!file) return { isError: true, content: `ไม่พบไฟล์ ${path}` };
      const occurrences = file.content.split(oldStr).length - 1;
      if (occurrences === 0) return { isError: true, content: `ไม่พบข้อความที่จะแก้ใน ${path}` };
      if (occurrences > 1)
        return { isError: true, content: `พบข้อความซ้ำ ${occurrences} ที่ใน ${path} — ใส่ context ให้ unique` };
      const updated = file.content.replace(oldStr, newStr);
      await writeFile(projectId, path, updated);
      emit({ type: "file_mutation", op: "edit", path, content: updated });
      return lintWritten(path, updated, emit);
    }
    if (name === "delete_file") {
      const path = String(input.path);
      await deleteFile(projectId, path);
      emit({ type: "file_mutation", op: "delete", path });
      return { isError: false, content: `ลบ ${path} แล้ว` };
    }
    if (name === "read_project") {
      const files = await getFiles(projectId);
      const body = files.map((f) => `=== ${f.path} ===\n${f.content}`).join("\n\n");
      return { isError: false, content: body || "(ยังไม่มีไฟล์)" };
    }
    if (name === "propose_spec") {
      const spec: ProjectSpec = {
        title: String(input.title ?? ""),
        summary: String(input.summary ?? ""),
        features: Array.isArray(input.features) ? input.features.map(String) : [],
        dataModel: Array.isArray(input.dataModel) ? input.dataModel.map(String) : undefined,
        storage: input.storage ? String(input.storage) : undefined,
        outputs: Array.isArray(input.outputs) ? input.outputs.map(String) : undefined,
      };
      // persist (merge — keep creation-time keys like webOnlyReasons) for later re-check
      try {
        const svc = createServiceClient();
        const { data } = await svc
          .from("egs_projects")
          .select("spec")
          .eq("id", projectId)
          .maybeSingle<{ spec: Record<string, unknown> | null }>();
        await svc
          .from("egs_projects")
          .update({ spec: { ...(data?.spec ?? {}), ...spec }, updated_at: new Date().toISOString() })
          .eq("id", projectId);
      } catch (e) {
        console.error("[agent] store spec failed:", e);
      }
      emit({ type: "spec", spec });
      return {
        isError: false,
        content:
          "แสดงสรุป spec ให้ผู้ใช้แล้ว — จบเทิร์นนี้ รอผู้ใช้กด 'สร้างเลย' หรือบอกที่อยากแก้ ก่อนค่อยเขียนไฟล์ (อย่าเรียก tool อื่นต่อในเทิร์นนี้)",
      };
    }
    return { isError: true, content: `ไม่รู้จัก tool: ${name}` };
  } catch (e) {
    console.error(`[agent] tool ${name} failed:`, e);
    return { isError: true, content: `เครื่องมือ ${name} ทำงานผิดพลาด — ลองใหม่หรือปรับวิธี` };
  }
}

export interface RunAgentArgs {
  projectId: string;
  project: EgsProject;
  userMessage: string;
  /** Reference images attached to this turn (already stored by the route). Fed to the model once. */
  images?: AttachedImage[];
  turn?: "codegen" | "plan";
  /** iteration cap for this turn (critic repair passes a smaller value). Defaults to MAX_ITERATIONS. */
  maxIterations?: number;
  /** internal turn (e.g. the critic auto-repair) — suppresses user-facing "hit the cap" notes */
  internal?: boolean;
  emit: Emit;
}

export async function runAgentLoop(args: RunAgentArgs): Promise<void> {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY
  const { mutated } = await runTurn(client, args);
  // Gate 1 — rulebook critic + one bounded auto-repair. Only when this turn actually changed files:
  // a pure Q&A turn ("ปกติไหม?") writes nothing, so re-reviewing the whole project there is wasted
  // cost + noise (and makes it look like it's checking on a loop). Skip plan turns too.
  if ((args.turn ?? "codegen") === "codegen" && mutated) {
    await runCriticGate(client, args);
  }
  args.emit({ type: "done" });
}

/**
 * One model turn: stream → resolve tool_use in a loop → persist. Does NOT emit `done`.
 * Returns whether any file was created/edited/deleted this turn (gates the critic).
 */
async function runTurn(
  client: Anthropic,
  {
    projectId,
    project,
    userMessage,
    images = [],
    turn = "codegen",
    maxIterations = MAX_ITERATIONS,
    internal = false,
    emit,
  }: RunAgentArgs,
): Promise<{ mutated: boolean; capped: boolean }> {
  const history = await getHistory(projectId);

  // RAG seam (lib/retrieval.ts) — empty today. Prepended to the user message so the cached
  // system block stays byte-identical (preserves the prompt-cache hit).
  const retrieved = await retrieveContext({ userMessage, project });
  const effectiveUserMessage = retrieved.text
    ? `${retrieved.text}\n\n---\n${userMessage}`
    : userMessage;

  // Multimodal: when reference images are attached, the user turn is an [image…, text] block array;
  // otherwise keep it a plain string (cheaper, and the common path). media_type is pre-validated
  // against the Anthropic image union in parseAttachedImages.
  const userContent: Anthropic.MessageParam["content"] = images.length
    ? [
        ...images.map(
          (img): Anthropic.ImageBlockParam => ({
            type: "image",
            source: {
              type: "base64",
              media_type: img.mediaType as Anthropic.Base64ImageSource["media_type"],
              data: img.dataBase64,
            },
          }),
        ),
        { type: "text", text: effectiveUserMessage } satisfies Anthropic.TextBlockParam,
      ]
    : effectiveUserMessage;

  const messages: Anthropic.MessageParam[] = [
    ...history,
    { role: "user", content: userContent },
  ];

  // cache the static GAS rulebook (model-scoped — keep byte-identical)
  const system: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: buildCodegenSystemPrompt({ kind: project.kind }),
      cache_control: { type: "ephemeral" },
    },
  ];

  let mutated = false; // did any write/edit/delete actually change a file this turn?
  let capped = false; // did the turn stop early (iteration cap / truncation) with work pending?
  for (let iter = 0; iter < maxIterations; iter++) {
    const stream = client.messages.stream({
      model: pickModel(turn),
      max_tokens: MAX_TOKENS,
      system,
      tools: EGS_TOOLS,
      messages,
    });
    stream.on("text", (delta: string) => emit({ type: "text", delta }));

    const final = await stream.finalMessage();

    // Truncated mid-tool_use (e.g. stop_reason "max_tokens" while emitting a large write_file):
    // the assistant message carries a tool_use we can't resolve. Persisting it poisons history
    // ("tool_use ids without tool_result" → every later request 400s). Keep only the text and stop.
    if (final.stop_reason !== "tool_use" && final.content.some((b) => b.type === "tool_use")) {
      const textBlocks = final.content.filter((b) => b.type === "text");
      messages.push({
        role: "assistant",
        content: (textBlocks.length
          ? textBlocks
          : "เนื้อหายาวเกินรอบเดียว") as Anthropic.MessageParam["content"],
      });
      capped = true;
      if (!internal)
        emit({
          type: "text",
          delta: '\n\n(เนื้อหายาวเกินขีดจำกัดรอบเดียว — พิมพ์ "ทำต่อ" ให้เขียนส่วนที่เหลือได้ครับ)',
        });
      break;
    }

    messages.push({
      role: "assistant",
      content: final.content as Anthropic.MessageParam["content"],
    });

    if (final.stop_reason !== "tool_use") break;

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of final.content) {
      if (block.type !== "tool_use") continue;
      emit({ type: "tool_call", name: block.name, input: block.input });
      const outcome = await executeEgsTool(
        projectId,
        block.name,
        block.input as Record<string, unknown>,
        emit,
      );
      if (block.name === "write_file" || block.name === "delete_file") mutated = true;
      else if (block.name === "edit_file" && !outcome.isError) mutated = true;
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: outcome.content,
        is_error: outcome.isError,
      });
    }

    // project-level lint (catches missing required files across the whole project)
    if (toolResults.length > 0) {
      const all = await getFiles(projectId);
      const plint = validateGasFiles(
        all.map((f) => ({ name: f.path, content: f.content })),
        { isWebApp: project.kind !== "bound" },
      );
      const issues = [...plint.errors, ...plint.warnings].map((i) => i.message);
      if (issues.length > 0) {
        const lastTr = toolResults[toolResults.length - 1];
        lastTr.content = `${lastTr.content}\n\n[ตรวจทั้งโปรเจกต์]\n${issues.map((m) => "- " + m).join("\n")}`;
      }
    }
    messages.push({ role: "user", content: toolResults });
  }

  // If we exited capped on a pending tool_use, the tail is a dangling tool_result (role:user)
  // preceded by an assistant tool_use with no resolution. Persisting that breaks the next request
  // (consecutive user msgs / unresolved tool_use). Roll back to a clean assistant turn.
  const tail = messages[messages.length - 1];
  const dangling =
    tail?.role === "user" &&
    Array.isArray(tail.content) &&
    tail.content.some((b) => (b as { type?: string }).type === "tool_result");
  if (dangling) {
    capped = true;
    messages.pop(); // tool_result (user)
    messages.pop(); // assistant tool_use turn
    // user-facing note only for the user's OWN turn; the critic's internal repair handles this via
    // its own close-out so the note doesn't leak into chat (and contradict "✓ แก้แล้ว").
    const note = internal
      ? "(แก้บางส่วนในรอบตรวจคุณภาพ)"
      : "หยุดไว้ก่อน — ถึงขีดจำกัดรอบการแก้ในเทิร์นนี้ พิมพ์บอกต่อได้เลยครับ";
    if (!internal) emit({ type: "text", delta: "\n" + note });
    messages.push({ role: "assistant", content: note });
  }

  // persist the new turn(s) for resume (egs_files is the source of truth for code).
  // Store the user's ORIGINAL message as TEXT only — never the RAG-injected prefix nor the
  // image blocks. This keeps history lean and avoids re-feeding stale context / re-billing image
  // tokens on every later turn (the bucket keeps the images as the project's reference history).
  const persisted = messages.slice(history.length);
  if (persisted[0]?.role === "user" && (retrieved.text || images.length)) {
    const note = images.length ? `\n\n(แนบรูปอ้างอิง ${images.length} รูป)` : "";
    persisted[0] = { role: "user", content: userMessage + note };
  }
  await appendMessages(projectId, persisted, turn);
  return { mutated, capped };
}

/**
 * Gate 1 — rulebook critic (QUALITY-MOAT §2). One cheap LLM-as-judge review that catches semantic
 * best-practice violations gate 0 (regex lint) cannot, then runs ONE bounded auto-repair turn.
 * Findings are surfaced through the existing `text`/`lint` events (no client change). Non-fatal:
 * a critic failure never blocks the user's result.
 */
async function runCriticGate(client: Anthropic, args: RunAgentArgs): Promise<void> {
  const { projectId, project, emit } = args;
  try {
    const review = await reviewProject(client, project, projectId);
    if (review.issues.length === 0) {
      emit({ type: "text", delta: "\n\n✓ ตรวจคุณภาพ (rulebook critic) — ผ่าน" });
      return;
    }

    const lines = review.issues.map(
      (i) => `- [${i.severity}] ${i.file}: ${i.problem} → ${i.fix}`,
    );
    emit({ type: "text", delta: `\n\n🔍 ตรวจคุณภาพพบ ${review.issues.length} จุด:\n${lines.join("\n")}` });
    emit({ type: "lint", messages: review.issues.map((i) => `${i.file}: ${i.problem}`) });

    const actionable = review.issues.filter((i) => i.severity !== "low");
    if (actionable.length === 0) return;

    emit({ type: "text", delta: "\n\nกำลังแก้ให้อัตโนมัติ…\n" });
    const repairMsg =
      "ตรวจคุณภาพ (rulebook critic) พบปัญหาต่อไปนี้ แก้ไฟล์ที่เกี่ยวข้องให้เรียบร้อยด้วย edit_file/write_file:\n" +
      actionable.map((i) => `- ${i.file}: ${i.problem} — แนวทาง: ${i.fix}`).join("\n");
    const repair = await runTurn(client, {
      ...args,
      userMessage: repairMsg,
      turn: "codegen",
      maxIterations: REPAIR_MAX_ITERATIONS,
      internal: true,
    });
    emit({
      type: "text",
      delta: repair.capped
        ? '\n\n✓ แก้ตามผลตรวจคุณภาพบางส่วนแล้ว — ถ้ายังมีจุดค้าง พิมพ์ "แก้ต่อ" ได้ครับ'
        : "\n\n✓ แก้ตามผลตรวจคุณภาพแล้ว",
    });
  } catch (e) {
    // never leave the "กำลังแก้ให้อัตโนมัติ…" line hanging — close it out visibly.
    console.error("[agent] critic gate failed (non-fatal):", e);
    emit({ type: "text", delta: "\n\n(ข้ามการแก้อัตโนมัติรอบนี้ — โค้ดที่สร้างยังใช้ได้ พิมพ์บอกถ้าอยากให้แก้จุดไหน)" });
  }
}
