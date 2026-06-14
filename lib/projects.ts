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

  // (owner_id, name) is unique — auto-uniquify ("ชื่อ", "ชื่อ (2)", "ชื่อ (3)"…) so a duplicate
  // name never crashes the create. 23505 = Postgres unique-violation.
  const base = name.trim() || "โปรเจกต์ใหม่";
  for (let n = 1; n <= 50; n++) {
    const candidate = n === 1 ? base : `${base} (${n})`;
    const { data, error } = await supabase
      .from("egs_projects")
      .insert({ owner_id: user.id, name: candidate, kind, spec })
      .select("id")
      .single();
    if (!error) return (data as { id: string }).id;
    if (error.code !== "23505") throw new Error(`createProject: ${error.message}`);
  }
  throw new Error("createProject: ตั้งชื่อไม่สำเร็จ มีโปรเจกต์ชื่อนี้ซ้ำมากเกินไป");
}

/**
 * Map of project_id → live exec URL for the current user's deployed web apps.
 * RLS scopes egs_deployments to the owner via the parent project, so no owner filter is needed.
 */
export async function getDeployedMap(): Promise<Record<string, string>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("egs_deployments")
    .select("project_id, exec_url")
    .eq("entry_type", "webapp");
  if (error) throw new Error(`getDeployedMap: ${error.message}`);
  const map: Record<string, string> = {};
  for (const d of (data ?? []) as { project_id: string; exec_url: string | null }[]) {
    if (d.exec_url) map[d.project_id] = d.exec_url;
  }
  return map;
}
