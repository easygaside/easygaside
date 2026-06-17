import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getOwnApiKey } from "@/lib/beta";
import { reviewProject } from "@/lib/critic";
import { getProject } from "@/lib/projects";
import { AGENT_RATE, checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/recheck/[id] — run the Gate-1 rulebook critic on the project's CURRENT files on demand
 * (after the user edits by hand). The client flushes pending autosaves first, so we just read
 * egs_files. Uses the user's own Anthropic key (BYOK) when set, else the platform key.
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

  const apiKey = (await getOwnApiKey(user.id)) ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "no_api_key", issues: [] });

  try {
    const result = await reviewProject(new Anthropic({ apiKey }), project, id);
    return NextResponse.json({ ok: result.ok, issues: result.issues });
  } catch (e) {
    console.error("[recheck] failed:", e);
    // never surface internals — generic system error, empty issues
    return NextResponse.json({ error: "system", issues: [] });
  }
}
