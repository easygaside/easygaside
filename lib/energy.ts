import { isSuperAdmin } from "@/lib/admin";
import { getNumberSetting } from "@/lib/settings";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Per-project "energy" = the token budget for a project, shown to the user as a friendly bar.
 * We deliberately NEVER show raw token counts to non-coders (see docs/MONETIZATION.md §3) — the
 * bar is the user-facing form of the per-project token tank.
 *
 * The tank is metered in tokens, but the COST of filling it varies wildly by provider, so cheap
 * arms get a much bigger tank (a full 1M tank on DeepSeek-flash costs a few baht; the same on
 * Claude/ChatGPT would be 20–50× pricier). Both the per-arm size and the default are now
 * superadmin-editable in /admin (egs_provider_config.energy_tank + egs_app_settings).
 */

/** Hardcoded last-resort default if the DB has no 'energy_tank_default' row. */
export const ENERGY_TANK_FALLBACK = 400_000;

/** The default tank (admin-editable) used when an arm has no explicit per-arm tank. */
export async function defaultEnergyTank(): Promise<number> {
  return getNumberSetting("energy_tank_default", ENERGY_TANK_FALLBACK);
}

/** The per-arm tank SIZE (display + enforcement basis), from DB. Unknown/unset arm → default. */
export async function energyTankFor(provider?: string | null): Promise<number> {
  const fallback = await defaultEnergyTank();
  if (!provider) return fallback;
  const svc = createServiceClient();
  const { data } = await svc
    .from("egs_provider_config")
    .select("energy_tank")
    .eq("provider", provider)
    .maybeSingle<{ energy_tank: number | null }>();
  const n = Number(data?.energy_tank);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * The per-project token tank used for ENFORCEMENT (the agent loop blocks once a project passes it):
 * arm-aware (energyTankFor), but superadmins are uncapped (founder testing). The display bar uses
 * energyTankFor directly so it never shows the superadmin Infinity.
 */
export async function getEnergyTank(
  email: string | null | undefined,
  provider?: string | null,
): Promise<number> {
  return isSuperAdmin(email) ? Number.POSITIVE_INFINITY : energyTankFor(provider);
}

/** User-facing message when a project's energy tank is exhausted (chat / verify / re-check). */
export const ENERGY_EXHAUSTED_MSG =
  "พลังงานของโปรเจ็คนี้เต็มแล้ว — สร้างโปรเจ็คใหม่ หรือใส่ Anthropic API key ของคุณเองในหน้า ตั้งค่า เพื่อใช้แบบไม่จำกัด";

/** Sum of input+output tokens logged for a project so far = its consumed energy. */
export async function getProjectEnergyUsed(projectId: string): Promise<number> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("egs_generations")
    .select("input_tokens, output_tokens")
    .eq("project_id", projectId);
  return (data ?? []).reduce(
    (a, r) => a + ((r.input_tokens as number) ?? 0) + ((r.output_tokens as number) ?? 0),
    0,
  );
}
