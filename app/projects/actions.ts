"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { detectCapabilityNeeds, routeTarget } from "@/lib/deployment-targets";
import { MonthlyToolLimitError } from "@/lib/errors";
import { getValidAccessToken } from "@/lib/google-connection";
import { providerConfig, type LlmProvider } from "@/lib/llm/catalog";
import { PLAN_CONFIG, getUserPlan, isPaidPlan } from "@/lib/plan";
import { createProject } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/** Shared "ครบโควตาสร้างใหม่" message for the create entry points. */
function toolLimitMessage(limit: number): string {
  return `ครบโควตาสร้างเครื่องมือใหม่ของเดือนนี้แล้ว (แผน Free ${limit} ตัว) — รอต้นเดือนหน้า หรือใส่ Anthropic key ของคุณในหน้า ตั้งค่า เพื่อสร้างไม่จำกัด`;
}

function buildSpec(name: string): Record<string, unknown> {
  // Capability router (§J.3): record what the project seems to need + whether it wants a target
  // we don't build yet, so the IDE can warn honestly. Always created as GAS for now.
  const needs = detectCapabilityNeeds(name);
  const route = routeTarget(needs);
  return {
    description: name.trim() || null,
    capabilityNeeds: needs,
    recommendedTarget: route.target,
    webOnlyReasons: route.notImplemented ? route.reasons : [],
  };
}

/**
 * Form action (useActionState shape): returns `{ error }` so the create bar can show the new-tool
 * cap inline instead of crashing; redirects into the new project on success.
 */
export async function newProjectAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const name = String(formData.get("name") ?? "");
  let id: string;
  try {
    id = await createProject(name, "webapp", buildSpec(name));
  } catch (e) {
    if (e instanceof MonthlyToolLimitError) return { error: toolLimitMessage(e.limit) };
    throw e;
  }
  redirect(`/projects/${id}`);
}

/**
 * Create a project and RETURN its id (no redirect) — used by the Style Lab so the client can stash
 * the bundled kickoff prompt in sessionStorage before navigating into the IDE. Returns `{ error }`
 * when the monthly new-tool cap is hit. RLS-scoped to the signed-in user.
 */
export async function newProjectReturnId(
  name: string,
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not_authenticated");
  try {
    return { id: await createProject(name, "webapp", buildSpec(name)) };
  } catch (e) {
    if (e instanceof MonthlyToolLimitError) return { error: toolLimitMessage(e.limit) };
    throw e;
  }
}

/**
 * Delete a project. In EasyGAS this is a SOFT delete (stamp deleted_at) so token-usage history
 * survives, the monthly new-tool quota can't be gamed by create→delete, and it stays recoverable.
 * On Google it's a REAL delete: the standalone Apps Script project is removed from the user's Drive
 * (best-effort — failures don't block the soft delete), so the deployed web app stops working. A
 * bound Sheet is never touched (that's the user's own data). The UI warns before calling this.
 */
export async function deleteProjectAction(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not_authenticated");

  // Confirm ownership + read the Google script id under RLS.
  const { data: owned } = await supabase
    .from("egs_projects")
    .select("id, script_id, kind")
    .eq("id", id)
    .maybeSingle<{ id: string; script_id: string | null; kind: string }>();
  if (!owned) throw new Error("not_found");

  // Best-effort: remove the standalone Apps Script project from the user's Drive. Never delete a
  // bound script (it lives inside the user's Sheet — deleting it would risk their data).
  if (owned.script_id && owned.kind !== "bound") {
    try {
      const accessToken = await getValidAccessToken(user.id);
      await fetch(`https://www.googleapis.com/drive/v3/files/${owned.script_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (e) {
      // Not connected / token stale / already gone — soft-delete in EasyGAS regardless.
      console.error("[deleteProject] Drive delete failed; soft-deleting in EasyGAS anyway:", e);
    }
  }

  const svc = createServiceClient();
  const { error } = await svc
    .from("egs_projects")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", user.id); // defense-in-depth: guard owner in code on the service-role path
  if (error) throw new Error(`deleteProject: ${error.message}`);
  revalidatePath("/projects");
}

/** Rate a generation (1 = 👍, -1 = 👎) for the A/B experiment. RLS scopes the update to the owner. */
export async function rateGenerationAction(generationId: string, rating: 1 | -1): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("egs_generations").update({ rating }).eq("id", generationId);
}

export type RepointResult =
  | { ok: true; arm: LlmProvider }
  | { error: "not_paid" | "not_found" | "wrong_family" | "already" };

/**
 * "อัปเกรดโมเดลของเครื่องมือนี้" — re-point an EXISTING project to the user's paid GLM arm so they can
 * keep building it with the better model after upgrading. PAID users only (the UI sends free users to
 * /pricing). Allowed only WITHIN the OpenAI wire family (DeepSeek↔GLM — history format is compatible);
 * Claude is a different family so its history can't carry over. Strips the DeepSeek reasoning_content
 * from the stored history so the non-reasoning GLM arm won't 400 on it.
 */
export async function repointProjectModelAction(projectId: string): Promise<RepointResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not_authenticated");

  const plan = await getUserPlan(user.id, user.email);
  if (!isPaidPlan(plan)) return { error: "not_paid" };
  const targetArm = PLAN_CONFIG[plan].arm; // paid = "zai" (GLM)

  // ownership + current provider under RLS
  const { data: owned } = await supabase
    .from("egs_projects")
    .select("id, llm_provider")
    .eq("id", projectId)
    .maybeSingle<{ id: string; llm_provider: LlmProvider | null }>();
  if (!owned) return { error: "not_found" };

  const current = owned.llm_provider;
  if (current === targetArm) return { error: "already" };
  // only re-point within the same wire family (compatible history). claude (anthropic) ≠ openai → block.
  if (current && providerConfig(current).family !== providerConfig(targetArm).family)
    return { error: "wrong_family" };

  const svc = createServiceClient();
  await svc
    .from("egs_projects")
    .update({ llm_provider: targetArm })
    .eq("id", projectId)
    .eq("owner_id", user.id); // defense-in-depth on the service-role path
  // drop deepseek-pro reasoning_content so the non-reasoning GLM arm won't 400 on the resumed history
  await svc.rpc("egs_strip_reasoning", { p_project: projectId });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, arm: targetArm };
}
