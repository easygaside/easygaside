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
export async function getConnectionStatus(
  userId: string,
): Promise<{ connected: boolean; status: string | null; email: string | null }> {
  const svc = createServiceClient();
  const { data } = await svc
    .from(TABLE)
    .select("status, email")
    .eq("user_id", userId)
    .maybeSingle<{ status: string; email: string | null }>();
  return { connected: !!data, status: data?.status ?? null, email: data?.email ?? null };
}
