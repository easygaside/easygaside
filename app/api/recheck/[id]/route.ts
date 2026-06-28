import { NextResponse, type NextRequest } from "next/server";
import { getOwnApiKey } from "@/lib/beta";
import { POOL_EXHAUSTED_MSG, getMonthlyPool, getUserMonthlyEnergyUsed } from "@/lib/energy";
import { reviewProject, getCriticInfo, type CriticIssue } from "@/lib/critic";
import { getFiles } from "@/lib/files";
import { validateGasFiles } from "@/lib/gas-codegen";
import { logGeneration } from "@/lib/metrics";
import { getProject } from "@/lib/projects";
import { AGENT_RATE, checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/recheck/[id] — re-check the project's CURRENT files on demand (after manual edits):
 *   Gate 0 = regex/structure lint (free, deterministic)  +  Gate 1 = rulebook critic (LLM-as-judge).
 * Gate 0 always runs; Gate 1 is best-effort and uses the user's own Anthropic key (BYOK) when set.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  if (!(await checkRateLimit(user.id, AGENT_RATE)))
    return NextResponse.json(
      { error: "rate_limited", issues: [], message: "ตรวจถี่เกินไป — รอสักครู่แล้วลองใหม่" },
      { status: 429 },
    );

  const project = await getProject(id); // RLS-scoped → null if not owned
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // monthly credit pool — platform-key users are capped; BYOK (own key) bypasses (own cost)
  if (!(await getOwnApiKey(user.id))) {
    const used = await getUserMonthlyEnergyUsed(user.id);
    if (used >= (await getMonthlyPool(user.email)))
      return NextResponse.json(
        { error: "energy_exhausted", issues: [], message: POOL_EXHAUSTED_MSG },
        { status: 429 },
      );
  }

  // Gate 0 — structural lint (no API, never fails the request)
  const gas = await getFiles(id);
  const lint = validateGasFiles(
    gas.map((f) => ({ name: f.path, content: f.content })),
    { isWebApp: project.kind !== "bound" },
  );
  const gate0: CriticIssue[] = [...lint.errors, ...lint.warnings].map((e) => ({
    file: e.file,
    severity: e.severity === "error" ? "high" : "medium",
    problem: e.message,
    fix: "",
  }));

  // Gate 1 — shared rulebook critic (best-effort; runs on whatever critic backend is wired to)
  const critic = await getCriticInfo();
  let gate1: CriticIssue[] = [];
  let criticError = false;
  let tokens = 0;
  if (critic.configured) {
    const startedAt = Date.now();
    try {
      const r = await reviewProject(project, id);
      gate1 = r.issues;
      tokens = r.inputTokens + r.outputTokens;
      // meter it: count toward the per-project energy budget (same as a generation)
      await logGeneration({
        projectId: id,
        userId: user.id,
        provider: critic.provider,
        model: critic.model,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        cacheReadTokens: r.cacheReadTokens,
        cacheCreationTokens: r.cacheCreationTokens,
        criticIssues: gate1.length,
        durationMs: Date.now() - startedAt,
        outcome: "ok",
      }).catch(() => {});
    } catch (e) {
      console.error("[recheck] critic failed:", e);
      criticError = true;
    }
  } else {
    criticError = true;
  }

  return NextResponse.json({ issues: [...gate0, ...gate1], criticError, tokens });
}
