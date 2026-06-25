import { GoogleApiError, ProjectApiDisabledError, UserSettingsDisabledError } from "./errors";

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
    // Two DISTINCT 403s both mention "Apps Script API" — disambiguate, never conflate them:
    if (res.status === 403) {
      const lower = text.toLowerCase();
      // (A) PROJECT-level: OUR OAuth client's Cloud project hasn't enabled the Apps Script API.
      //     Google's body carries a console.cloud/developers URL to enable it (config issue, app side).
      if (lower.includes("service_disabled") || lower.includes("has not been used in project")) {
        const m = text.match(/https:\/\/console\.(?:developers|cloud)\.google\.com\/[^\s"'\\]+/);
        throw new ProjectApiDisabledError(
          m?.[0] ?? "https://console.cloud.google.com/apis/library/script.googleapis.com",
        );
      }
      // (B) PER-USER wall: the END USER must flip the toggle at script.google.com/home/usersettings.
      if (lower.includes("usersettings") || lower.includes("has not enabled the apps script api")) {
        throw new UserSettingsDisabledError();
      }
    }
    throw new GoogleApiError(res.status, text);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

/**
 * Non-destructive readiness probe for the per-user Apps Script API toggle
 * (script.google.com/home/usersettings). We GET a non-existent project: the usersettings and
 * SERVICE_DISABLED gates are evaluated at the API edge BEFORE resource lookup, so a DISABLED API
 * throws UserSettingsDisabledError / ProjectApiDisabledError here. An ENABLED API instead 404s
 * (or permission-denies) the fake id — which we swallow → "ready". Creates nothing in the account.
 */
export async function probeAppsScriptEnabled(accessToken: string): Promise<void> {
  try {
    await gasFetch(accessToken, "/projects/easygasReadinessProbeNonexistent000000000000", {
      method: "GET",
    });
  } catch (e) {
    if (e instanceof UserSettingsDisabledError || e instanceof ProjectApiDisabledError) throw e;
    // 404 / permission / any other response means the call passed the enable gate → API is on.
  }
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
  const url = deployment.entryPoints?.find((e) => e.webApp?.url)?.webApp?.url;
  // Normalize to the account-AGNOSTIC public form. An account-scoped URL like
  // .../macros/u/2/s/<id>/exec only opens under that browser account-index and 403s/Drive-errors
  // for anyone else; the canonical .../macros/s/<id>/exec is the truly public link.
  return url?.replace(/\/macros\/u\/\d+\/s\//, "/macros/s/");
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
