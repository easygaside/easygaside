import { deployProject, pushScratch } from "@/lib/deploy";
import type { EgsProject } from "@/types/db";
import type { CapabilitySet, DeploymentTarget, PreviewResult } from "./types";

/**
 * GAS adapter — wraps the existing deploy.ts pipeline behind the DeploymentTarget interface.
 * Thin delegation only: deployProject / pushScratch keep all the Apps Script REST logic.
 */

export const GAS_CAPABILITIES: CapabilitySet = {
  liveCamera: false, // sandboxed iframe → getUserMedia blocked (see docs/WEB-TARGET.md §1)
  stillPhoto: true,
  realtime: false,
  npmPackages: false,
  customDomain: false,
  publicSeo: false,
  workspaceData: true, // native Sheets/Drive/Gmail — GAS's whole point
  zeroHosting: true, // runs on the user's Google account, $0 to us
  backgroundJobs: true, // time-driven triggers
};

// OAuth scope contract for the GAS target (sensitive, no CASA — keep lean).
const GAS_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/script.projects",
  "https://www.googleapis.com/auth/script.deployments",
  "https://www.googleapis.com/auth/drive.file",
] as const;

export const gasAdapter: DeploymentTarget = {
  id: "gas",
  label: "Google Apps Script",
  capabilities: GAS_CAPABILITIES,
  requiredScopes: GAS_SCOPES,
  deploy(userId: string, project: EgsProject) {
    return deployProject(userId, project);
  },
  async pushPreview(userId: string, project: EgsProject): Promise<PreviewResult> {
    const { devUrl } = await pushScratch(userId, project);
    return { previewUrl: devUrl };
  },
};
