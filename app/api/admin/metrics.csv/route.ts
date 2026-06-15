import { NextResponse } from "next/server";
import { isSuperAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

/** GET /api/admin/metrics.csv → all generation metrics as CSV (superadmin only). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isSuperAdmin(user.email))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const svc = createServiceClient();
  const [{ data: gens }, { data: projs }] = await Promise.all([
    svc
      .from("egs_generations")
      .select(
        "created_at, provider, model, project_id, input_tokens, output_tokens, critic_issues, duration_ms, outcome, rating",
      )
      .order("created_at", { ascending: false }),
    svc.from("egs_projects").select("id, name"),
  ]);
  const name = new Map((projs ?? []).map((p) => [p.id as string, p.name as string]));

  const header = [
    "created_at",
    "provider",
    "model",
    "project",
    "input_tokens",
    "output_tokens",
    "critic_issues",
    "duration_ms",
    "outcome",
    "rating",
  ];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.join(",")];
  for (const g of (gens ?? []) as Record<string, unknown>[]) {
    lines.push(
      [
        g.created_at,
        g.provider,
        g.model,
        name.get(g.project_id as string) ?? g.project_id ?? "",
        g.input_tokens,
        g.output_tokens,
        g.critic_issues,
        g.duration_ms,
        g.outcome,
        g.rating,
      ]
        .map(esc)
        .join(","),
    );
  }
  // BOM so Excel reads UTF-8 (Thai project names) correctly
  const csv = "﻿" + lines.join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="easygas-metrics.csv"',
    },
  });
}
