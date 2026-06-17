"use server";

import { getCurrentUser, getProject } from "@/lib/projects";
import {
  getVersionProjectId,
  listVersionsMeta,
  restoreVersion,
  type VersionMeta,
} from "@/lib/versions";

/** List a project's code snapshots (newest first). RLS-equivalent ownership check via getProject. */
export async function listVersionsAction(projectId: string): Promise<VersionMeta[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const project = await getProject(projectId); // RLS-scoped → null if not owned
  if (!project) return [];
  return listVersionsMeta(projectId);
}

/** Roll the project's files back to a snapshot. Verifies the version belongs to the user's project. */
export async function restoreVersionAction(versionId: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  const projectId = await getVersionProjectId(versionId);
  if (!projectId) return { ok: false };
  const project = await getProject(projectId); // RLS ownership check
  if (!project) return { ok: false };
  await restoreVersion(versionId);
  return { ok: true };
}
