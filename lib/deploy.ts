import {
  createDeployment,
  createProject,
  createVersion,
  toApiFiles,
  updateContent,
  updateDeployment,
  type GasFile,
} from "@/lib/gas-script-api";
import { getFiles } from "@/lib/files";
import { getValidAccessToken } from "@/lib/google-connection";
import { buildWebAppManifest } from "@/lib/manifest";
import { createServiceClient } from "@/lib/supabase/service";
import type { EgsDeployment, EgsProject } from "@/types/db";

/**
 * Deploy/preview plumbing — turns egs_files into a live Apps Script deployment on the user's account.
 * Reuses the same REST-direct pipeline as the Phase-0 spike. Caller MUST verify ownership first.
 */

const INSTALL_TRIGGERS_RE = /\bfunction\s+installTriggers\s*\(/;

async function buildApiFiles(projectId: string): Promise<GasFile[]> {
  const files = await getFiles(projectId);
  if (files.length === 0) throw new Error("no_files");
  const apiFiles = toApiFiles(files.map((f) => ({ path: f.path, content: f.content })));
  if (!files.some((f) => f.path.toLowerCase() === "appsscript.json")) {
    apiFiles.push({ name: "appsscript", type: "JSON", source: buildWebAppManifest() });
  }
  return apiFiles;
}

export interface DeployResult {
  execUrl?: string;
  scriptId: string;
  needsTriggerSetup: boolean;
  scriptEditorUrl: string;
}

export async function deployProject(
  userId: string,
  project: EgsProject,
): Promise<DeployResult> {
  const accessToken = await getValidAccessToken(userId);
  const apiFiles = await buildApiFiles(project.id);
  const svc = createServiceClient();

  // 1. ensure the script exists (reuse forever)
  let scriptId = project.script_id;
  if (!scriptId) {
    const created = await createProject(accessToken, project.name);
    scriptId = created.scriptId;
    await svc
      .from("egs_projects")
      .update({ script_id: scriptId, updated_at: new Date().toISOString() })
      .eq("id", project.id);
  }

  // 2. push + version
  await updateContent(accessToken, scriptId, apiFiles);
  const versionNumber = await createVersion(accessToken, scriptId, `deploy v${Date.now()}`);

  // 3. PATCH the existing web-app deployment (never create new — 20/script cap) or create the first
  const { data: existingRows } = await svc
    .from("egs_deployments")
    .select("*")
    .eq("project_id", project.id)
    .eq("entry_type", "webapp")
    .order("created_at", { ascending: false })
    .limit(1);
  const existing = (existingRows?.[0] as EgsDeployment | undefined) ?? null;

  let webAppUrl: string | undefined;
  if (existing?.deployment_id) {
    const r = await updateDeployment(accessToken, scriptId, existing.deployment_id, versionNumber, project.name);
    webAppUrl = r.webAppUrl;
    await svc
      .from("egs_deployments")
      .update({ exec_url: webAppUrl, version_number: versionNumber, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    const r = await createDeployment(accessToken, scriptId, versionNumber, project.name);
    webAppUrl = r.webAppUrl;
    await svc.from("egs_deployments").insert({
      project_id: project.id,
      deployment_id: r.deploymentId,
      entry_type: "webapp",
      exec_url: webAppUrl,
      version_number: versionNumber,
    });
  }

  // Phase 7: trigger detection (auto-run via scripts.run is deferred — needs extra scope; guide instead)
  const files = await getFiles(project.id);
  const needsTriggerSetup = files.some((f) => INSTALL_TRIGGERS_RE.test(f.content));

  return {
    execUrl: webAppUrl,
    scriptId,
    needsTriggerSetup,
    scriptEditorUrl: `https://script.google.com/d/${scriptId}/edit`,
  };
}

/**
 * Tier-2 preview: push files to a per-project scratch script (HEAD) and return its /dev URL.
 * Creates a one-time web-app deployment so the /dev endpoint is active. Best-effort (the /dev URL
 * only renders for the owner logged into that Google account — the UI opens it in a new tab).
 */
export async function pushScratch(
  userId: string,
  project: EgsProject,
): Promise<{ devUrl: string }> {
  const accessToken = await getValidAccessToken(userId);
  const apiFiles = await buildApiFiles(project.id);
  const svc = createServiceClient();

  let scratchId = project.scratch_script_id;
  const isNew = !scratchId;
  if (!scratchId) {
    const created = await createProject(accessToken, `${project.name} (preview)`);
    scratchId = created.scriptId;
  }

  await updateContent(accessToken, scratchId, apiFiles);
  if (isNew) {
    // activate the /dev endpoint once (HEAD serves the latest content thereafter)
    const v = await createVersion(accessToken, scratchId, "preview");
    await createDeployment(accessToken, scratchId, v, `${project.name} preview`);
    // persist scratch id ONLY after activation succeeds (else a failed activation leaves a dormant scratch)
    await svc
      .from("egs_projects")
      .update({ scratch_script_id: scratchId, updated_at: new Date().toISOString() })
      .eq("id", project.id);
  }

  return { devUrl: `https://script.google.com/macros/s/${scratchId}/dev` };
}
