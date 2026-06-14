"use server";

import { redirect } from "next/navigation";
import { detectCapabilityNeeds, routeTarget } from "@/lib/deployment-targets";
import { createProject } from "@/lib/projects";

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
