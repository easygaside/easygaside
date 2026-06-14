import { NeedsReauthError } from "./errors";

/**
 * Custom Google OAuth 2.0 authorization-code flow (separate from Supabase Auth).
 *
 * We run our own flow — instead of Supabase's Google provider — because Supabase
 * does NOT persist or refresh `provider_refresh_token`. We need a durable, refreshable
 * refresh token carrying the Apps Script scopes to push code into the user's account.
 */

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";

/**
 * The scope contract. All are SENSITIVE (lightweight verification) EXCEPT
 * drive.file which is NON-sensitive. None are RESTRICTED, so we avoid CASA.
 * Do NOT add `drive`, `drive.readonly`, or `gmail.*` — those trigger CASA.
 */
export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/script.projects",
  "https://www.googleapis.com/auth/script.deployments",
  "https://www.googleapis.com/auth/drive.file",
] as const;

function clientId(): string {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!id) throw new Error("GOOGLE_OAUTH_CLIENT_ID is not set.");
  return id;
}
function clientSecret(): string {
  const s = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!s) throw new Error("GOOGLE_OAUTH_CLIENT_SECRET is not set.");
  return s;
}
function redirectUri(): string {
  const uri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!uri) throw new Error("GOOGLE_OAUTH_REDIRECT_URI is not set.");
  return uri;
}

/** Build the consent URL. `state` is a CSRF token we verify on callback. */
export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    // offline + consent → always returns a refresh_token, even on re-grant.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token?: string;
}

/** Exchange an authorization code for tokens (called once, on callback). */
export async function exchangeCode(code: string): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as TokenResponse;
}

/** Mint a fresh access token from a stored refresh token (called before each batch). */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId(),
      client_secret: clientSecret(),
      grant_type: "refresh_token",
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    // invalid_grant = revoked, expired (Testing-mode 7-day), or wrong client.
    if (text.includes("invalid_grant")) {
      throw new NeedsReauthError();
    }
    throw new Error(`Token refresh failed (${res.status}): ${text}`);
  }
  const json = JSON.parse(text) as { access_token: string; expires_in: number };
  return { accessToken: json.access_token, expiresIn: json.expires_in };
}

/** Revoke a token at Google (used on disconnect). */
export async function revokeToken(token: string): Promise<void> {
  await fetch(GOOGLE_REVOKE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  });
}

/** Decode the `sub` and `email` claims from an id_token (no verification needed
 *  — it arrived directly from Google's token endpoint over TLS). */
export function decodeIdToken(idToken: string): { sub: string; email?: string } {
  const payload = idToken.split(".")[1];
  const json = JSON.parse(
    Buffer.from(payload, "base64url").toString("utf8"),
  ) as { sub: string; email?: string };
  return { sub: json.sub, email: json.email };
}
