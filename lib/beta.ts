import Anthropic from "@anthropic-ai/sdk";
import { isSuperAdmin } from "@/lib/admin";
import { decrypt, encrypt } from "@/lib/crypto";
import { bangkokMonthStartISO } from "@/lib/month";
import { getBoolSetting, getNumberSetting } from "@/lib/settings";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Closed-beta gating, per-user daily quota, and optional BYOK (bring-your-own Anthropic key).
 * Server-only — all access goes through the service role (RLS denies clients on these tables).
 *
 * Hybrid model:
 *  - DEFAULT path: invite allowlist + the platform key + a per-user daily generation cap.
 *  - BYOK path (optional): the user stores their own Anthropic key (encrypted). BYOK users run on
 *    their own key and bypass the daily cap (they pay their own cost) and the allowlist.
 */

// Beta gating defaults ON unless BETA_MODE is "off"; the live value is admin-editable
// (egs_app_settings.beta_enforced) and only falls back to env when the row is absent.
const BETA_ENFORCED_FALLBACK = process.env.BETA_MODE !== "off";
const FALLBACK_DAILY_LIMIT = Number(process.env.EASYGAS_DAILY_LIMIT ?? 30);

/** Is closed beta enforced? Superadmin-set in egs_app_settings ('beta_enforced'); env fallback. */
export async function isBetaEnforced(): Promise<boolean> {
  return getBoolSetting("beta_enforced", BETA_ENFORCED_FALLBACK);
}

/** Per-user daily generation cap — superadmin-set in egs_app_settings ('daily_limit'); env fallback. */
export async function getDailyLimit(): Promise<number> {
  return getNumberSetting("daily_limit", FALLBACK_DAILY_LIMIT);
}

export interface AccessGate {
  allowed: boolean;
  reason: "ok" | "not_in_beta";
}

/** Is this email allowed in the closed beta? (Always true when beta is not enforced.) */
export async function isBetaAllowed(email: string | null | undefined): Promise<boolean> {
  if (!(await isBetaEnforced())) return true;
  if (!email) return false;
  const svc = createServiceClient();
  const { data } = await svc
    .from("egs_beta_allowlist")
    .select("email")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  return !!data;
}

/**
 * Whether the user may use the app at all. BYOK users are always allowed (own key, own cost);
 * otherwise they must be on the allowlist when beta is enforced.
 */
export async function getAccessGate(
  userId: string,
  email: string | null | undefined,
): Promise<AccessGate> {
  if (!(await isBetaEnforced())) return { allowed: true, reason: "ok" };
  if (await hasOwnApiKey(userId)) return { allowed: true, reason: "ok" };
  return (await isBetaAllowed(email))
    ? { allowed: true, reason: "ok" }
    : { allowed: false, reason: "not_in_beta" };
}

// ── BYOK ──

interface KeyRow {
  anthropic_key_enc: string | null;
  anthropic_key_iv: string | null;
  anthropic_key_tag: string | null;
}

export async function hasOwnApiKey(userId: string): Promise<boolean> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("egs_user_settings")
    .select("anthropic_key_enc")
    .eq("user_id", userId)
    .maybeSingle<{ anthropic_key_enc: string | null }>();
  return !!data?.anthropic_key_enc;
}

/** Decrypt the user's stored Anthropic key, or null if none. Server-only. */
export async function getOwnApiKey(userId: string): Promise<string | null> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("egs_user_settings")
    .select("anthropic_key_enc, anthropic_key_iv, anthropic_key_tag")
    .eq("user_id", userId)
    .maybeSingle<KeyRow>();
  if (!data?.anthropic_key_enc || !data.anthropic_key_iv || !data.anthropic_key_tag) return null;
  try {
    return decrypt({ enc: data.anthropic_key_enc, iv: data.anthropic_key_iv, tag: data.anthropic_key_tag });
  } catch {
    return null;
  }
}

/** Cheap liveness check that a key actually works before we store it. */
export async function validateAnthropicKey(key: string): Promise<boolean> {
  try {
    const client = new Anthropic({ apiKey: key });
    await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1,
      messages: [{ role: "user", content: "hi" }],
    });
    return true;
  } catch {
    return false;
  }
}

export async function setOwnApiKey(userId: string, key: string): Promise<void> {
  const secret = encrypt(key);
  const svc = createServiceClient();
  const { error } = await svc.from("egs_user_settings").upsert(
    {
      user_id: userId,
      anthropic_key_enc: secret.enc,
      anthropic_key_iv: secret.iv,
      anthropic_key_tag: secret.tag,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`setOwnApiKey: ${error.message}`);
}

export async function removeOwnApiKey(userId: string): Promise<void> {
  const svc = createServiceClient();
  const { error } = await svc
    .from("egs_user_settings")
    .update({
      anthropic_key_enc: null,
      anthropic_key_iv: null,
      anthropic_key_tag: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (error) throw new Error(`removeOwnApiKey: ${error.message}`);
}

// ── daily quota (default path only) ──

export interface QuotaStatus {
  used: number;
  limit: number;
  remaining: number;
}

/**
 * New-tool plan allowance (docs/MONETIZATION.md §3: Free 2 / Lite 3 / Starter 5 / Pro 15 per month).
 * Tiers/billing aren't wired yet, so every account shares one superadmin-editable cap
 * (egs_app_settings.monthly_tool_limit) — make it plan-based when billing lands. The unit is
 * "เครื่องมือใหม่/เดือน"; EDITING an existing tool never creates a project row, so it never counts
 * against this (energy/token tank handles edit cost — §6).
 */
export const FREE_MONTHLY_TOOLS_FALLBACK = 2;

/** Monthly NEW-tool allowance (admin-editable; falls back to the Free default). */
export async function getMonthlyToolLimit(): Promise<number> {
  return getNumberSetting("monthly_tool_limit", FREE_MONTHLY_TOOLS_FALLBACK);
}

/** "เหลือสร้างใหม่ N ตัว" — NEW tools (projects) the user created this calendar month vs the plan. */
export async function getMonthlyToolUsage(userId: string): Promise<QuotaStatus> {
  const svc = createServiceClient();
  const monthStart = bangkokMonthStartISO(); // Thai-month boundary (matches the credit pool reset)
  // INTENTIONALLY counts soft-deleted projects too (no deleted_at filter): the quota is "tools
  // created this month", so deleting one must NOT refund it — otherwise create→delete bypasses the cap.
  const { count } = await svc
    .from("egs_projects")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId)
    .gte("created_at", monthStart);
  const used = count ?? 0;
  const limit = await getMonthlyToolLimit();
  return { used, limit, remaining: Math.max(0, limit - used) };
}

/**
 * May this user create a NEW tool right now? BYOK (own key) and superadmins are unlimited;
 * everyone else is held to the plan's monthly new-tool allowance (Free for now — §3).
 */
export async function canCreateNewTool(
  userId: string,
  email: string | null | undefined,
): Promise<{ ok: boolean; usage: QuotaStatus }> {
  if (isSuperAdmin(email) || (await hasOwnApiKey(userId))) {
    const inf = Number.POSITIVE_INFINITY;
    return { ok: true, usage: { used: 0, limit: inf, remaining: inf } };
  }
  const usage = await getMonthlyToolUsage(userId);
  return { ok: usage.remaining > 0, usage };
}

export async function getDailyUsage(userId: string): Promise<QuotaStatus> {
  const svc = createServiceClient();
  const limit = await getDailyLimit();
  const { data } = await svc
    .from("egs_usage_daily")
    .select("requests")
    .eq("user_id", userId)
    .eq("day", new Date().toISOString().slice(0, 10))
    .maybeSingle<{ requests: number }>();
  const used = data?.requests ?? 0;
  return { used, limit, remaining: Math.max(0, limit - used) };
}

/**
 * Atomically count one generation against today's cap. Returns ok:false (without incrementing)
 * when the cap is already reached. Uses an RPC-free upsert + guarded increment.
 */
export async function checkAndConsumeQuota(
  userId: string,
): Promise<{ ok: boolean } & QuotaStatus> {
  const svc = createServiceClient();
  const limit = await getDailyLimit();
  const day = new Date().toISOString().slice(0, 10);
  // ensure a row exists, then increment only if under the cap
  await svc.from("egs_usage_daily").upsert({ user_id: userId, day }, { onConflict: "user_id,day" });
  const { data } = await svc
    .from("egs_usage_daily")
    .update({ requests: (await currentRequests(svc, userId, day)) + 1 })
    .eq("user_id", userId)
    .eq("day", day)
    .lt("requests", limit)
    .select("requests")
    .maybeSingle<{ requests: number }>();

  if (!data) {
    // cap reached (the .lt guard matched no row)
    const used = await currentRequests(svc, userId, day);
    return { ok: false, used, limit, remaining: 0 };
  }
  return {
    ok: true,
    used: data.requests,
    limit,
    remaining: Math.max(0, limit - data.requests),
  };
}

async function currentRequests(
  svc: ReturnType<typeof createServiceClient>,
  userId: string,
  day: string,
): Promise<number> {
  const { data } = await svc
    .from("egs_usage_daily")
    .select("requests")
    .eq("user_id", userId)
    .eq("day", day)
    .maybeSingle<{ requests: number }>();
  return data?.requests ?? 0;
}
