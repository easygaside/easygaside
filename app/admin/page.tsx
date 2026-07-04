import { redirect } from "next/navigation";
import { isSuperAdmin } from "@/lib/admin";
import { LLM_PROVIDERS, type LlmProvider } from "@/lib/llm/provider";
import { getCurrentUser } from "@/lib/projects";
import { createServiceClient } from "@/lib/supabase/service";
import { DEFAULT_USD_THB, genCostUsd } from "@/lib/pricing";
import { AdminPanel, type AdminUser, type ArmMetric, type FinanceData, type UserMetric } from "@/components/admin/AdminPanel";
import type { AllowlistEntry } from "@/components/admin/AllowlistManager";
import type { BetaApplication } from "@/components/admin/BetaApplicationsViewer";
import type { UpgradeRequest } from "@/components/admin/UpgradeRequestsViewer";
import type { Subscriber } from "@/components/admin/SubscribersViewer";
import { getUserMonthlyEnergyUsed } from "@/lib/energy";
import { bangkokMonthStartISO } from "@/lib/month";
import { getPlanLimits } from "@/lib/plan";
import type { FailureReport } from "@/components/admin/ReportsViewer";

export const metadata = { title: "Admin — EasyGAS IDE" };

interface GenRow {
  provider: string;
  model: string | null;
  project_id: string | null;
  user_id: string | null;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  critic_issues: number;
  duration_ms: number | null;
  outcome: string | null;
  rating: number | null;
  created_at: string;
}

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isSuperAdmin(user.email)) redirect("/projects");

  const svc = createServiceClient();
  // Mirror the env superadmin allowlist into egs_admins (source of truth stays the env var).
  // Needed in-database for the live-chat Realtime policy + admin push fan-out.
  await svc
    .from("egs_admins")
    .upsert({ user_id: user.id, email: user.email ?? "" }, { onConflict: "user_id" });
  const [{ data: list }, { data: settings }, { data: gens }, { data: pcfg }, { data: appcfg }, { data: plancfg }] =
    await Promise.all([
      svc.auth.admin.listUsers({ perPage: 1000 }),
      svc.from("egs_user_settings").select("user_id, llm_provider, plan, plan_expires_at"),
      svc
        .from("egs_generations")
        .select(
          "provider, model, project_id, user_id, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, critic_issues, duration_ms, outcome, rating, created_at",
        ),
      svc.from("egs_provider_config").select("provider, model, energy_tank, base_url"),
      svc.from("egs_app_settings").select("key, value"),
      svc.from("egs_plan_config").select("plan, pool, tools"),
    ]);
  const [
    { data: projectRows },
    { data: allowRows },
    { data: reportRows },
    { data: appRows },
    { data: payRows },
    { data: upgradeRows },
    { count: supportUnread },
  ] = await Promise.all([
      svc.from("egs_projects").select("id, name"),
      svc.from("egs_beta_allowlist").select("email, note, created_at").order("created_at", { ascending: true }),
      svc
        .from("egs_reports")
        .select("id, kind, message, project_id, url, code_snapshot, status, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      svc
        .from("egs_beta_applications")
        .select(
          "email, email_verified, name, business_type, build_idea, tech_level, device, willing_feedback, status, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(200),
      svc.from("egs_payments").select("id, amount_thb, note, paid_at").order("paid_at", { ascending: false }),
      svc
        .from("egs_upgrade_requests")
        .select("id, email, plan, amount_thb, slip_path, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true }),
      // unread live-chat messages from customers → badge on the แชทสด tab
      svc
        .from("egs_support_messages")
        .select("id", { count: "exact", head: true })
        .eq("sender", "user")
        .is("read_at", null),
    ]);
  const projectName = new Map((projectRows ?? []).map((p) => [p.id as string, p.name as string]));

  const allowlist: AllowlistEntry[] = (allowRows ?? []) as AllowlistEntry[];
  const reports: FailureReport[] = ((reportRows ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    kind: (r.kind as string) ?? "bug",
    message: (r.message as string) ?? "",
    project: r.project_id ? projectName.get(r.project_id as string) ?? null : null,
    url: (r.url as string | null) ?? null,
    status: (r.status as string) ?? "open",
    created_at: (r.created_at as string) ?? "",
    files: Array.isArray(r.code_snapshot) ? (r.code_snapshot as { path: string; content: string }[]) : null,
  }));
  const APP_STATUS_ORDER: Record<string, number> = { pending: 0, approved: 1, rejected: 2 };
  const applications: BetaApplication[] = ((appRows ?? []) as Record<string, unknown>[])
    .map((a) => ({
      email: a.email as string,
      emailVerified: !!a.email_verified,
      name: (a.name as string | null) ?? null,
      businessType: (a.business_type as string | null) ?? null,
      buildIdea: (a.build_idea as string) ?? "",
      techLevel: (a.tech_level as string | null) ?? null,
      device: (a.device as string | null) ?? null,
      willingFeedback: !!a.willing_feedback,
      status: (a.status as string) ?? "pending",
      createdAt: (a.created_at as string) ?? "",
    }))
    .sort((x, y) => (APP_STATUS_ORDER[x.status] ?? 9) - (APP_STATUS_ORDER[y.status] ?? 9));
  const upgradeRequests: UpgradeRequest[] = await Promise.all(
    ((upgradeRows ?? []) as Record<string, unknown>[]).map(async (u) => {
      let slipUrl: string | null = null;
      const path = u.slip_path as string | null;
      if (path) {
        const { data } = await svc.storage.from("egs-slips").createSignedUrl(path, 3600);
        slipUrl = data?.signedUrl ?? null;
      }
      return {
        id: u.id as string,
        email: (u.email as string | null) ?? null,
        plan: (u.plan as string) ?? "",
        amountThb: Number(u.amount_thb ?? 0),
        slipUrl,
        createdAt: (u.created_at as string) ?? "",
      };
    }),
  );
  const providerKeys: Record<LlmProvider, boolean> = {
    claude: !!process.env.ANTHROPIC_API_KEY,
    chatgpt: !!process.env.OPENAI_API_KEY,
    deepseek: !!process.env.DEEPSEEK_API_KEY,
    "deepseek-pro": !!process.env.DEEPSEEK_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
    zai: !!process.env.ZAI_API_KEY,
  };

  const cfgByProvider = new Map(
    (pcfg ?? []).map((r) => [r.provider as LlmProvider, r as { model: string; energy_tank: number | null; base_url: string | null }]),
  );
  const models = LLM_PROVIDERS.map((p) => ({
    provider: p,
    model: cfgByProvider.get(p)?.model ?? "",
    energyTank: Number(cfgByProvider.get(p)?.energy_tank ?? 0) || 0,
    baseUrl: cfgByProvider.get(p)?.base_url ?? "",
  }));
  const appSettings = new Map((appcfg ?? []).map((r) => [r.key as string, r.value as string]));
  const planLimitsMap = new Map((plancfg ?? []).map((r) => [r.plan as string, r as { pool: number; tools: number }]));
  const planLimits = (["lite", "starter", "pro"] as const).map((p) => ({
    plan: p,
    pool: Number(planLimitsMap.get(p)?.pool ?? 0) || 0,
    tools: Number(planLimitsMap.get(p)?.tools ?? 0) || 0,
  }));
  const defaultProvider = ((appSettings.get("default_provider") as LlmProvider) ?? "claude") as LlmProvider;
  const dailyLimit = Number(appSettings.get("daily_limit") ?? 30) || 30;
  const monthlyToolLimit = Number(appSettings.get("monthly_tool_limit") ?? 2) || 2;
  const freeMonthlyPool = Number(appSettings.get("free_monthly_pool") ?? 800000) || 800000;
  const energyTankDefault = Number(appSettings.get("energy_tank_default") ?? 400000) || 400000;
  const betaEnforced =
    (appSettings.get("beta_enforced") ?? (process.env.BETA_MODE !== "off" ? "on" : "off")) !== "off";

  // shared rulebook critic (gate 1) — backend + model, with env fallback for the provider
  const criticProvider =
    (appSettings.get("critic_provider") ?? process.env.CRITIC_PROVIDER ?? "deepseek") === "claude"
      ? "claude"
      : "deepseek";
  const criticModel =
    appSettings.get("critic_model") ||
    process.env.CRITIC_MODEL ||
    (criticProvider === "claude" ? "claude-haiku-4-5-20251001" : "deepseek-chat");
  const criticKeyReady =
    criticProvider === "claude" ? !!process.env.ANTHROPIC_API_KEY : !!process.env.DEEPSEEK_API_KEY;

  // vision proxy: which vision arm describes attached images for text-only codegen arms
  const visionProvider = (appSettings.get("vision_provider") ?? "gemini") as "gemini" | "chatgpt" | "claude";

  const armByUser = new Map(
    (settings ?? []).map((s) => [s.user_id as string, s.llm_provider as LlmProvider | null]),
  );
  const users: AdminUser[] = (list?.users ?? []).map((u) => ({
    id: u.id,
    email: u.email ?? "(no email)",
    arm: armByUser.get(u.id) ?? "claude",
  }));

  // per-arm aggregates (incl. total tokens by provider)
  const rows = (gens ?? []) as GenRow[];
  const tok = (r: GenRow) => r.input_tokens + r.output_tokens;
  const metrics: ArmMetric[] = LLM_PROVIDERS.map((p) => {
    const g = rows.filter((r) => r.provider === p);
    const n = g.length || 1;
    const sum = (f: (r: GenRow) => number) => g.reduce((a, r) => a + f(r), 0);
    return {
      provider: p,
      assigned: users.filter((u) => u.arm === p).length,
      gens: g.length,
      inTok: sum((r) => r.input_tokens),
      outTok: sum((r) => r.output_tokens),
      avgInTok: Math.round(sum((r) => r.input_tokens) / n),
      avgOutTok: Math.round(sum((r) => r.output_tokens) / n),
      avgCritic: +(sum((r) => r.critic_issues) / n).toFixed(2),
      avgSec: +(sum((r) => r.duration_ms ?? 0) / n / 1000).toFixed(1),
      okRate: g.length ? Math.round((g.filter((r) => r.outcome === "ok").length / g.length) * 100) : 0,
      up: g.filter((r) => r.rating === 1).length,
      down: g.filter((r) => r.rating === -1).length,
    };
  });

  // per-user aggregates — who is actually generating, how much, and their satisfaction signal
  const userAgg = new Map<string, { gens: number; tokens: number; up: number; down: number; last: string }>();
  for (const r of rows) {
    if (!r.user_id) continue;
    const cur = userAgg.get(r.user_id) ?? { gens: 0, tokens: 0, up: 0, down: 0, last: "" };
    cur.gens += 1;
    cur.tokens += tok(r);
    if (r.rating === 1) cur.up += 1;
    if (r.rating === -1) cur.down += 1;
    if ((r.created_at ?? "") > cur.last) cur.last = r.created_at ?? "";
    userAgg.set(r.user_id, cur);
  }
  const emailById = new Map(users.map((u) => [u.id, u.email]));
  const monthStart = bangkokMonthStartISO();
  const subscribers: Subscriber[] = await Promise.all(
    ((settings ?? []) as { user_id: string; plan: string | null; plan_expires_at: string | null }[])
      .filter((s) => s.plan && s.plan !== "free")
      .map(async (s) => {
        const plan = s.plan as "lite" | "starter" | "pro";
        const limits = await getPlanLimits(plan);
        const [poolUsed, toolCount] = await Promise.all([
          getUserMonthlyEnergyUsed(s.user_id),
          svc.from("egs_projects").select("id", { count: "exact", head: true }).eq("owner_id", s.user_id).gte("created_at", monthStart),
        ]);
        const toolsUsed = toolCount.count ?? 0;
        return {
          userId: s.user_id,
          email: emailById.get(s.user_id) ?? s.user_id,
          plan,
          expiresAt: s.plan_expires_at,
          toolsLeft: Math.max(0, limits.tools - toolsUsed),
          toolsLimit: limits.tools,
          creditsLeft: Math.floor(Math.max(0, limits.pool - poolUsed) / 10000),
          creditsLimit: Math.floor(limits.pool / 10000),
        };
      }),
  );
  const armById = new Map(users.map((u) => [u.id, u.arm]));
  const userMetrics: UserMetric[] = [...userAgg.entries()]
    .map(([id, v]) => ({
      email: emailById.get(id) ?? id.slice(0, 8),
      arm: armById.get(id) ?? ("claude" as LlmProvider),
      gens: v.gens,
      tokens: v.tokens,
      up: v.up,
      down: v.down,
      lastActive: v.last || null,
    }))
    .sort((a, b) => b.tokens - a.tokens);

  // overall token summary
  const totalIn = rows.reduce((a, r) => a + r.input_tokens, 0);
  const totalOut = rows.reduce((a, r) => a + r.output_tokens, 0);

  // per-project tokens (+ average across all projects that generated)
  const byProject = new Map<string, { tokens: number; gens: number; critic: number }>();
  for (const r of rows) {
    if (!r.project_id) continue;
    const cur = byProject.get(r.project_id) ?? { tokens: 0, gens: 0, critic: 0 };
    cur.tokens += tok(r);
    cur.gens += 1;
    cur.critic += r.critic_issues;
    byProject.set(r.project_id, cur);
  }
  const projectCount = byProject.size;
  const projects = [...byProject.entries()]
    .map(([id, v]) => ({
      name: projectName.get(id) ?? id.slice(0, 8),
      tokens: v.tokens,
      gens: v.gens,
      criticIssues: v.critic,
    }))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 15);

  const totalCriticIssues = rows.reduce((a, r) => a + r.critic_issues, 0);
  const summary = {
    totalTokens: totalIn + totalOut,
    totalIn,
    totalOut,
    gens: rows.length,
    projectCount,
    avgPerProject: projectCount ? Math.round((totalIn + totalOut) / projectCount) : 0,
    totalCriticIssues,
    avgCriticPerGen: rows.length ? +(totalCriticIssues / rows.length).toFixed(2) : 0,
  };

  // ── finance: revenue (manual payments) + provider COGS (token × pricing), bucketed BY MONTH so the
  //    admin can pick any past month; the client switches instantly without a reload ──
  const fxRaw = Number(appSettings.get("usd_thb_rate"));
  const fxRate = Number.isFinite(fxRaw) && fxRaw > 0 ? fxRaw : DEFAULT_USD_THB;
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM (UTC)
  const payments = ((payRows ?? []) as { id: string; amount_thb: number; note: string | null; paid_at: string }[]).map(
    (p) => ({ id: p.id, amountThb: Number(p.amount_thb) || 0, note: p.note, paidAt: p.paid_at }),
  );
  const revenueByMonth: Record<string, number> = {};
  for (const p of payments) {
    const m = (p.paidAt ?? "").slice(0, 7);
    if (m) revenueByMonth[m] = (revenueByMonth[m] ?? 0) + p.amountThb;
  }
  const revenueTotalThb = payments.reduce((a, p) => a + p.amountThb, 0);

  const expenseByMonth: Record<string, Record<string, number>> = {};
  const expenseByProviderTotal: Record<string, number> = {};
  for (const r of rows) {
    const usd = genCostUsd(r);
    expenseByProviderTotal[r.provider] = (expenseByProviderTotal[r.provider] ?? 0) + usd;
    const m = (r.created_at ?? "").slice(0, 7);
    if (m) {
      const bucket = (expenseByMonth[m] ??= {});
      bucket[r.provider] = (bucket[r.provider] ?? 0) + usd;
    }
  }
  const months = [...new Set([currentMonth, ...Object.keys(revenueByMonth), ...Object.keys(expenseByMonth)])]
    .filter(Boolean)
    .sort()
    .reverse();
  const finance: FinanceData = {
    fxRate,
    currentMonth,
    months,
    revenueByMonth,
    expenseByMonth,
    revenueTotalThb,
    expenseByProviderTotal,
    providers: Object.entries(expenseByProviderTotal)
      .sort((a, b) => b[1] - a[1])
      .map(([p]) => p),
    payments: payments.slice(0, 50),
  };

  // daily token series (last 14 days) for the line chart
  const dayMap = new Map<string, number>();
  for (const r of rows) {
    const day = (r.created_at ?? "").slice(0, 10);
    if (!day) continue;
    dayMap.set(day, (dayMap.get(day) ?? 0) + tok(r));
  }
  const daily = [...Array(14)].map((_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - (13 - i));
    const key = d.toISOString().slice(0, 10);
    return { day: key.slice(5), tokens: dayMap.get(key) ?? 0 };
  });

  return (
    <AdminPanel
      users={users}
      metrics={metrics}
      models={models}
      defaultProvider={defaultProvider}
      dailyLimit={dailyLimit}
      monthlyToolLimit={monthlyToolLimit}
      freeMonthlyPool={freeMonthlyPool}
      planLimits={planLimits}
      energyTankDefault={energyTankDefault}
      betaEnforced={betaEnforced}
      criticProvider={criticProvider}
      criticModel={criticModel}
      criticKeyReady={criticKeyReady}
      visionProvider={visionProvider}
      summary={summary}
      projects={projects}
      daily={daily}
      allowlist={allowlist}
      reports={reports}
      applications={applications}
      upgradeRequests={upgradeRequests}
      subscribers={subscribers}
      userMetrics={userMetrics}
      finance={finance}
      providerKeys={providerKeys}
      supportUnread={supportUnread ?? 0}
    />
  );
}
