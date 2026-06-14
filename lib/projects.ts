import { createClient } from "@/lib/supabase/server";
import type { EgsProject, ProjectKind } from "@/types/db";

/**
 * Project data layer (server-only). RLS scopes every query to the logged-in owner,
 * so we never filter by owner_id on reads — we only set it on insert.
 */

export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function listProjects(): Promise<EgsProject[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("egs_projects")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`listProjects: ${error.message}`);
  return (data ?? []) as EgsProject[];
}

export async function getProject(id: string): Promise<EgsProject | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("egs_projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getProject: ${error.message}`);
  return (data as EgsProject) ?? null;
}

export async function createProject(
  name: string,
  kind: ProjectKind = "webapp",
  spec: Record<string, unknown> | null = null,
): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not_authenticated");

  const { data, error } = await supabase
    .from("egs_projects")
    .insert({ owner_id: user.id, name: name.trim() || "โปรเจกต์ใหม่", kind, spec })
    .select("id")
    .single();
  if (error) throw new Error(`createProject: ${error.message}`);
  return (data as { id: string }).id;
}
