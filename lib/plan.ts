import { isSuperAdmin } from "@/lib/admin";
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
    highlights: ["AI: DeepSeek", "สร้างใหม่ 2 ตัว/เดือน", "80 แต้ม/เดือน", "ติดตั้งบน Google ของคุณ"],
  },
  lite: {
    label: "Lite",
    priceThb: 149,
    yearlyThb: 1490,
    arm: "zai",
    tools: 3,
    pool: 1_500_000,
    highlights: ["AI: GLM (สวย/ฉลาดกว่า)", "สร้างใหม่ 3 ตัว/เดือน", "150 แต้ม/เดือน", "โดเมนตัวเอง · ไม่มี badge · ใช้เชิงพาณิชย์"],
  },
  starter: {
    label: "Starter",
    priceThb: 299,
    yearlyThb: 2990,
    arm: "zai",
    tools: 5,
    pool: 2_500_000,
    highlights: ["AI: GLM", "สร้างใหม่ 5 ตัว/เดือน", "250 แต้ม/เดือน", "Supabase (กล้อง/realtime) · LINE priority"],
  },
  pro: {
    label: "Pro",
    priceThb: 990,
    yearlyThb: 9900,
    arm: "zai",
    tools: 15,
    pool: 6_000_000,
    highlights: ["AI: GLM", "สร้างใหม่ 15 ตัว/เดือน", "600 แต้ม/เดือน", "BYO-Supabase · priority + onboarding"],
  },
};

export function normalizePlan(v: unknown): Plan {
  return v === "lite" || v === "starter" || v === "pro" ? v : "free";
}

/** The user's billing plan (egs_user_settings.plan). Superadmin is treated as 'pro'. */
export async function getUserPlan(userId: string, email?: string | null): Promise<Plan> {
  if (isSuperAdmin(email)) return "pro";
  const svc = createServiceClient();
  const { data } = await svc
    .from("egs_user_settings")
    .select("plan")
    .eq("user_id", userId)
    .maybeSingle<{ plan: string | null }>();
  return normalizePlan(data?.plan);
}

/** Config for the user's current plan (pool / tools / arm / pricing). */
export async function getUserPlanConfig(userId: string, email?: string | null): Promise<PlanConfig> {
  return PLAN_CONFIG[await getUserPlan(userId, email)];
}
