import type { LlmProvider } from "@/lib/llm/catalog";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Billing plans (egs_user_settings.plan). free = DeepSeek arm + free pool/limits; every PAID tier =
 * GLM arm + bigger pool/limits (per the upgrade decision: "ทุกแพ็กเกจจ่ายเงิน = GLM"). The founder sets
 * the plan in /admin after approving a PromptPay slip (egs_upgrade_requests). Numbers track
 * MONETIZATION.md §3 — pools are starting values, tunable later.
 */

export type Plan = "free" | "lite" | "starter" | "pro";
export const PAID_PLANS: readonly Plan[] = ["lite", "starter", "pro"];
export const PURCHASABLE_PLANS: readonly Plan[] = ["lite", "starter", "pro"];

export function isPaidPlan(p: Plan): boolean {
  return PAID_PLANS.includes(p);
}

export interface PlanConfig {
  label: string;
  priceThb: number;
  yearlyThb: number;
  arm: LlmProvider; // free = DeepSeek; paid = GLM (z.ai)
  tools: number; // new tools / month
  pool: number; // monthly token pool (= pool/10000 แต้ม)
  highlights: string[]; // shown on the pricing page
}

export const PLAN_CONFIG: Record<Plan, PlanConfig> = {
  free: {
    label: "ฟรี",
    priceThb: 0,
    yearlyThb: 0,
    arm: "deepseek-pro",
    tools: 2,
    pool: 800_000,
    highlights: ["AI มาตรฐาน — สร้างได้จริง", "สร้างใหม่ 2 ตัว/เดือน", "80 แต้ม/เดือน", "ติดตั้งบน Google ของคุณ"],
  },
  lite: {
    label: "Lite",
    priceThb: 149,
    yearlyThb: 1490,
    arm: "zai",
    tools: 3,
    pool: 1_500_000,
    highlights: ["AI โมเดล Flagship — UI สวย + ฉลาดกว่า", "สร้างใหม่ 3 ตัว/เดือน", "150 แต้ม/เดือน", "โดเมนตัวเอง · ไม่มี badge · ใช้เชิงพาณิชย์"],
  },
  starter: {
    label: "Starter",
    priceThb: 299,
    yearlyThb: 2990,
    arm: "zai",
    tools: 5,
    pool: 2_500_000,
    highlights: ["AI โมเดล Flagship — UI สวย + ฉลาดกว่า", "สร้างใหม่ 5 ตัว/เดือน", "250 แต้ม/เดือน", "Supabase (กล้อง/realtime) · LINE priority"],
  },
  pro: {
    label: "Pro",
    priceThb: 990,
    yearlyThb: 9900,
    arm: "zai",
    tools: 15,
    pool: 6_000_000,
    highlights: ["AI โมเดล Flagship — UI สวย + ฉลาดกว่า", "สร้างใหม่ 15 ตัว/เดือน", "600 แต้ม/เดือน", "BYO-Supabase · priority + onboarding"],
  },
};

export function normalizePlan(v: unknown): Plan {
  return v === "lite" || v === "starter" || v === "pro" ? v : "free";
}

/** Days a paid plan lasts before it lapses (set on approval/extend). */
export const PLAN_PERIOD_DAYS = 30;

/**
 * The user's EFFECTIVE billing plan (egs_user_settings.plan) — shown verbatim everywhere (no virtual
 * superadmin override; the founder grants themselves a real plan in /admin). A paid plan whose
 * plan_expires_at is in the past auto-downgrades to 'free' at read time (no background job needed).
 */
export async function getUserPlan(userId: string, _email?: string | null): Promise<Plan> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("egs_user_settings")
    .select("plan, plan_expires_at")
    .eq("user_id", userId)
    .maybeSingle<{ plan: string | null; plan_expires_at: string | null }>();
  const plan = normalizePlan(data?.plan);
  if (plan !== "free" && data?.plan_expires_at && new Date(data.plan_expires_at).getTime() < Date.now())
    return "free";
  return plan;
}

/** Config for the user's current plan (pool / tools / arm / pricing). */
export async function getUserPlanConfig(userId: string, email?: string | null): Promise<PlanConfig> {
  return PLAN_CONFIG[await getUserPlan(userId, email)];
}

/**
 * Admin-editable per-PAID-plan limits (egs_plan_config), falling back to PLAN_CONFIG when no row.
 * Free tier keeps its own admin knobs (egs_app_settings free_monthly_pool / monthly_tool_limit).
 */
export async function getPlanLimits(plan: Plan): Promise<{ pool: number; tools: number }> {
  if (plan === "free") return { pool: PLAN_CONFIG.free.pool, tools: PLAN_CONFIG.free.tools };
  const svc = createServiceClient();
  const { data } = await svc
    .from("egs_plan_config")
    .select("pool, tools")
    .eq("plan", plan)
    .maybeSingle<{ pool: number; tools: number }>();
  const pool = Number(data?.pool);
  const tools = Number(data?.tools);
  return {
    pool: Number.isFinite(pool) && pool > 0 ? pool : PLAN_CONFIG[plan].pool,
    tools: Number.isFinite(tools) && tools > 0 ? tools : PLAN_CONFIG[plan].tools,
  };
}
