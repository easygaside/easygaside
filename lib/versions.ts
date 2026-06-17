import { deleteFile, getFiles, writeFile } from "@/lib/files";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Code version history (egs_file_versions). Snapshots the whole file set on meaningful events
 * (ai generation, manual edit, deploy, restore) so the user can view + roll back. Server-only;
 * inserts go through the service role, the owner reads via RLS, restore overwrites egs_files.
 */

export type VersionSource = "ai" | "manual" | "deploy" | "restore";

interface VersionFile {
  path: string;
  content: string;
}

export interface VersionMeta {
  id: string;
  source: VersionSource;
  label: string | null;
  created_at: string;
  fileCount: number;
}

function sameFiles(a: VersionFile[], b: VersionFile[]): boolean {
  if (a.length !== b.length) return false;
  const map = new Map(a.map((f) => [f.path, f.content]));
  return b.every((f) => map.get(f.path) === f.content);
}

/**
 * Snapshot the project's current files. Best-effort (never throws). Dedupes against the latest
 * snapshot; with throttleSeconds, also skips when the most recent snapshot is newer than that window
 * (coalesces bursts of manual autosaves into one version).
 */
export async function snapshotProject(
  projectId: string,
  source: VersionSource,
  opts: { label?: string; throttleSeconds?: number } = {},
): Promise<void> {
  try {
    const current = (await getFiles(projectId)).map((f) => ({ path: f.path, content: f.content }));
    if (current.length === 0) return;
    const svc = createServiceClient();
    const { data: latest } = await svc
      .from("egs_file_versions")
      .select("files, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ files: VersionFile[]; created_at: string }>();
    if (latest) {
      if (sameFiles(latest.files ?? [], current)) return; // unchanged → no new version
      if (
        opts.throttleSeconds &&
        Date.now() - new Date(latest.created_at).getTime() < opts.throttleSeconds * 1000
      )
        return; // within the coalesce window
    }
    await svc.from("egs_file_versions").insert({
      project_id: projectId,
      source,
      label: opts.label ?? null,
      files: current,
    });
  } catch (e) {
    console.error("[versions] snapshot failed (non-fatal):", e);
  }
}

/** Metadata for a project's snapshots, newest first (no file bodies). Caller MUST verify ownership. */
export async function listVersionsMeta(projectId: string, limit = 50): Promise<VersionMeta[]> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("egs_file_versions")
    .select("id, source, label, created_at, files")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    source: ((r.source as VersionSource) ?? "manual") as VersionSource,
    label: (r.label as string | null) ?? null,
    created_at: r.created_at as string,
    fileCount: Array.isArray(r.files) ? (r.files as VersionFile[]).length : 0,
  }));
}

/** The project a version belongs to (for ownership checks). */
export async function getVersionProjectId(versionId: string): Promise<string | null> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("egs_file_versions")
    .select("project_id")
    .eq("id", versionId)
    .maybeSingle<{ project_id: string }>();
  return data?.project_id ?? null;
}

/**
 * Overwrite egs_files with a snapshot's files (caller MUST verify ownership first), then snapshot the
 * restored state as a new "restore" version so the restore itself is undoable. Returns restored files.
 */
export async function restoreVersion(versionId: string): Promise<VersionFile[] | null> {
  const svc = createServiceClient();
  const { data: ver } = await svc
    .from("egs_file_versions")
    .select("project_id, files")
    .eq("id", versionId)
    .maybeSingle<{ project_id: string; files: VersionFile[] }>();
  if (!ver) return null;
  const projectId = ver.project_id;
  const files = (ver.files ?? []).filter((f) => f && typeof f.path === "string");

  const current = await getFiles(projectId);
  const keep = new Set(files.map((f) => f.path));
  await Promise.all(
    current.filter((f) => !keep.has(f.path)).map((f) => deleteFile(projectId, f.path)),
  );
  await Promise.all(files.map((f) => writeFile(projectId, f.path, f.content)));

  await snapshotProject(projectId, "restore");
  return files;
}
