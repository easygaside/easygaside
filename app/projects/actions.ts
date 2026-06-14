"use server";

import { redirect } from "next/navigation";
import { createProject } from "@/lib/projects";

export async function newProjectAction(formData: FormData) {
  const name = String(formData.get("name") ?? "");
  const id = await createProject(name);
  redirect(`/projects/${id}`);
}
