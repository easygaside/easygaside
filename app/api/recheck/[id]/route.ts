import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getOwnApiKey } from "@/lib/beta";
import { reviewProject, type CriticIssue } from "@/lib/critic";
import { getFiles } from "@/lib/files";
import { validateGasFiles } from "@/lib/gas-codegen";
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

  // Gate 1 — rulebook critic (best-effort; needs an Anthropic key)
  let gate1: CriticIssue[] = [];
  let criticError = false;
  const apiKey = (await getOwnApiKey(user.id)) ?? process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const r = await reviewProject(new Anthropic({ apiKey }), project, id);
      gate1 = r.issues;
    } catch (e) {
      console.error("[recheck] critic failed:", e);
      criticError = true;
    }
  } else {
    criticError = true;
  }

  return NextResponse.json({ issues: [...gate0, ...gate1], criticError });
}
