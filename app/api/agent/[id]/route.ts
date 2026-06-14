import { NextResponse, type NextRequest } from "next/server";
import { runAgentLoop, type AgentEvent } from "@/lib/anthropic-agent";
import { getProject } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300; // needs Vercel Pro for >60s; fine for local dev

/**
 * POST /api/agent/[id]  body: { message: string }
 * Streams the agent loop as SSE (text deltas, tool_call, file_mutation, lint, done).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const project = await getProject(id); // RLS-scoped → null if not owned
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let message = "";
  try {
    const body = (await req.json()) as { message?: string };
    message = (body.message ?? "").trim();
  } catch {
    /* empty body */
  }
  if (!message) return NextResponse.json({ error: "empty_message" }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const emit = (ev: AgentEvent) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
      };
      try {
        await runAgentLoop({ projectId: id, project, userMessage: message, emit });
      } catch (e) {
        console.error("[agent] loop error:", e);
        emit({ type: "error", message: "agent_error" });
      } finally {
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
