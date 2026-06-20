/**
 * Superadmin gate. The allowlist is the union of a built-in default (the EasyGAS brand/owner
 * account) and SUPERADMIN_EMAILS (comma-separated env), so /admin works even before the env var
 * is set in a fresh environment. Used to guard the /admin panel and the admin-only login redirect.
 */
const DEFAULT_SUPERADMINS = ["easygaside@gmail.com"];

export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = [
    ...DEFAULT_SUPERADMINS,
    ...(process.env.SUPERADMIN_EMAILS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  ];
  return list.includes(email.toLowerCase());
}
