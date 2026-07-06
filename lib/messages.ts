import type Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/service";
import type { MessageRole, TurnType } from "@/types/db";

/**
 * egs_messages history (server-only). Stores Anthropic content blocks verbatim (jsonb) so the
 * agent loop can resume after a disconnect or a container restart.
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

/**
 * Drop orphan tool_use / tool_result blocks so a HALF-persisted turn (a mid-loop throw, or a
 * container restart that skipped the flush — P0-3) can't 400 the next request ("unresolved tool_use"
 * / "tool_result without tool_use"). A well-formed history passes through unchanged.
 */
function sanitizeAnthropicHistory(
  msgs: Anthropic.MessageParam[],
): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = [];
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    if (!Array.isArray(m.content)) {
      out.push(m);
      continue;
    }
    if (m.role === "assistant") {
      // keep a tool_use only if the NEXT message answers it with a matching tool_result
      const next = msgs[i + 1];
      const nextBlocks = next && Array.isArray(next.content) ? next.content : [];
      const resultIds = new Set(
        nextBlocks
          .filter((b) => (b as { type?: string }).type === "tool_result")
          .map((b) => (b as { tool_use_id?: string }).tool_use_id),
      );
      const kept = m.content.filter((b) =>
        (b as { type?: string }).type === "tool_use"
          ? resultIds.has((b as { id?: string }).id)
          : true,
      );
      if (kept.length > 0) out.push({ ...m, content: kept });
    } else {
      // keep a tool_result only if the PREVIOUS kept message is an assistant with the matching tool_use
      const prev = out[out.length - 1];
      const prevBlocks =
        prev && prev.role === "assistant" && Array.isArray(prev.content) ? prev.content : [];
      const useIds = new Set(
        prevBlocks
          .filter((b) => (b as { type?: string }).type === "tool_use")
          .map((b) => (b as { id?: string }).id),
      );
      const kept = m.content.filter((b) =>
        (b as { type?: string }).type === "tool_result"
          ? useIds.has((b as { tool_use_id?: string }).tool_use_id)
          : true,
      );
      if (kept.length > 0) out.push({ ...m, content: kept });
    }
  }
  return out;
}

/**
 * Remove a trailing INCOMPLETE tool round from OpenAI-format history: an assistant whose tool_calls
 * aren't all answered by following `tool` messages (a mid-loop throw / hard kill between emitting the
 * tool_calls and writing every tool result) would 400 the next request. Complete/plain histories pass
 * through unchanged. (P0-3 backstop; also reused by the OpenAI loop's flush.)
 */
export function trimIncompleteOpenAiTail(msgs: unknown[]): unknown[] {
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i] as { role?: string; tool_calls?: { id?: string }[] } | null;
    if (!m) return msgs;
    if (m.role === "tool") continue; // a trailing tool → keep scanning back to its assistant
    if (m.role !== "assistant") return msgs; // clean tail (user / plain assistant text handled below)
    if (!Array.isArray(m.tool_calls) || m.tool_calls.length === 0) return msgs; // plain assistant tail
    const answered = new Set(
      msgs
        .slice(i + 1)
        .map((x) => x as { role?: string; tool_call_id?: string })
        .filter((x) => x.role === "tool")
        .map((x) => x.tool_call_id),
    );
    return m.tool_calls.every((tc) => answered.has(tc.id)) ? msgs : msgs.slice(0, i);
  }
  return msgs;
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
  return sanitizeAnthropicHistory(
    (data ?? []).map((m) => ({
      role: m.role as MessageRole,
      content: compactContent(m.content) as Anthropic.MessageParam["content"],
    })),
  );
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
export async function getRawHistory(
  projectId: string,
  opts: { stripReasoning?: boolean } = {},
): Promise<unknown[]> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("egs_messages")
    .select("content")
    .eq("project_id", projectId)
    .order("seq", { ascending: true });
  if (error) throw new Error(`getRawHistory: ${error.message}`);
  const rows = trimIncompleteOpenAiTail((data ?? []).map((m) => m.content));
  if (!opts.stripReasoning) return rows;
  // Escalated repair on a DIFFERENT arm (e.g. deepseek-pro project → GLM): the stored history carries
  // deepseek's OWN reasoning_content on assistant messages, which another model must not receive.
  return rows.map((m) => {
    if (m && typeof m === "object" && "reasoning_content" in (m as Record<string, unknown>)) {
      const rest = { ...(m as Record<string, unknown>) };
      delete rest.reasoning_content;
      return rest;
    }
    return m;
  });
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
