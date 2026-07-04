"use server";

import { revalidatePath } from "next/cache";
import { isSuperAdmin } from "@/lib/admin";
import { sendBetaApprovedEmail } from "@/lib/email";
import { LLM_PROVIDERS, type LlmProvider } from "@/lib/llm/provider";
import { PLAN_PERIOD_DAYS } from "@/lib/plan";
import { getCurrentUser } from "@/lib/projects";
import { sendPushToUser } from "@/lib/push";
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

/** Set the free monthly token pool per user (pooled across projects) — egs_app_settings.free_monthly_pool. */
export async function setMonthlyPoolAction(tokens: number): Promise<void> {
  await requireSuperAdmin();
  const n = Math.floor(tokens);
  if (!Number.isFinite(n) || n < 10_000 || n > 100_000_000) throw new Error("bad_pool");
  await setAppSetting("free_monthly_pool", String(n));
  revalidatePath("/admin");
}

/** Approve an upgrade request → set the user's plan + GLM arm, mark the request approved. */
export async function approveUpgradeAction(requestId: string): Promise<void> {
  await requireSuperAdmin();
  const svc = createServiceClient();
  const { data: req } = await svc
    .from("egs_upgrade_requests")
    .select("user_id, plan, status")
    .eq("id", requestId)
    .maybeSingle<{ user_id: string; plan: string; status: string }>();
  if (!req || req.status !== "pending") throw new Error("bad_request");
  const expires = new Date(Date.now() + PLAN_PERIOD_DAYS * 24 * 3600 * 1000).toISOString();
  if (req.plan === "byo") {
    // BYO add-on: enable the entitlement + 30-day expiry (their stored key now gets honored). Do NOT
    // touch plan/arm — getUserProvider locks them to Claude on their own key while BYO is active.
    await svc.from("egs_user_settings").upsert(
      { user_id: req.user_id, byo_enabled: true, byo_expires_at: expires, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  } else {
    // paid tier → GLM arm + 30-day expiry (NEW projects use GLM; existing via re-point)
    await svc.from("egs_user_settings").upsert(
      { user_id: req.user_id, plan: req.plan, plan_expires_at: expires, llm_provider: "zai", updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  }
  await svc
    .from("egs_upgrade_requests")
    .update({ status: "approved", decided_at: new Date().toISOString() })
    .eq("id", requestId);
  await sendPushToUser(req.user_id, {
    title: "🎉 แพ็กเกจของคุณเปิดใช้งานแล้ว",
    body:
      req.plan === "byo"
        ? "BYO เปิดใช้งานแล้ว — ใส่ Anthropic key ของคุณได้ที่หน้าตั้งค่า"
        : "อัปเกรดสำเร็จ เริ่มใช้โควตาใหม่ได้ทันที",
    url: req.plan === "byo" ? "/settings" : "/projects",
    tag: "plan-approved",
  });
  revalidatePath("/admin");
}

/** Reject an upgrade request (no plan change). */
export async function rejectUpgradeAction(requestId: string): Promise<void> {
  await requireSuperAdmin();
  const svc = createServiceClient();
  await svc
    .from("egs_upgrade_requests")
    .update({ status: "rejected", decided_at: new Date().toISOString() })
    .eq("id", requestId);
  revalidatePath("/admin");
}

const PLAN_PERIOD_MS = PLAN_PERIOD_DAYS * 24 * 3600 * 1000;

/** Extend a user's plan by 30 days (from the later of now / current expiry). */
export async function extendPlanAction(userId: string): Promise<void> {
  await requireSuperAdmin();
  const svc = createServiceClient();
  const { data } = await svc
    .from("egs_user_settings")
    .select("plan_expires_at")
    .eq("user_id", userId)
    .maybeSingle<{ plan_expires_at: string | null }>();
  const cur = data?.plan_expires_at ? new Date(data.plan_expires_at).getTime() : 0;
  const base = cur > Date.now() ? cur : Date.now();
  await svc
    .from("egs_user_settings")
    .update({ plan_expires_at: new Date(base + PLAN_PERIOD_MS).toISOString(), updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  revalidatePath("/admin");
}

/** Change a user's paid plan (resets expiry to +30 days, GLM arm). */
export async function setPlanAction(userId: string, plan: string): Promise<void> {
  await requireSuperAdmin();
  if (plan !== "lite" && plan !== "starter" && plan !== "pro") throw new Error("bad_plan");
  const svc = createServiceClient();
  await svc.from("egs_user_settings").upsert(
    {
      user_id: userId,
      plan,
      plan_expires_at: new Date(Date.now() + PLAN_PERIOD_MS).toISOString(),
      llm_provider: "zai",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  revalidatePath("/admin");
}

/**
 * Grant ANY user a paid plan with an EXPLICIT expiry date (the admin "add subscriber" tool). expiresAt
 * is a yyyy-mm-dd calendar date (the UI defaults it to +30 days) stored as Thai end-of-day, so the plan
 * stays active through that whole day. Sets the GLM arm like the slip-approval path. Used to add the
 * founder (easygaside) — or any comped user — onto a real plan instead of a virtual override.
 */
export async function grantPlanAction(userId: string, plan: string, expiresAt: string): Promise<void> {
  await requireSuperAdmin();
  if (!userId) throw new Error("bad_user");
  if (plan !== "lite" && plan !== "starter" && plan !== "pro") throw new Error("bad_plan");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)) throw new Error("bad_date");
  const expiresIso = new Date(`${expiresAt}T23:59:59+07:00`).toISOString();
  if (Number.isNaN(new Date(expiresIso).getTime())) throw new Error("bad_date");
  const svc = createServiceClient();
  const { error } = await svc.from("egs_user_settings").upsert(
    {
      user_id: userId,
      plan,
      plan_expires_at: expiresIso,
      llm_provider: "zai",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`grantPlan: ${error.message}`);
  revalidatePath("/admin");
}

/**
 * Manually enable the BYO add-on for a user (founder grant, no slip) with an explicit expiry date
 * (UI defaults +30 days). Their stored Anthropic key is honored while this is active.
 */
export async function grantByoAction(userId: string, expiresAt: string): Promise<void> {
  await requireSuperAdmin();
  if (!userId) throw new Error("bad_user");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)) throw new Error("bad_date");
  const expiresIso = new Date(`${expiresAt}T23:59:59+07:00`).toISOString();
  if (Number.isNaN(new Date(expiresIso).getTime())) throw new Error("bad_date");
  const svc = createServiceClient();
  const { error } = await svc.from("egs_user_settings").upsert(
    { user_id: userId, byo_enabled: true, byo_expires_at: expiresIso, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`grantByo: ${error.message}`);
  revalidatePath("/admin");
}

/** Cancel a user's plan → back to free (clears expiry + the GLM arm override). */
export async function cancelPlanAction(userId: string): Promise<void> {
  await requireSuperAdmin();
  const svc = createServiceClient();
  await svc
    .from("egs_user_settings")
    .update({ plan: "free", plan_expires_at: null, llm_provider: null, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  revalidatePath("/admin");
}

/** Set a PAID plan's monthly pool (tokens) + new-tool allowance — egs_plan_config. */
export async function setPlanLimitsAction(plan: string, pool: number, tools: number): Promise<void> {
  await requireSuperAdmin();
  if (plan !== "lite" && plan !== "starter" && plan !== "pro") throw new Error("bad_plan");
  const p = Math.floor(pool);
  const t = Math.floor(tools);
  if (!Number.isFinite(p) || p < 10_000 || p > 100_000_000) throw new Error("bad_pool");
  if (!Number.isFinite(t) || t < 1 || t > 100000) throw new Error("bad_tools");
  const svc = createServiceClient();
  const { error } = await svc.from("egs_plan_config").upsert({ plan, pool: p, tools: t }, { onConflict: "plan" });
  if (error) throw new Error(`setPlanLimits: ${error.message}`);
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

/**
 * Set the per-arm API base URL override — egs_provider_config.base_url (OpenAI-family arms).
 * Empty string clears it (falls back to env/static default). Must be an https URL when set.
 */
export async function setProviderBaseUrlAction(provider: LlmProvider, baseUrl: string): Promise<void> {
  await requireSuperAdmin();
  if (!LLM_PROVIDERS.includes(provider)) throw new Error("bad_provider");
  const url = baseUrl.trim();
  if (url && !/^https:\/\/[^\s]+$/i.test(url)) throw new Error("bad_url");
  const svc = createServiceClient();
  const { error } = await svc
    .from("egs_provider_config")
    .upsert({ provider, base_url: url || null }, { onConflict: "provider" });
  if (error) throw new Error(`setProviderBaseUrl: ${error.message}`);
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

/** Set the vision-proxy arm — which vision model describes attached images for text-only codegen arms. */
export async function setVisionProviderAction(provider: string): Promise<void> {
  await requireSuperAdmin();
  if (provider !== "gemini" && provider !== "chatgpt" && provider !== "claude")
    throw new Error("bad_vision_provider");
  await setAppSetting("vision_provider", provider);
  revalidatePath("/admin");
}

/** Finance: record a received payment (THB). Payment is manual (PromptPay), so admin enters it. */
export async function addPaymentAction(amountThb: number, note: string, paidAt?: string): Promise<void> {
  await requireSuperAdmin();
  const amt = Number(amountThb);
  if (!Number.isFinite(amt) || amt < 0 || amt > 100_000_000) throw new Error("bad_amount");
  const svc = createServiceClient();
  const row: Record<string, unknown> = { amount_thb: amt, note: note.trim() || null };
  if (paidAt && /^\d{4}-\d{2}-\d{2}$/.test(paidAt)) row.paid_at = paidAt;
  const { error } = await svc.from("egs_payments").insert(row);
  if (error) throw new Error(`addPayment: ${error.message}`);
  revalidatePath("/admin");
}

/** Finance: delete a payment row. */
export async function deletePaymentAction(id: string): Promise<void> {
  await requireSuperAdmin();
  const svc = createServiceClient();
  const { error } = await svc.from("egs_payments").delete().eq("id", id);
  if (error) throw new Error(`deletePayment: ${error.message}`);
  revalidatePath("/admin");
}

/** Finance: USD→THB rate used to convert provider COGS to baht (egs_app_settings.usd_thb_rate). */
export async function setFxRateAction(rate: number): Promise<void> {
  await requireSuperAdmin();
  const r = Number(rate);
  if (!Number.isFinite(r) || r <= 0 || r > 1000) throw new Error("bad_rate");
  await setAppSetting("usd_thb_rate", String(r));
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
  const { data: app, error: aErr } = await svc
    .from("egs_beta_applications")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("email", e)
    .select("name")
    .maybeSingle<{ name: string | null }>();
  if (aErr) throw new Error(`approveBetaApplication: ${aErr.message}`);
  const { error: lErr } = await svc
    .from("egs_beta_allowlist")
    .upsert({ email: e, note: "approved from beta application" }, { onConflict: "email" });
  if (lErr) throw new Error(`approveBetaApplication allowlist: ${lErr.message}`);
  // Best-effort: tell the applicant they're in. A mail failure must not fail the approval.
  await sendBetaApprovedEmail(e, app?.name ?? null);
  revalidatePath("/admin");
}

/**
 * Approve many applicants in one shot (multi-select in /admin). Each row is approved + allowlisted
 * + emailed independently; a failure on one doesn't abort the rest. Returns how many were approved
 * and how many emails actually went out (email is best-effort).
 */
export async function approveBetaApplicationsAction(
  emails: string[],
): Promise<{ approved: number; emailed: number }> {
  await requireSuperAdmin();
  const svc = createServiceClient();
  let approved = 0;
  let emailed = 0;
  for (const raw of emails) {
    const e = raw.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) continue;
    const { data: app, error: aErr } = await svc
      .from("egs_beta_applications")
      .update({ status: "approved", updated_at: new Date().toISOString() })
      .eq("email", e)
      .select("name")
      .maybeSingle<{ name: string | null }>();
    if (aErr) continue;
    const { error: lErr } = await svc
      .from("egs_beta_allowlist")
      .upsert({ email: e, note: "approved from beta application" }, { onConflict: "email" });
    if (lErr) continue;
    approved++;
    if (await sendBetaApprovedEmail(e, app?.name ?? null)) emailed++;
  }
  revalidatePath("/admin");
  return { approved, emailed };
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
