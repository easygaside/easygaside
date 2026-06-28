import { isSuperAdmin } from "@/lib/admin";
import { bangkokMonthStartISO } from "@/lib/month";
import { PLAN_CONFIG, getUserPlan } from "@/lib/plan";
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

// ── monthly credit/แต้ม pool (per-USER, pooled across ALL the user's projects) ──
// Replaces the per-project tank for enforcement: one monthly token budget spendable on any project,
// so a complex tool isn't walled by an arbitrary per-project ceiling (see docs/CRITIC-FINDINGS notes).
// 1 แต้ม = CREDIT_TOKENS tokens; the bar shows แต้ม, never raw tokens. The pool resets each calendar month.

export const CREDIT_TOKENS = 10_000;
export const FREE_MONTHLY_POOL_FALLBACK = 800_000; // free plan: 800k tokens/เดือน (= 80 แต้ม)

/** tokens → แต้ม (floor; never negative). */
export function tokensToCredits(tokens: number): number {
  return Math.max(0, Math.floor(tokens / CREDIT_TOKENS));
}

/** Start of the current month in Asia/Bangkok (UTC ISO) — the pool resets at Thai midnight on the 1st. */
function monthStartISO(): string {
  return bangkokMonthStartISO();
}

/** The FREE-tier pool (admin-editable 'free_monthly_pool'); paid-tier pools come from PLAN_CONFIG. */
async function freePoolSize(): Promise<number> {
  return getNumberSetting("free_monthly_pool", PLAN_CONFIG.free.pool);
}

/** The monthly token pool for a user's plan (always finite — display + the base of enforcement). */
export async function poolSizeForUser(userId: string, email?: string | null): Promise<number> {
  const plan = await getUserPlan(userId, email);
  return plan === "free" ? await freePoolSize() : PLAN_CONFIG[plan].pool;
}

/** The monthly token pool for ENFORCEMENT — superadmins are uncapped (founder testing). */
export async function getMonthlyPool(userId: string, email?: string | null): Promise<number> {
  return isSuperAdmin(email) ? Number.POSITIVE_INFINITY : poolSizeForUser(userId, email);
}

/** Tokens (input+output) the user has spent across ALL their projects this calendar month. */
export async function getUserMonthlyEnergyUsed(userId: string): Promise<number> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("egs_generations")
    .select("input_tokens, output_tokens")
    .eq("user_id", userId)
    .gte("created_at", monthStartISO());
  return (data ?? []).reduce(
    (a, r) => a + ((r.input_tokens as number) ?? 0) + ((r.output_tokens as number) ?? 0),
    0,
  );
}

/** Shown when the monthly pool is exhausted (chat / verify / re-check). */
export const POOL_EXHAUSTED_MSG =
  "แต้มเดือนนี้หมดแล้ว — เดือนหน้าแต้มจะรีเซ็ตอัตโนมัติ หรือใส่ Anthropic API key ของคุณเองในหน้า ตั้งค่า เพื่อใช้แบบไม่จำกัด";
