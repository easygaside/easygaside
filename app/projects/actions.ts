"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { removeProjectChatImages } from "@/lib/chat-images";
import { detectCapabilityNeeds, routeTarget } from "@/lib/deployment-targets";
import { MonthlyToolLimitError } from "@/lib/errors";
import { createProject } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";

/** Shared "ครบโควตาสร้างใหม่" message for the create entry points. */
function toolLimitMessage(limit: number): string {
  return `ครบโควตาสร้างเครื่องมือใหม่ของเดือนนี้แล้ว (แผน Free ${limit} ตัว) — ลบของเก่า รอต้นเดือนหน้า หรือใส่ Anthropic key ของคุณในหน้า ตั้งค่า เพื่อสร้างไม่จำกัด`;
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
 * Remove a project from EasyGAS only. RLS scopes the delete to the owner; FK ON DELETE CASCADE
 * removes its files/messages/deployments/chat-image rows. We also purge the project's chat images
 * from storage first (those bytes don't cascade). Does NOT touch the user's Google Drive / Apps
 * Script — we make no Google API call here, so the deployed script + Sheet stay in their account.
 */
export async function deleteProjectAction(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not_authenticated");

  // Confirm ownership under RLS before any service-role work (storage removal bypasses RLS).
  const { data: owned } = await supabase.from("egs_projects").select("id").eq("id", id).maybeSingle();
  if (!owned) throw new Error("not_found");

  // Purge chat-image bytes from the bucket before the rows cascade away (paths live in those rows).
  await removeProjectChatImages(id);

  const { error } = await supabase.from("egs_projects").delete().eq("id", id);
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
