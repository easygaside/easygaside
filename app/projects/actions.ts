"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { removeProjectChatImages } from "@/lib/chat-images";
import { detectCapabilityNeeds, routeTarget } from "@/lib/deployment-targets";
import { createProject } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";

export async function newProjectAction(formData: FormData) {
  const name = String(formData.get("name") ?? "");

  // Capability router (§J.3): record what the project seems to need + whether it wants a target
  // we don't build yet, so the IDE can warn honestly. Always created as GAS for now.
  const needs = detectCapabilityNeeds(name);
  const route = routeTarget(needs);
  const spec: Record<string, unknown> = {
    description: name.trim() || null,
    capabilityNeeds: needs,
    recommendedTarget: route.target,
    webOnlyReasons: route.notImplemented ? route.reasons : [],
  };

  const id = await createProject(name, "webapp", spec);
  redirect(`/projects/${id}`);
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
