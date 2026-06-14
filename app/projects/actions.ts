"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
 * removes its files/messages/deployments. Does NOT touch the user's Google Drive / Apps Script —
 * we make no Google API call here, so the deployed script + Sheet stay in their account.
 */
export async function deleteProjectAction(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not_authenticated");

  const { error } = await supabase.from("egs_projects").delete().eq("id", id);
  if (error) throw new Error(`deleteProject: ${error.message}`);
  revalidatePath("/projects");
}
