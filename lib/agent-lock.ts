import { createServiceClient } from "@/lib/supabase/service";

/**
 * Per-project run lock (SECURITY-TODO H-2): stop two agent runs from interleaving on the SAME
 * project (double-clicks, two tabs, retries) — which would interleave file writes/messages and
 * double the Anthropic cost. The egs_agent_runs PK makes acquire atomic; a stale lock left by a
 * crashed/timed-out run is stolen after STALE_MS.
 */

const STALE_MS = 6 * 60 * 1000; // > maxDuration(300s)

export async function acquireProjectRun(projectId: string): Promise<boolean> {
  const svc = createServiceClient();
  const ins = await svc.from("egs_agent_runs").insert({ project_id: projectId }).select("project_id");
  if (!ins.error) return true;
  if (ins.error.code !== "23505") {
    // unknown error → fail open (don't block the user over a guard failure)
    console.error("[agent-lock] acquire error (fail-open):", ins.error.message);
    return true;
  }
  // a run already holds the lock — only steal it if it looks crashed (older than the timeout)
  const { data } = await svc
    .from("egs_agent_runs")
    .select("started_at")
    .eq("project_id", projectId)
    .maybeSingle<{ started_at: string }>();
  if (data && Date.now() - new Date(data.started_at).getTime() > STALE_MS) {
    await svc
      .from("egs_agent_runs")
      .update({ started_at: new Date().toISOString() })
      .eq("project_id", projectId);
    return true;
  }
  return false;
}

export async function releaseProjectRun(projectId: string): Promise<void> {
  const svc = createServiceClient();
  const { error } = await svc.from("egs_agent_runs").delete().eq("project_id", projectId);
  if (error) console.error("[agent-lock] release error:", error.message);
}
