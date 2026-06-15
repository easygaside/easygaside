import type Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/service";
import type { MessageRole, TurnType } from "@/types/db";

/**
 * egs_messages history (server-only). Stores Anthropic content blocks verbatim (jsonb) so the
 * agent loop can resume after disconnect / maxDuration.
 */

// Context compaction: full file contents live in egs_files (source of truth), so we strip the bulky
// payloads out of OLD tool blocks before re-sending history to the model. This keeps a big project
// or a long edit session from ballooning the context window — without it, every past write_file's
// full file content (and read_project dump) would be re-sent on every turn. The model fetches
// current code with read_project when it needs it. Structure (tool_use/tool_result ids) is kept
// intact so the message sequence stays API-valid.
const MAX_TOOL_RESULT_CHARS = 200;

function compactContent(content: unknown): unknown {
  if (!Array.isArray(content)) return content;
  return content.map((block) => {
    if (!block || typeof block !== "object") return block;
    const b = block as Record<string, unknown>;
    if (b.type === "tool_use" && b.input && typeof b.input === "object") {
      const input = { ...(b.input as Record<string, unknown>) };
      if (typeof input.content === "string" && input.content.length > 0)
        input.content = `<โค้ดถูกตัดจากประวัติ (${input.content.length} ตัวอักษร) — เรียก read_project เพื่อดูโค้ดล่าสุด>`;
      if (typeof input.new_str === "string" && input.new_str.length > MAX_TOOL_RESULT_CHARS)
        input.new_str = `<ตัด ${input.new_str.length} ตัวอักษร>`;
      if (typeof input.old_str === "string" && input.old_str.length > MAX_TOOL_RESULT_CHARS)
        input.old_str = `<ตัด ${input.old_str.length} ตัวอักษร>`;
      return { ...b, input };
    }
    if (b.type === "tool_result" && typeof b.content === "string" && b.content.length > MAX_TOOL_RESULT_CHARS)
      return { ...b, content: b.content.slice(0, MAX_TOOL_RESULT_CHARS) + " …<ตัดส่วนที่เหลือ>" };
    return block;
  });
}

export async function getHistory(
  projectId: string,
): Promise<Anthropic.MessageParam[]> {
  const svc = createServiceClient();
  // Order by the monotonic seq, NOT created_at: a whole turn is inserted in one batch and shares an
  // identical created_at, so created_at ordering is nondeterministic and can split a tool_use from
  // its tool_result (→ Anthropic 400). seq reflects insertion order.
  const { data, error } = await svc
    .from("egs_messages")
    .select("role, content")
    .eq("project_id", projectId)
    .order("seq", { ascending: true });
  if (error) throw new Error(`getHistory: ${error.message}`);
  return (data ?? []).map((m) => ({
    role: m.role as MessageRole,
    content: compactContent(m.content) as Anthropic.MessageParam["content"],
  }));
}

export async function appendMessages(
  projectId: string,
  msgs: Anthropic.MessageParam[],
  turnType: TurnType = "codegen",
): Promise<void> {
  if (msgs.length === 0) return;
  const svc = createServiceClient();
  const rows = msgs.map((m) => ({
    project_id: projectId,
    role: m.role,
    content: m.content as unknown,
    turn_type: turnType,
  }));
  const { error } = await svc.from("egs_messages").insert(rows);
  if (error) throw new Error(`appendMessages: ${error.message}`);
}

/**
 * Provider-neutral history for the OpenAI-format loop (ChatGPT/DeepSeek). content jsonb holds the
 * FULL provider message object (incl. tool_calls / tool_call_id), so we store + return it verbatim.
 * Ordered by seq (stable). No compaction yet (acceptable for the A/B's mostly-short sessions).
 */
export async function getRawHistory(projectId: string): Promise<unknown[]> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("egs_messages")
    .select("content")
    .eq("project_id", projectId)
    .order("seq", { ascending: true });
  if (error) throw new Error(`getRawHistory: ${error.message}`);
  return (data ?? []).map((m) => m.content);
}

export async function appendRawMessages(
  projectId: string,
  msgs: { role: string; content: unknown }[],
  turnType: TurnType = "codegen",
): Promise<void> {
  if (msgs.length === 0) return;
  const svc = createServiceClient();
  const rows = msgs.map((m) => ({
    project_id: projectId,
    role: m.role,
    content: m.content as unknown,
    turn_type: turnType,
  }));
  const { error } = await svc.from("egs_messages").insert(rows);
  if (error) throw new Error(`appendRawMessages: ${error.message}`);
}
