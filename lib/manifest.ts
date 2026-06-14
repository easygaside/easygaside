/**
 * Builds the appsscript.json manifest for a GAS web-app project.
 *
 * Critical for a working web-app deployment:
 *  - webapp.access = ANYONE_ANONYMOUS  → public URL (no Google login to view)
 *  - webapp.executeAs = USER_DEPLOYING → runs as the deploying user
 *  - runtimeVersion = V8               → modern JS
 *  - timeZone = Asia/Bangkok           → correct Utilities.formatDate behavior
 *
 * Without the `webApp` block, deployments.create returns no web-app entry point / url.
 */
export interface ManifestOptions {
  timeZone?: string;
  oauthScopes?: string[];
  access?: "MYSELF" | "DOMAIN" | "ANYONE" | "ANYONE_ANONYMOUS";
  executeAs?: "USER_ACCESSING" | "USER_DEPLOYING";
}

export function buildWebAppManifest(opts: ManifestOptions = {}): string {
  const manifest = {
    timeZone: opts.timeZone ?? "Asia/Bangkok",
    dependencies: {},
    exceptionLogging: "STACKDRIVER",
    runtimeVersion: "V8",
    webapp: {
      access: opts.access ?? "ANYONE_ANONYMOUS",
      executeAs: opts.executeAs ?? "USER_DEPLOYING",
    },
    ...(opts.oauthScopes && opts.oauthScopes.length > 0
      ? { oauthScopes: opts.oauthScopes }
      : {}),
  };
  return JSON.stringify(manifest, null, 2);
}
