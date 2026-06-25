import { userSettingsUrl } from "./api-helpers";
import { decrypt, encrypt } from "./crypto";
import { NeedsReauthError, NotConnectedError } from "./errors";
import { refreshAccessToken } from "./google-oauth";
import { createServiceClient } from "./supabase/service";

/**
 * Server-only helpers for the per-user Google connection (the encrypted refresh token).
 * All reads/writes of token columns go through the service-role client.
 */

const TABLE = "google_connections";

interface ConnectionRow {
  user_id: string;
  google_sub: string;
  scope: string;
  refresh_token_enc: string;
  refresh_token_iv: string;
  refresh_token_tag: string;
  status: string;
}

/**
 * Readiness of the per-user Apps Script API toggle (script.google.com/home/usersettings).
 * Google exposes NO API to read the toggle, and synthetic probes can't reliably tell it apart from
 * an enabled API — so we never guess: a connection is "ready" only once a REAL deploy has succeeded
 * (which flips apps_script_ready). Until then it's "unverified" and we just remind + link out.
 */
export type AppsScriptReadiness =
  | { state: "not_connected" }
  | { state: "needs_reauth" }
  | { state: "ready" } // a real deploy has succeeded at least once
  | { state: "unverified"; enableUrl: string }; // connected, but not yet proven by a deploy

/** Persist (or replace) a user's Google connection after the OAuth callback. */
export async function storeConnection(params: {
  userId: string;
  googleSub: string;
  scope: string;
  refreshToken: string;
  email?: string | null;
}): Promise<void> {
  const secret = encrypt(params.refreshToken);
  const svc = createServiceClient();
  const { error } = await svc.from(TABLE).upsert(
    {
      user_id: params.userId,
      google_sub: params.googleSub,
      scope: params.scope,
      email: params.email ?? null,
      refresh_token_enc: secret.enc,
      refresh_token_iv: secret.iv,
      refresh_token_tag: secret.tag,
      status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`Failed to store Google connection: ${error.message}`);
}

/**
 * Refresh-token-free update of a connection's metadata. Used by the OAuth callback when a
 * returning user logs in without re-consenting (Google returns no refresh_token): we keep the
 * already-stored token and only refresh scope/email and reactivate the row. Returns false when
 * there's no existing row to update — the caller then forces a fresh consent.
 */
export async function updateConnectionMeta(params: {
  userId: string;
  googleSub: string;
  scope: string;
  email?: string | null;
}): Promise<boolean> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from(TABLE)
    .update({
      google_sub: params.googleSub,
      scope: params.scope,
      email: params.email ?? null,
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", params.userId)
    .select("user_id")
    .maybeSingle<{ user_id: string }>();
  if (error) throw new Error(`Failed to update Google connection: ${error.message}`);
  return !!data;
}

/**
 * Return a fresh access token for the user, minted from the stored refresh token.
 * Phase 0 mints on every call (simple + correct); a later phase can cache by expiry.
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from(TABLE)
    .select(
      "user_id, google_sub, scope, refresh_token_enc, refresh_token_iv, refresh_token_tag, status",
    )
    .eq("user_id", userId)
    .maybeSingle<ConnectionRow>();

  if (error) throw new Error(`Failed to load Google connection: ${error.message}`);
  if (!data) throw new NotConnectedError();

  const refreshToken = decrypt({
    enc: data.refresh_token_enc,
    iv: data.refresh_token_iv,
    tag: data.refresh_token_tag,
  });

  try {
    const { accessToken } = await refreshAccessToken(refreshToken);
    return accessToken;
  } catch (err) {
    if (err instanceof NeedsReauthError) {
      await svc
        .from(TABLE)
        .update({ status: "needs_reauth", updated_at: new Date().toISOString() })
        .eq("user_id", userId);
    }
    throw err;
  }
}

/** Lightweight status check (no token decryption) for UI gating. */
export async function getConnectionStatus(userId: string): Promise<{
  connected: boolean;
  status: string | null;
  email: string | null;
  appsScriptReady: boolean;
}> {
  const svc = createServiceClient();
  const { data } = await svc
    .from(TABLE)
    .select("status, email, apps_script_ready")
    .eq("user_id", userId)
    .maybeSingle<{ status: string; email: string | null; apps_script_ready: boolean | null }>();
  return {
    connected: !!data,
    status: data?.status ?? null,
    email: data?.email ?? null,
    appsScriptReady: !!data?.apps_script_ready,
  };
}

/** Remember that the connected account has the Apps Script API toggle on (skip future probes). */
export async function markAppsScriptReady(userId: string): Promise<void> {
  const svc = createServiceClient();
  await svc
    .from(TABLE)
    .update({ apps_script_ready: true, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
}

/**
 * Cheap, no-Google-call readiness read for UI gating. "ready" only after a real deploy has flipped
 * the flag; otherwise "unverified" (we remind the user to enable + run a test deploy to confirm).
 */
export async function getAppsScriptReadiness(userId: string): Promise<AppsScriptReadiness> {
  const svc = createServiceClient();
  const { data } = await svc
    .from(TABLE)
    .select("status, email, apps_script_ready")
    .eq("user_id", userId)
    .maybeSingle<{ status: string; email: string | null; apps_script_ready: boolean | null }>();

  if (!data) return { state: "not_connected" };
  if (data.status === "needs_reauth") return { state: "needs_reauth" };
  if (data.apps_script_ready) return { state: "ready" };
  return { state: "unverified", enableUrl: userSettingsUrl(data.email) };
}
