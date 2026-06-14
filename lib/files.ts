import { createHash } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import type { EgsFile } from "@/types/db";

/**
 * egs_files data layer (server-only, service-role). The agent loop mutates files on behalf of
 * the owner — the caller (route handler) MUST verify project ownership before calling these.
 */

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export async function getFiles(projectId: string): Promise<EgsFile[]> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("egs_files")
    .select("*")
    .eq("project_id", projectId)
    .order("path");
  if (error) throw new Error(`getFiles: ${error.message}`);
  return (data ?? []) as EgsFile[];
}

export async function getFile(
  projectId: string,
  path: string,
): Promise<EgsFile | null> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("egs_files")
    .select("*")
    .eq("project_id", projectId)
    .eq("path", path)
    .maybeSingle();
  if (error) throw new Error(`getFile: ${error.message}`);
  return (data as EgsFile) ?? null;
}

export async function writeFile(
  projectId: string,
  path: string,
  content: string,
): Promise<void> {
  const svc = createServiceClient();
  const { error } = await svc.from("egs_files").upsert(
    {
      project_id: projectId,
      path,
      content,
      content_hash: sha256(content),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "project_id,path" },
  );
  if (error) throw new Error(`writeFile: ${error.message}`);
}

export async function deleteFile(
  projectId: string,
  path: string,
): Promise<void> {
  const svc = createServiceClient();
  const { error } = await svc
    .from("egs_files")
    .delete()
    .eq("project_id", projectId)
    .eq("path", path);
  if (error) throw new Error(`deleteFile: ${error.message}`);
}
