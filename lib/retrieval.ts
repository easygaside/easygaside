import type { EgsProject } from "@/types/db";

/**
 * RAG retrieval seam.
 *
 * TODAY: returns empty — easygas runs on the static GAS_RULEBOOK only (lib/gas-codegen.ts). This is
 * intentional for the MVP: the rulebook is small enough to always include + prompt-cache, and there
 * is no verified-project corpus to retrieve from yet, so retrieval would return nothing useful.
 *
 * LATER (docs/RAG-DESIGN.md): embed `egs_knowledge` rows — curated best-practice snippets + files
 * from past projects that ran green and deployed — into Supabase pgvector, retrieve top-K by cosine
 * similarity to `userMessage`, and return them here. Wiring pgvector touches ONLY this function:
 * the agent loop already calls it and injects the result ahead of the user message.
 */

export interface RetrievedContext {
  /** Extra context block prepended to the user message. Empty string = static-rulebook-only mode. */
  text: string;
  /** Source ids of retrieved chunks (for telemetry + a future "อ้างอิงจาก" UI chip). */
  sources: string[];
}

export async function retrieveContext(
  _args: { userMessage: string; project: EgsProject },
): Promise<RetrievedContext> {
  // seam: no retrieval yet. See docs/RAG-DESIGN.md for the pgvector implementation plan.
  return { text: "", sources: [] };
}
