import { createServiceClient } from "@/lib/supabase/service";

/**
 * Per-project run lock (SECURITY-TODO H-2): stop two agent runs from interleaving on the SAME
 * project (double-clicks, two tabs, retries) — which would interleave file writes/messages and
 * double the Anthropic cost. The egs_agent_runs PK makes acquire atomic; a stale lock left by a
 * crashed/timed-out run is stolen after STALE_MS.
 */

const STALE_MS = 6 * 60 * 1000; // reclaim window if a container restart drops a run mid-flight (Railway = no per-request timeout)

export async function acquireProjectRun(projectId: string): Promise<boolean> {
  const svc = createServiceClient();
  const ins = await svc.from("egs_agent_runs").insert({ project_id: projectId }).select("project_id");
  if (!ins.error) return true;
  if (ins.error.code !== "23505") {
    // unknown error → fail open (don't block the user over a guard failure)
    console.error("[agent-lock] acquire error (fail-open):", ins.error.message);
    return true;
  }
  // a run already holds the lock — only steal it if it looks crashed (older than the timeout). Do the
  // check-and-steal ATOMICALLY as a conditional UPDATE: if two requests race past STALE_MS, only the
  // one whose UPDATE matches the still-stale row wins; the other matches nothing → false. (Was a racy
  // read-then-update that let BOTH in.)
  const cutoff = new Date(Date.now() - STALE_MS).toISOString();
  const { data: stolen } = await svc
    .from("egs_agent_runs")
    .update({ started_at: new Date().toISOString() })
    .eq("project_id", projectId)
    .lt("started_at", cutoff)
    .select("project_id");
  return !!(stolen && stolen.length > 0);
}

export async function releaseProjectRun(projectId: string): Promise<void> {
  const svc = createServiceClient();
  const { error } = await svc.from("egs_agent_runs").delete().eq("project_id", projectId);
  if (error) console.error("[agent-lock] release error:", error.message);
}
