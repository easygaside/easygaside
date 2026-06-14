import type Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/service";
import type { MessageRole, TurnType } from "@/types/db";

/**
 * egs_messages history (server-only). Stores Anthropic content blocks verbatim (jsonb) so the
 * agent loop can resume after disconnect / maxDuration.
 */

export async function getHistory(
  projectId: string,
): Promise<Anthropic.MessageParam[]> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("egs_messages")
    .select("role, content")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`getHistory: ${error.message}`);
  return (data ?? []).map((m) => ({
    role: m.role as MessageRole,
    content: m.content as Anthropic.MessageParam["content"],
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
