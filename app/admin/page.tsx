import { redirect } from "next/navigation";
import { isSuperAdmin } from "@/lib/admin";
import { LLM_PROVIDERS, type LlmProvider } from "@/lib/llm/provider";
import { getCurrentUser } from "@/lib/projects";
import { createServiceClient } from "@/lib/supabase/service";
import { AdminPanel, type AdminUser, type ArmMetric } from "@/components/admin/AdminPanel";

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
        .select("provider, project_id, input_tokens, output_tokens, critic_issues, duration_ms, outcome, rating"),
      svc.from("egs_provider_config").select("provider, model"),
      svc.from("egs_app_settings").select("value").eq("key", "default_provider").maybeSingle(),
    ]);
  const { data: projectRows } = await svc.from("egs_projects").select("id, name");
  const projectName = new Map((projectRows ?? []).map((p) => [p.id as string, p.name as string]));

  const modelByProvider = new Map(
    (pcfg ?? []).map((r) => [r.provider as LlmProvider, r.model as string]),
  );
  const models = LLM_PROVIDERS.map((p) => ({ provider: p, model: modelByProvider.get(p) ?? "" }));
  const defaultProvider = ((appcfg?.value as LlmProvider) ?? "claude") as LlmProvider;

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

  return (
    <AdminPanel
      users={users}
      metrics={metrics}
      models={models}
      defaultProvider={defaultProvider}
      summary={summary}
      projects={projects}
    />
  );
}
