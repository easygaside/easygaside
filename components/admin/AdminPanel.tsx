"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import {
  autoBalanceArmsAction,
  setDailyLimitAction,
  setDefaultProviderAction,
  setProviderModelAction,
  setUserArmAction,
} from "@/app/admin/actions";
import { LLM_PROVIDERS, type LlmProvider } from "@/lib/llm/provider";

export interface AdminUser {
  id: string;
  email: string;
  arm: LlmProvider;
}
export interface ArmMetric {
  provider: LlmProvider;
  assigned: number;
  gens: number;
  inTok: number;
  outTok: number;
  avgInTok: number;
  avgOutTok: number;
  avgCritic: number;
  avgSec: number;
  okRate: number;
  up: number;
  down: number;
}
export interface TokenSummary {
  totalTokens: number;
  totalIn: number;
  totalOut: number;
  gens: number;
  projectCount: number;
  avgPerProject: number;
}
export interface ProjectTokens {
  name: string;
  tokens: number;
  gens: number;
}

const ARM_STYLE: Record<LlmProvider, string> = {
  claude: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
  chatgpt: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  deepseek: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  gemini: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
};

export interface DailyPoint {
  day: string;
  tokens: number;
}

const fmt = (n: number) => n.toLocaleString("en-US");

const ARM_COLOR: Record<LlmProvider, string> = {
  claude: "#fb923c",
  chatgpt: "#34d399",
  deepseek: "#60a5fa",
  gemini: "#a78bfa",
};

function Bars({
  title,
  items,
  unit = "",
}: {
  title: string;
  items: { label: string; value: number; color: string }[];
  unit?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700/60">
      {title && <h3 className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">{title}</h3>}
      <div className="space-y-1.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-28 shrink-0 truncate text-[11px] text-slate-500 dark:text-slate-400">{it.label}</span>
            <div className="h-4 flex-1 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
              <div className="h-full rounded" style={{ width: `${(it.value / max) * 100}%`, background: it.color }} />
            </div>
            <span className="w-24 shrink-0 text-right font-mono text-[11px] text-slate-600 dark:text-slate-300">
              {fmt(it.value)}
              {unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineChart({ data }: { data: DailyPoint[] }) {
  const w = 600;
  const h = 130;
  const pad = 26;
  const max = Math.max(1, ...data.map((d) => d.tokens));
  const pts = data
    .map((d, i) => {
      const x = pad + (i / Math.max(1, data.length - 1)) * (w - 2 * pad);
      const y = h - pad - (d.tokens / max) * (h - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700/60">
      <h3 className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
        Token ต่อวัน (14 วันล่าสุด) · สูงสุด {fmt(max)}
      </h3>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
        <polyline points={pts} fill="none" stroke="#10b981" strokeWidth="2" />
        {data.map((d, i) => {
          const x = pad + (i / Math.max(1, data.length - 1)) * (w - 2 * pad);
          const y = h - pad - (d.tokens / max) * (h - 2 * pad);
          return <circle key={i} cx={x} cy={y} r="2.5" fill="#10b981" />;
        })}
        <text x={pad} y={h - 6} fontSize="10" fill="currentColor" className="text-slate-400">
          {data[0]?.day}
        </text>
        <text x={w - pad} y={h - 6} fontSize="10" textAnchor="end" fill="currentColor" className="text-slate-400">
          {data[data.length - 1]?.day}
        </text>
      </svg>
    </div>
  );
}

export interface ProviderModel {
  provider: LlmProvider;
  model: string;
}

export function AdminPanel({
  users,
  metrics,
  models,
  defaultProvider,
  dailyLimit,
  summary,
  projects,
  daily,
}: {
  users: AdminUser[];
  metrics: ArmMetric[];
  models: ProviderModel[];
  defaultProvider: LlmProvider;
  dailyLimit: number;
  summary: TokenSummary;
  projects: ProjectTokens[];
  daily: DailyPoint[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [modelDraft, setModelDraft] = useState<Record<string, string>>(
    Object.fromEntries(models.map((m) => [m.provider, m.model])),
  );
  const [limitDraft, setLimitDraft] = useState(String(dailyLimit));

  async function saveLimit() {
    setBusy(true);
    try {
      await setDailyLimitAction(Number(limitDraft));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function saveModel(provider: LlmProvider) {
    setBusy(true);
    try {
      await setProviderModelAction(provider, modelDraft[provider] ?? "");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  async function setDefault(provider: LlmProvider) {
    setBusy(true);
    try {
      await setDefaultProviderAction(provider);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function setArm(userId: string, arm: LlmProvider) {
    setBusy(true);
    try {
      await setUserArmAction(userId, arm);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  async function balance() {
    if (!confirm("แบ่งผู้ใช้ทั้งหมดเป็นกลุ่มเท่า ๆ กัน (เขียนทับ arm เดิม)?")) return;
    setBusy(true);
    try {
      await autoBalanceArmsAction();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <Link
        href="/projects"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        กลับไปหน้าโปรเจกต์
      </Link>
      <h1 className="text-2xl font-bold">Admin — A/B โมเดล</h1>

      {/* token summary */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: "Token รวมทั้งหมด", value: fmt(summary.totalTokens), accent: true },
          { label: "Token เฉลี่ย/โปรเจกต์", value: fmt(summary.avgPerProject) },
          { label: "จำนวน generation", value: fmt(summary.gens) },
          { label: "input รวม", value: fmt(summary.totalIn) },
          { label: "output รวม", value: fmt(summary.totalOut) },
          { label: "โปรเจกต์ที่ใช้งาน", value: fmt(summary.projectCount) },
        ].map((c) => (
          <div
            key={c.label}
            className={`rounded-xl border p-3 ${
              c.accent
                ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-950/40"
                : "border-slate-200 bg-white dark:border-slate-700/60 dark:bg-slate-900"
            }`}
          >
            <div className="text-xs text-slate-500 dark:text-slate-400">{c.label}</div>
            <div className={`mt-1 text-xl font-bold ${c.accent ? "text-emerald-600 dark:text-emerald-300" : "text-slate-800 dark:text-slate-100"}`}>
              {c.value}
            </div>
          </div>
        ))}
      </div>

      {/* provider config: default + model names */}
      <section className="mt-6 rounded-xl border border-slate-200 p-4 dark:border-slate-700/60">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">ตั้งค่า Provider</h2>

        <p className="mb-2 mt-3 text-xs text-slate-500 dark:text-slate-400">Provider หลักของระบบ (ผู้ใช้ที่ยังไม่ถูก assign):</p>
        <div className="flex gap-1.5">
          {LLM_PROVIDERS.map((p) => (
            <button
              key={p}
              onClick={() => setDefault(p)}
              disabled={busy}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                defaultProvider === p
                  ? "bg-emerald-500 text-white"
                  : "border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-700/60 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              {p}
              {defaultProvider === p ? " ✓" : ""}
            </button>
          ))}
        </div>

        <p className="mb-2 mt-4 text-xs text-slate-500 dark:text-slate-400">ชื่อโมเดลของแต่ละ provider:</p>
        <div className="space-y-2">
          {LLM_PROVIDERS.map((p) => (
            <div key={p} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-xs font-medium text-slate-600 dark:text-slate-300">{p}</span>
              <input
                value={modelDraft[p] ?? ""}
                onChange={(e) => setModelDraft((d) => ({ ...d, [p]: e.target.value }))}
                placeholder="ชื่อโมเดล เช่น gpt-4o, deepseek-chat"
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs outline-none focus:ring-2 focus:ring-emerald-300 dark:border-slate-700/60 dark:bg-slate-800"
              />
              <button
                onClick={() => saveModel(p)}
                disabled={busy}
                className="shrink-0 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
              >
                บันทึก
              </button>
            </div>
          ))}
        </div>

        <p className="mb-2 mt-4 text-xs text-slate-500 dark:text-slate-400">โควตา generation ต่อคน/วัน (คีย์ระบบ):</p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={limitDraft}
            onChange={(e) => setLimitDraft(e.target.value)}
            className="w-28 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-emerald-300 dark:border-slate-700/60 dark:bg-slate-800"
          />
          <span className="text-xs text-slate-400 dark:text-slate-500">ครั้ง/วัน</span>
          <button
            onClick={saveLimit}
            disabled={busy}
            className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
          >
            บันทึก
          </button>
        </div>
      </section>

      {/* charts: per-provider comparison */}
      <div className="mb-2 mt-6 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">ผลเทียบราย provider</h2>
        <a
          href="/api/admin/metrics.csv"
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700/60 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          ⬇ Export CSV
        </a>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Bars
          title="Token รวม"
          items={metrics.map((m) => ({ label: m.provider, value: m.inTok + m.outTok, color: ARM_COLOR[m.provider] }))}
        />
        <Bars
          title="จำนวน generation"
          items={metrics.map((m) => ({ label: m.provider, value: m.gens, color: ARM_COLOR[m.provider] }))}
        />
        <Bars
          title="เวลาเฉลี่ย/gen (วินาที)"
          items={metrics.map((m) => ({ label: m.provider, value: m.avgSec, color: ARM_COLOR[m.provider] }))}
          unit="s"
        />
        <Bars
          title="👍 ถูกใจ"
          items={metrics.map((m) => ({ label: m.provider, value: m.up, color: ARM_COLOR[m.provider] }))}
        />
      </div>

      {/* daily token trend */}
      <div className="mt-3">
        <LineChart data={daily} />
      </div>

      {/* tokens per project (top 15) */}
      <h2 className="mb-2 mt-8 text-sm font-semibold text-slate-700 dark:text-slate-200">
        Token ต่อโปรเจกต์ (สูงสุด 15) · เฉลี่ย {fmt(summary.avgPerProject)}/โปรเจกต์
      </h2>
      {projects.length === 0 ? (
        <p className="text-xs text-slate-400 dark:text-slate-500">ยังไม่มีข้อมูล</p>
      ) : (
        <Bars
          title=""
          items={projects.map((p) => ({ label: p.name, value: p.tokens, color: "#94a3b8" }))}
          unit=" tok"
        />
      )}

      {/* user assignment */}
      <div className="mb-2 mt-8 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          ผู้ใช้ ({users.length}) — กำหนดกลุ่ม
        </h2>
        <button
          onClick={balance}
          disabled={busy}
          className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
        >
          auto-balance เท่ากัน
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700/60">
        {users.map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between gap-3 border-t border-slate-100 px-3 py-2 first:border-t-0 dark:border-slate-800"
          >
            <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-300">{u.email}</span>
            <div className="flex shrink-0 gap-1">
              {LLM_PROVIDERS.map((p) => (
                <button
                  key={p}
                  onClick={() => setArm(u.id, p)}
                  disabled={busy}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
                    u.arm === p
                      ? ARM_STYLE[p]
                      : "text-slate-400 hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-slate-800"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
