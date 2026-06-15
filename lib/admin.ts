/**
 * Superadmin gate. SUPERADMIN_EMAILS is a comma-separated allowlist (env). Used to guard the
 * /admin panel (provider assignment + experiment metrics).
 */
export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}
