import type { DeployResult } from "@/lib/deploy";
import type { EgsProject, TargetId } from "@/types/db";

/**
 * Deployment-target abstraction (BUILDPLAN §J.5/§J.6).
 *
 * A target = the runtime a generated project ships to. GAS is the only IMPLEMENTED target today;
 * `web-supabase` / `static-web` are designed in docs/WEB-TARGET.md but NOT built (YAGNI per §J.6).
 * Core code (deploy/preview routes) calls a target ONLY through this interface, so adding the web
 * target later is an adapter registration — not a core rewrite.
 */

/** Capability matrix used by the router (§J.3) + UI to pick / explain a target. */
export interface CapabilitySet {
  liveCamera: boolean; // getUserMedia stream — GAS blocks this (sandboxed iframe)
  stillPhoto: boolean; // <input capture> single shot — GAS ok
  realtime: boolean; // websocket / live subscriptions
  npmPackages: boolean; // bundled npm deps
  customDomain: boolean; // user's own domain
  publicSeo: boolean; // crawlable public page
  workspaceData: boolean; // native Sheets/Drive/Gmail access
  zeroHosting: boolean; // no hosting cost to us (runs on user's account)
  backgroundJobs: boolean; // time-driven / scheduled execution
}

export interface PreviewResult {
  /** Best-effort live preview URL (GAS: scratch /dev). */
  previewUrl: string;
}

export interface DeploymentTarget {
  readonly id: TargetId;
  readonly label: string; // UI label
  readonly capabilities: CapabilitySet;
  readonly requiredScopes: readonly string[];
  /** Publish the project's files to the user's own account; returns the live URL + guidance. */
  deploy(userId: string, project: EgsProject): Promise<DeployResult>;
  /** Best-effort live preview (Tier-2). */
  pushPreview(userId: string, project: EgsProject): Promise<PreviewResult>;
}
