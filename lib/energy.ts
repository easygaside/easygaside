import { isSuperAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Per-project "energy" = the token budget for a project, shown to the user as a friendly bar.
 * We deliberately NEVER show raw token counts to non-coders (see docs/MONETIZATION.md §3) — the
 * bar is the user-facing form of the per-project token tank. Tiers/billing aren't wired yet, so
 * this is a single default tank; make it tier-based (Free 150K / Lite 250K / Starter 400K / Pro 600K)
 * when billing lands.
 */
export const ENERGY_TANK = 400_000;

/**
 * The per-project token tank used for ENFORCEMENT (the agent loop blocks once a project passes it).
 * Superadmins are uncapped (founder testing); plan-based tanks land with billing. The UI bar still
 * renders against ENERGY_TANK as a friendly reference.
 */
export function getEnergyTank(email: string | null | undefined): number {
  return isSuperAdmin(email) ? Number.POSITIVE_INFINITY : ENERGY_TANK;
}

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
