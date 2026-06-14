/**
 * Typed errors that the UI maps to specific recovery flows.
 */

/**
 * Thrown when the Apps Script API returns 403 because the END USER has not
 * enabled the Apps Script API at https://script.google.com/home/usersettings.
 * This is a per-user wall that NO OAuth scope can bypass — the UI must show a
 * blocking step with a deep link + "try again".
 */
export class UserSettingsDisabledError extends Error {
  readonly code = "USER_SETTINGS_DISABLED";
  constructor(message = "Apps Script API is not enabled for this Google account.") {
    super(message);
    this.name = "UserSettingsDisabledError";
  }
}

/** Thrown when the user has not yet connected their Google account. */
export class NotConnectedError extends Error {
  readonly code = "NOT_CONNECTED";
  constructor(message = "Google account is not connected.") {
    super(message);
    this.name = "NotConnectedError";
  }
}

/**
 * Thrown when the stored refresh token is rejected (invalid_grant).
 * Usually means the consent screen is still in "Testing" (7-day token expiry)
 * or the user revoked access — the UI must prompt a reconnect.
 */
export class NeedsReauthError extends Error {
  readonly code = "NEEDS_REAUTH";
  constructor(message = "Google connection expired — please reconnect.") {
    super(message);
    this.name = "NeedsReauthError";
  }
}

/** Generic Apps Script / Google API failure with the upstream status + body. */
export class GoogleApiError extends Error {
  readonly code = "GOOGLE_API_ERROR";
  constructor(
    readonly status: number,
    readonly body: string,
    message?: string,
  ) {
    super(message ?? `Google API error ${status}: ${body}`);
    this.name = "GoogleApiError";
  }
}
