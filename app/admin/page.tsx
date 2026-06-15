import { redirect } from "next/navigation";
import { isSuperAdmin } from "@/lib/admin";
import { LLM_PROVIDERS, type LlmProvider } from "@/lib/llm/provider";
import { getCurrentUser } from "@/lib/projects";
import { createServiceClient } from "@/lib/supabase/service";
import { AdminPanel, type AdminUser, type ArmMetric } from "@/components/admin/AdminPanel";
import type { AllowlistEntry } from "@/components/admin/AllowlistManager";
import type { FailureReport } from "@/components/admin/ReportsViewer";

export const metadata = { title: "Admin — EasyGAS IDE" };

interface GenRow {
  provider: string;
  project_id: string | null;
  input_tokens: number;
  output_tokens: number;
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
  const [{ data: list }, { data: settings }, { data: gens }, { data: pcfg }, { data: appcfg }] =
    await Promise.all([
      svc.auth.admin.listUsers({ perPage: 1000 }),
      svc.from("egs_user_settings").select("user_id, llm_provider"),
      svc
        .from("egs_generations")
        .select("provider, project_id, input_tokens, output_tokens, critic_issues, duration_ms, outcome, rating, created_at"),
      svc.from("egs_provider_config").select("provider, model"),
      svc.from("egs_app_settings").select("key, value"),
    ]);
  const [{ data: projectRows }, { data: allowRows }, { data: reportRows }] = await Promise.all([
    svc.from("egs_projects").select("id, name"),
    svc.from("egs_beta_allowlist").select("email, note, created_at").order("created_at", { ascending: true }),
    svc
      .from("egs_reports")
      .select("id, kind, message, project_id, url, code_snapshot, status, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
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
  const providerKeys: Record<LlmProvider, boolean> = {
    claude: !!process.env.ANTHROPIC_API_KEY,
    chatgpt: !!process.env.OPENAI_API_KEY,
    deepseek: !!process.env.DEEPSEEK_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
  };

  const modelByProvider = new Map(
    (pcfg ?? []).map((r) => [r.provider as LlmProvider, r.model as string]),
  );
  const models = LLM_PROVIDERS.map((p) => ({ provider: p, model: modelByProvider.get(p) ?? "" }));
  const appSettings = new Map((appcfg ?? []).map((r) => [r.key as string, r.value as string]));
  const defaultProvider = ((appSettings.get("default_provider") as LlmProvider) ?? "claude") as LlmProvider;
  const dailyLimit = Number(appSettings.get("daily_limit") ?? 30) || 30;

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

  // overall token summary
  const totalIn = rows.reduce((a, r) => a + r.input_tokens, 0);
  const totalOut = rows.reduce((a, r) => a + r.output_tokens, 0);

  // per-project tokens (+ average across all projects that generated)
  const byProject = new Map<string, { tokens: number; gens: number }>();
  for (const r of rows) {
    if (!r.project_id) continue;
    const cur = byProject.get(r.project_id) ?? { tokens: 0, gens: 0 };
    cur.tokens += tok(r);
    cur.gens += 1;
    byProject.set(r.project_id, cur);
  }
  const projectCount = byProject.size;
  const projects = [...byProject.entries()]
    .map(([id, v]) => ({ name: projectName.get(id) ?? id.slice(0, 8), tokens: v.tokens, gens: v.gens }))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 15);

  const summary = {
    totalTokens: totalIn + totalOut,
    totalIn,
    totalOut,
    gens: rows.length,
    projectCount,
    avgPerProject: projectCount ? Math.round((totalIn + totalOut) / projectCount) : 0,
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
      summary={summary}
      projects={projects}
      daily={daily}
      allowlist={allowlist}
      reports={reports}
      providerKeys={providerKeys}
    />
  );
}
