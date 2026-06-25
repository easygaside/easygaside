"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { detectCapabilityNeeds, routeTarget } from "@/lib/deployment-targets";
import { MonthlyToolLimitError } from "@/lib/errors";
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
 * Soft-delete a project: stamp deleted_at instead of removing the row. Keeps its files / messages /
 * deployments / token-usage so history (admin metrics) survives, the monthly new-tool quota can't be
 * gamed by create→delete, and the project stays recoverable. Hidden from the user everywhere
 * (listProjects/getProject filter deleted_at). Does NOT touch the user's Google Drive / Apps Script —
 * the deployed script + Sheet stay in their account.
 */
export async function deleteProjectAction(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not_authenticated");

  // Confirm ownership under RLS before the service-role write.
  const { data: owned } = await supabase.from("egs_projects").select("id").eq("id", id).maybeSingle();
  if (!owned) throw new Error("not_found");

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
