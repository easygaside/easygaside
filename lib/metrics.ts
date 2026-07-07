import { createServiceClient } from "@/lib/supabase/service";
import type { LlmProvider } from "@/lib/llm/provider";

/**
 * Per-generation metrics for the A/B experiment. Best-effort — a logging failure never affects the
 * user's result. Returns the row id so the client can attach a 👍/👎 rating later.
 */
export interface GenerationMetric {
  projectId: string;
  userId: string;
  provider: LlmProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Anthropic cache split (true COGS — billed differently than fresh input). 0 for providers w/o cache. */
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  criticIssues: number;
  /** How the rulebook critic ran: null|clean|issues|skipped|degraded — excludes non-verdicts from
   *  the trustworthy clean-rate (v2 audit P1-1/1-3). */
  criticStatus?: string | null;
  durationMs: number;
  outcome: "ok" | "error";
}

export async function logGeneration(m: GenerationMetric): Promise<string | null> {
  try {
    const svc = createServiceClient();
    const { data, error } = await svc
      .from("egs_generations")
      .insert({
        project_id: m.projectId,
        user_id: m.userId,
        provider: m.provider,
        model: m.model,
        input_tokens: m.inputTokens,
        output_tokens: m.outputTokens,
        cache_read_tokens: m.cacheReadTokens ?? 0,
        cache_creation_tokens: m.cacheCreationTokens ?? 0,
        critic_issues: m.criticIssues,
        critic_status: m.criticStatus ?? null,
        duration_ms: m.durationMs,
        outcome: m.outcome,
      })
      .select("id")
      .single();
    if (error) {
      console.error("[metrics] logGeneration failed:", error.message);
      return null;
    }
    return (data as { id: string }).id;
  } catch (e) {
    console.error("[metrics] logGeneration error:", e);
    return null;
  }
}
