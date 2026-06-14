import { GoogleApiError, UserSettingsDisabledError } from "./errors";

/**
 * Thin wrapper over the Google Apps Script REST API (https://script.googleapis.com/v1).
 * This is everything `clasp` does under the hood — we call it directly with the
 * user's OAuth access token, so there is no clasp binary / child process on the server.
 *
 * Deploy pipeline:
 *   createProject → updateContent → createVersion → createDeployment
 *   (on subsequent deploys: updateContent → createVersion → updateDeployment [PATCH the SAME id])
 *
 * Hard cap: 20 deployments per script. We ALWAYS PATCH the same deployment, never create new ones.
 */

const BASE = "https://script.googleapis.com/v1";

export type GasFileType = "SERVER_JS" | "HTML" | "JSON";

export interface GasFile {
  name: string; // no extension: "Code", "Index", "appsscript"
  type: GasFileType;
  source: string;
}

async function gasFetch<T>(
  accessToken: string,
  path: string,
  init: { method: string; body?: unknown },
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });

  const text = await res.text();
  if (!res.ok) {
    // The per-user "Apps Script API not enabled" wall surfaces as 403.
    if (
      res.status === 403 &&
      (text.includes("has not enabled the Apps Script API") ||
        text.includes("usersettings") ||
        text.toLowerCase().includes("apps script api"))
    ) {
      throw new UserSettingsDisabledError();
    }
    throw new GoogleApiError(res.status, text);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

/** Map editor files (Code.gs, Index.html, appsscript.json) to the API's file objects. */
export function toApiFiles(
  files: { path: string; content: string }[],
): GasFile[] {
  return files.map((f) => {
    const lower = f.path.toLowerCase();
    if (lower.endsWith(".html")) {
      return { name: stripExt(f.path), type: "HTML", source: f.content };
    }
    if (lower === "appsscript.json" || lower.endsWith("/appsscript.json")) {
      return { name: "appsscript", type: "JSON", source: f.content };
    }
    // .gs and anything else → server JS
    return { name: stripExt(f.path), type: "SERVER_JS", source: f.content };
  });
}

function stripExt(path: string): string {
  return path.replace(/\.[^.]+$/, "");
}

// ── API surface ──

export interface CreateProjectResult {
  scriptId: string;
  title: string;
}

/** Create a standalone project (omit parentId) or a bound one (pass the Sheet's Drive fileId). */
export async function createProject(
  accessToken: string,
  title: string,
  parentId?: string,
): Promise<CreateProjectResult> {
  const body: Record<string, string> = { title };
  if (parentId) body.parentId = parentId;
  const res = await gasFetch<{ scriptId: string; title: string }>(
    accessToken,
    "/projects",
    { method: "POST", body },
  );
  return { scriptId: res.scriptId, title: res.title };
}

/** Replace ALL files in the project (always send the full set). */
export async function updateContent(
  accessToken: string,
  scriptId: string,
  files: GasFile[],
): Promise<void> {
  await gasFetch(accessToken, `/projects/${scriptId}/content`, {
    method: "PUT",
    body: { files },
  });
}

export async function createVersion(
  accessToken: string,
  scriptId: string,
  description: string,
): Promise<number> {
  const res = await gasFetch<{ versionNumber: number }>(
    accessToken,
    `/projects/${scriptId}/versions`,
    { method: "POST", body: { description } },
  );
  return res.versionNumber;
}

export interface DeploymentResult {
  deploymentId: string;
  webAppUrl?: string;
}

function extractWebAppUrl(deployment: {
  entryPoints?: { webApp?: { url?: string } }[];
}): string | undefined {
  return deployment.entryPoints?.find((e) => e.webApp?.url)?.webApp?.url;
}

export async function createDeployment(
  accessToken: string,
  scriptId: string,
  versionNumber: number,
  description = "easygas",
): Promise<DeploymentResult> {
  const res = await gasFetch<{
    deploymentId: string;
    entryPoints?: { webApp?: { url?: string } }[];
  }>(accessToken, `/projects/${scriptId}/deployments`, {
    method: "POST",
    body: {
      versionNumber,
      manifestFileName: "appsscript",
      description,
    },
  });
  return { deploymentId: res.deploymentId, webAppUrl: extractWebAppUrl(res) };
}

/** PATCH an existing deployment to a new version (reuse the same deployment id forever). */
export async function updateDeployment(
  accessToken: string,
  scriptId: string,
  deploymentId: string,
  versionNumber: number,
  description = "easygas",
): Promise<DeploymentResult> {
  const res = await gasFetch<{
    deploymentId: string;
    entryPoints?: { webApp?: { url?: string } }[];
  }>(accessToken, `/projects/${scriptId}/deployments/${deploymentId}`, {
    method: "PUT",
    body: {
      deploymentConfig: {
        scriptId,
        versionNumber,
        manifestFileName: "appsscript",
        description,
      },
    },
  });
  return { deploymentId: res.deploymentId, webAppUrl: extractWebAppUrl(res) };
}
