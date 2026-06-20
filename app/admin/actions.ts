"use server";

import { revalidatePath } from "next/cache";
import { isSuperAdmin } from "@/lib/admin";
import { LLM_PROVIDERS, type LlmProvider } from "@/lib/llm/provider";
import { getCurrentUser } from "@/lib/projects";
import { setAppSetting } from "@/lib/settings";
import { createServiceClient } from "@/lib/supabase/service";

async function requireSuperAdmin(): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !isSuperAdmin(user.email)) throw new Error("forbidden");
}

/** Assign one user to a provider arm. */
export async function setUserArmAction(userId: string, arm: LlmProvider): Promise<void> {
  await requireSuperAdmin();
  if (!LLM_PROVIDERS.includes(arm)) throw new Error("bad_provider");
  const svc = createServiceClient();
  const { error } = await svc
    .from("egs_user_settings")
    .upsert({ user_id: userId, llm_provider: arm }, { onConflict: "user_id" });
  if (error) throw new Error(`setUserArm: ${error.message}`);
  revalidatePath("/admin");
}

/** Set the model name a provider uses (e.g. gpt-4o → gpt-4.1, deepseek-chat → deepseek-reasoner). */
export async function setProviderModelAction(provider: LlmProvider, model: string): Promise<void> {
  await requireSuperAdmin();
  if (!LLM_PROVIDERS.includes(provider)) throw new Error("bad_provider");
  const m = model.trim();
  if (!m) throw new Error("empty_model");
  const svc = createServiceClient();
  const { error } = await svc
    .from("egs_provider_config")
    .upsert({ provider, model: m }, { onConflict: "provider" });
  if (error) throw new Error(`setProviderModel: ${error.message}`);
  revalidatePath("/admin");
}

/** Set the system-wide default provider (what unassigned users get). */
export async function setDefaultProviderAction(provider: LlmProvider): Promise<void> {
  await requireSuperAdmin();
  if (!LLM_PROVIDERS.includes(provider)) throw new Error("bad_provider");
  const svc = createServiceClient();
  const { error } = await svc
    .from("egs_app_settings")
    .upsert({ key: "default_provider", value: provider }, { onConflict: "key" });
  if (error) throw new Error(`setDefaultProvider: ${error.message}`);
  revalidatePath("/admin");
}

/** Set the per-user daily generation cap (egs_app_settings.daily_limit). */
export async function setDailyLimitAction(limit: number): Promise<void> {
  await requireSuperAdmin();
  const n = Math.floor(limit);
  if (!Number.isFinite(n) || n < 1 || n > 100000) throw new Error("bad_limit");
  await setAppSetting("daily_limit", String(n));
  revalidatePath("/admin");
}

/** Set the monthly NEW-tool (project) allowance per user (egs_app_settings.monthly_tool_limit). */
export async function setMonthlyToolLimitAction(limit: number): Promise<void> {
  await requireSuperAdmin();
  const n = Math.floor(limit);
  if (!Number.isFinite(n) || n < 1 || n > 100000) throw new Error("bad_limit");
  await setAppSetting("monthly_tool_limit", String(n));
  revalidatePath("/admin");
}

/** Set the fallback per-project energy tank (tokens) used when an arm has no explicit tank. */
export async function setEnergyTankDefaultAction(tank: number): Promise<void> {
  await requireSuperAdmin();
  const n = Math.floor(tank);
  if (!Number.isFinite(n) || n < 1000 || n > 100_000_000) throw new Error("bad_tank");
  await setAppSetting("energy_tank_default", String(n));
  revalidatePath("/admin");
}

/** Set the per-arm energy tank (tokens) — egs_provider_config.energy_tank. */
export async function setProviderTankAction(provider: LlmProvider, tank: number): Promise<void> {
  await requireSuperAdmin();
  if (!LLM_PROVIDERS.includes(provider)) throw new Error("bad_provider");
  const n = Math.floor(tank);
  if (!Number.isFinite(n) || n < 1000 || n > 100_000_000) throw new Error("bad_tank");
  const svc = createServiceClient();
  const { error } = await svc
    .from("egs_provider_config")
    .upsert({ provider, energy_tank: n }, { onConflict: "provider" });
  if (error) throw new Error(`setProviderTank: ${error.message}`);
  revalidatePath("/admin");
}

/** Toggle closed-beta enforcement (egs_app_settings.beta_enforced). */
export async function setBetaEnforcedAction(enforced: boolean): Promise<void> {
  await requireSuperAdmin();
  await setAppSetting("beta_enforced", enforced ? "on" : "off");
  revalidatePath("/admin");
}

/**
 * Set the shared rulebook critic's backend + model. Only claude/deepseek have an implemented
 * backend (lib/critic.ts), so the provider is constrained to those two.
 */
export async function setCriticAction(provider: string, model: string): Promise<void> {
  await requireSuperAdmin();
  if (provider !== "claude" && provider !== "deepseek") throw new Error("bad_critic_provider");
  const m = model.trim();
  if (!m) throw new Error("empty_model");
  await setAppSetting("critic_provider", provider);
  await setAppSetting("critic_model", m);
  revalidatePath("/admin");
}

/** Beta allowlist: add an email (who can use the closed beta). Idempotent. */
export async function addAllowlistEmailAction(email: string): Promise<void> {
  await requireSuperAdmin();
  const e = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error("bad_email");
  const svc = createServiceClient();
  const { error } = await svc.from("egs_beta_allowlist").upsert({ email: e }, { onConflict: "email" });
  if (error) throw new Error(`addAllowlist: ${error.message}`);
  revalidatePath("/admin");
}

/** Beta allowlist: remove an email. */
export async function removeAllowlistEmailAction(email: string): Promise<void> {
  await requireSuperAdmin();
  const svc = createServiceClient();
  const { error } = await svc.from("egs_beta_allowlist").delete().eq("email", email);
  if (error) throw new Error(`removeAllowlist: ${error.message}`);
  revalidatePath("/admin");
}

/**
 * Approve a closed-beta applicant: mark the application approved AND add the email to the allowlist
 * (one click promotes them into the beta). Idempotent on both tables.
 */
export async function approveBetaApplicationAction(email: string): Promise<void> {
  await requireSuperAdmin();
  const e = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error("bad_email");
  const svc = createServiceClient();
  const { error: aErr } = await svc
    .from("egs_beta_applications")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("email", e);
  if (aErr) throw new Error(`approveBetaApplication: ${aErr.message}`);
  const { error: lErr } = await svc
    .from("egs_beta_allowlist")
    .upsert({ email: e, note: "approved from beta application" }, { onConflict: "email" });
  if (lErr) throw new Error(`approveBetaApplication allowlist: ${lErr.message}`);
  revalidatePath("/admin");
}

/** Reject a closed-beta applicant (also removes them from the allowlist if previously approved). */
export async function rejectBetaApplicationAction(email: string): Promise<void> {
  await requireSuperAdmin();
  const e = email.trim().toLowerCase();
  const svc = createServiceClient();
  const { error } = await svc
    .from("egs_beta_applications")
    .update({ status: "rejected", updated_at: new Date().toISOString() })
    .eq("email", e);
  if (error) throw new Error(`rejectBetaApplication: ${error.message}`);
  await svc.from("egs_beta_allowlist").delete().eq("email", e);
  revalidatePath("/admin");
}

/** Mark a problem report open/done (triage of the failure-capture flywheel). */
export async function setReportStatusAction(id: string, status: "open" | "done"): Promise<void> {
  await requireSuperAdmin();
  const svc = createServiceClient();
  const { error } = await svc
    .from("egs_reports")
    .update({ status: status === "done" ? "done" : "open" })
    .eq("id", id);
  if (error) throw new Error(`setReportStatus: ${error.message}`);
  revalidatePath("/admin");
}

/** Evenly distribute ALL users across the arms (round-robin) — for the even split. */
export async function autoBalanceArmsAction(): Promise<void> {
  await requireSuperAdmin();
  const svc = createServiceClient();
  const { data: list } = await svc.auth.admin.listUsers({ perPage: 1000 });
  const users = (list?.users ?? []).slice().sort((a, b) => a.id.localeCompare(b.id));
  const rows = users.map((u, i) => ({
    user_id: u.id,
    llm_provider: LLM_PROVIDERS[i % LLM_PROVIDERS.length],
  }));
  if (rows.length === 0) return;
  const { error } = await svc.from("egs_user_settings").upsert(rows, { onConflict: "user_id" });
  if (error) throw new Error(`autoBalance: ${error.message}`);
  revalidatePath("/admin");
}
