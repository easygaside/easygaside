"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  FlagIcon,
  InboxStackIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import {
  autoBalanceArmsAction,
  setBetaEnforcedAction,
  setCriticAction,
  setDailyLimitAction,
  setDefaultProviderAction,
  setEnergyTankDefaultAction,
  setMonthlyToolLimitAction,
  setProviderModelAction,
  setProviderTankAction,
  setUserArmAction,
  setVisionProviderAction,
} from "@/app/admin/actions";
import { LLM_PROVIDERS, type LlmProvider } from "@/lib/llm/catalog";
import { AllowlistManager, type AllowlistEntry } from "./AllowlistManager";
import { BetaApplicationsViewer, type BetaApplication } from "./BetaApplicationsViewer";
import { ReportsViewer, type FailureReport } from "./ReportsViewer";

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
export interface UserMetric {
  email: string;
  arm: LlmProvider;
  gens: number;
  tokens: number;
  up: number;
  down: number;
  lastActive: string | null;
}
export interface TokenSummary {
  totalTokens: number;
  totalIn: number;
  totalOut: number;
  gens: number;
  projectCount: number;
  avgPerProject: number;
  totalCriticIssues: number;
  avgCriticPerGen: number;
}
export interface ProjectTokens {
  name: string;
  tokens: number;
  gens: number;
  criticIssues: number;
}

const ARM_STYLE: Record<LlmProvider, string> = {
  claude: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
  chatgpt: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  deepseek: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  "deepseek-pro": "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
  gemini: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  zai: "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
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
  "deepseek-pro": "#818cf8",
  gemini: "#a78bfa",
  zai: "#2dd4bf",
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
            <span className="w-20 shrink-0 truncate text-[11px] text-slate-500 dark:text-slate-400 sm:w-28">{it.label}</span>
            <div className="h-4 flex-1 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
              <div className="h-full rounded" style={{ width: `${(it.value / max) * 100}%`, background: it.color }} />
            </div>
            <span className="w-20 shrink-0 text-right font-mono text-[11px] text-slate-600 dark:text-slate-300 sm:w-24">
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
  energyTank: number;
}

type Tab = "overview" | "providers" | "users" | "beta" | "reports";

export function AdminPanel({
  users,
  metrics,
  models,
  defaultProvider,
  dailyLimit,
  monthlyToolLimit,
  energyTankDefault,
  betaEnforced,
  criticProvider,
  criticModel,
  criticKeyReady,
  visionProvider,
  summary,
  projects,
  daily,
  allowlist,
  reports,
  applications,
  userMetrics,
  providerKeys,
}: {
  users: AdminUser[];
  metrics: ArmMetric[];
  models: ProviderModel[];
  defaultProvider: LlmProvider;
  dailyLimit: number;
  monthlyToolLimit: number;
  energyTankDefault: number;
  betaEnforced: boolean;
  criticProvider: "claude" | "deepseek";
  criticModel: string;
  criticKeyReady: boolean;
  visionProvider: "gemini" | "chatgpt" | "claude";
  summary: TokenSummary;
  projects: ProjectTokens[];
  daily: DailyPoint[];
  allowlist: AllowlistEntry[];
  reports: FailureReport[];
  applications: BetaApplication[];
  userMetrics: UserMetric[];
  providerKeys: Record<LlmProvider, boolean>;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [busy, setBusy] = useState(false);
  const [modelDraft, setModelDraft] = useState<Record<string, string>>(
    Object.fromEntries(models.map((m) => [m.provider, m.model])),
  );
  const [tankDraft, setTankDraft] = useState<Record<string, string>>(
    Object.fromEntries(models.map((m) => [m.provider, String(m.energyTank)])),
  );
  const [limitDraft, setLimitDraft] = useState(String(dailyLimit));
  const [monthlyDraft, setMonthlyDraft] = useState(String(monthlyToolLimit));
  const [tankDefaultDraft, setTankDefaultDraft] = useState(String(energyTankDefault));
  const [criticProviderDraft, setCriticProviderDraft] = useState<"claude" | "deepseek">(criticProvider);
  const [criticModelDraft, setCriticModelDraft] = useState(criticModel);

  const pendingApps = applications.filter((a) => a.status === "pending").length;
  const openReports = reports.filter((r) => r.status !== "done").length;

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const saveLimit = () => run(() => setDailyLimitAction(Number(limitDraft)));
  const saveProviderRow = (p: LlmProvider) =>
    run(async () => {
      await setProviderModelAction(p, modelDraft[p] ?? "");
      await setProviderTankAction(p, Number(tankDraft[p]));
    });
  const saveMonthly = () => run(() => setMonthlyToolLimitAction(Number(monthlyDraft)));
  const saveTankDefault = () => run(() => setEnergyTankDefaultAction(Number(tankDefaultDraft)));
  const toggleBeta = () => run(() => setBetaEnforcedAction(!betaEnforced));
  const saveCritic = () => run(() => setCriticAction(criticProviderDraft, criticModelDraft));
  const setDefault = (p: LlmProvider) => run(() => setDefaultProviderAction(p));
  const setArm = (userId: string, arm: LlmProvider) => run(() => setUserArmAction(userId, arm));
  const setVision = (p: "gemini" | "chatgpt" | "claude") => run(() => setVisionProviderAction(p));
  function balance() {
    if (!confirm("แบ่งผู้ใช้ทั้งหมดเป็นกลุ่มเท่า ๆ กัน (เขียนทับ arm เดิม)?")) return;
    run(() => autoBalanceArmsAction());
  }

  const TABS: { id: Tab; label: string; icon: typeof ChartBarIcon; badge?: number }[] = [
    { id: "overview", label: "ภาพรวม", icon: ChartBarIcon },
    { id: "providers", label: "Provider", icon: Cog6ToothIcon },
    { id: "users", label: "ผู้ใช้", icon: UsersIcon },
    { id: "beta", label: "Beta", icon: InboxStackIcon, badge: pendingApps },
    { id: "reports", label: "รายงาน", icon: FlagIcon, badge: openReports },
  ];

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 pb-28 pt-8 sm:px-6">
      <Link
        href="/projects"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        กลับไปหน้าโปรเจกต์
      </Link>
      <h1 className="text-xl font-bold sm:text-2xl">Admin — ข้อมูล &amp; ตั้งค่า</h1>

      {/* ───────── ภาพรวม ───────── */}
      {tab === "overview" && (
        <div className="mt-5 space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: "Token รวมทั้งหมด", value: fmt(summary.totalTokens), accent: true },
              { label: "Token เฉลี่ย/โปรเจกต์", value: fmt(summary.avgPerProject) },
              { label: "จำนวน generation", value: fmt(summary.gens) },
              { label: "Critic เฉลี่ย/gen", value: String(summary.avgCriticPerGen) },
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
                <div className={`mt-1 text-lg font-bold sm:text-xl ${c.accent ? "text-emerald-600 dark:text-emerald-300" : "text-slate-800 dark:text-slate-100"}`}>
                  {c.value}
                </div>
              </div>
            ))}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">ผลเทียบราย provider</h2>
              <a
                href="/api/admin/metrics.csv"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700/60 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                ⬇ Export CSV
              </a>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Bars title="Token รวม" items={metrics.map((m) => ({ label: m.provider, value: m.inTok + m.outTok, color: ARM_COLOR[m.provider] }))} />
              <Bars title="จำนวน generation" items={metrics.map((m) => ({ label: m.provider, value: m.gens, color: ARM_COLOR[m.provider] }))} />
              <Bars title="เวลาเฉลี่ย/gen (วินาที)" items={metrics.map((m) => ({ label: m.provider, value: m.avgSec, color: ARM_COLOR[m.provider] }))} unit="s" />
              <Bars title="👍 ถูกใจ" items={metrics.map((m) => ({ label: m.provider, value: m.up, color: ARM_COLOR[m.provider] }))} />
              <Bars title="🔍 critic issues เฉลี่ย/gen" items={metrics.map((m) => ({ label: m.provider, value: m.avgCritic, color: ARM_COLOR[m.provider] }))} />
            </div>
          </div>

          <LineChart data={daily} />

          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              Token ต่อโปรเจกต์ (สูงสุด 15) · เฉลี่ย {fmt(summary.avgPerProject)}/โปรเจกต์
            </h2>
            {projects.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500">ยังไม่มีข้อมูล</p>
            ) : (
              <Bars title="" items={projects.map((p) => ({ label: p.name, value: p.tokens, color: "#94a3b8" }))} unit=" tok" />
            )}
          </div>

          {projects.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                🔍 Critic issues ต่อโปรเจกต์ · รวม {fmt(summary.totalCriticIssues)} จุด
              </h2>
              <Bars title="" items={projects.map((p) => ({ label: p.name, value: p.criticIssues, color: "#f59e0b" }))} unit=" จุด" />
            </div>
          )}
        </div>
      )}

      {/* ───────── Provider ───────── */}
      {tab === "providers" && (
        <div className="mt-5 space-y-6">
          <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-700/60">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">ตั้งค่า Provider</h2>

            <p className="mb-2 mt-3 text-xs text-slate-500 dark:text-slate-400">Provider หลักของระบบ (ผู้ใช้ที่ยังไม่ถูก assign):</p>
            <div className="flex flex-wrap gap-1.5">
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

            <p className="mb-1.5 mt-4 text-xs text-slate-500 dark:text-slate-400">สถานะ API key (จาก env) — provider ที่ไม่มี key จะใช้ไม่ได้:</p>
            <div className="flex flex-wrap gap-1.5">
              {LLM_PROVIDERS.map((p) => (
                <span
                  key={p}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                    providerKeys[p]
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                  }`}
                >
                  {p} {providerKeys[p] ? "✓" : "✗ ไม่มี key"}
                </span>
              ))}
            </div>

            <p className="mb-2 mt-4 text-xs text-slate-500 dark:text-slate-400">ชื่อโมเดล + ถังพลังงาน (token/โปรเจกต์) ของแต่ละ provider:</p>
            <div className="space-y-2.5">
              {LLM_PROVIDERS.map((p) => (
                <div key={p} className="flex flex-col gap-2 rounded-lg border border-slate-100 p-2 sm:flex-row sm:items-center sm:border-0 sm:p-0 dark:border-slate-800 sm:dark:border-0">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300 sm:w-20 sm:shrink-0">{p}</span>
                  <div className="flex gap-2">
                    <input
                      value={modelDraft[p] ?? ""}
                      onChange={(e) => setModelDraft((d) => ({ ...d, [p]: e.target.value }))}
                      placeholder="ชื่อโมเดล เช่น gpt-4o"
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs outline-none focus:ring-2 focus:ring-emerald-300 dark:border-slate-700/60 dark:bg-slate-800"
                    />
                    <input
                      type="number"
                      min={1000}
                      step={50000}
                      value={tankDraft[p] ?? ""}
                      onChange={(e) => setTankDraft((d) => ({ ...d, [p]: e.target.value }))}
                      title="ถังพลังงาน (token) ต่อโปรเจกต์"
                      placeholder="token"
                      className="w-24 shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 font-mono text-xs outline-none focus:ring-2 focus:ring-emerald-300 dark:border-slate-700/60 dark:bg-slate-800 sm:w-28"
                    />
                    <button
                      onClick={() => saveProviderRow(p)}
                      disabled={busy}
                      className="shrink-0 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
                    >
                      บันทึก
                    </button>
                  </div>
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
              <button onClick={saveLimit} disabled={busy} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50">
                บันทึก
              </button>
            </div>

            <p className="mb-2 mt-4 text-xs text-slate-500 dark:text-slate-400">จำนวนเครื่องมือใหม่ที่สร้างได้ต่อคน/เดือน (แก้ของเดิมไม่นับ):</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={monthlyDraft}
                onChange={(e) => setMonthlyDraft(e.target.value)}
                className="w-28 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-emerald-300 dark:border-slate-700/60 dark:bg-slate-800"
              />
              <span className="text-xs text-slate-400 dark:text-slate-500">เครื่องมือ/เดือน</span>
              <button onClick={saveMonthly} disabled={busy} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50">
                บันทึก
              </button>
            </div>

            <p className="mb-2 mt-4 text-xs text-slate-500 dark:text-slate-400">ถังพลังงานเริ่มต้น (token/โปรเจกต์) — ใช้เมื่อ provider ไม่ได้ตั้งค่าเฉพาะ:</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1000}
                step={50000}
                value={tankDefaultDraft}
                onChange={(e) => setTankDefaultDraft(e.target.value)}
                className="w-32 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs outline-none focus:ring-2 focus:ring-emerald-300 dark:border-slate-700/60 dark:bg-slate-800"
              />
              <span className="text-xs text-slate-400 dark:text-slate-500">token</span>
              <button onClick={saveTankDefault} disabled={busy} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50">
                บันทึก
              </button>
            </div>

            <p className="mb-2 mt-4 text-xs text-slate-500 dark:text-slate-400">โหมด Closed beta (จำกัดเฉพาะ allowlist):</p>
            <button
              onClick={toggleBeta}
              disabled={busy}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                betaEnforced
                  ? "bg-amber-500 text-white hover:bg-amber-400"
                  : "border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-700/60 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              {betaEnforced ? "🔒 เปิด (เฉพาะ allowlist) — กดเพื่อปิด" : "🔓 ปิด (ทุกคนเข้าได้) — กดเพื่อเปิด"}
            </button>
          </section>

          <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-700/60">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">ตัวตรวจโค้ด (critic)</h2>
            <p className="mb-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
              ผู้ตัดสินคุณภาพกลางตัวเดียว ใช้กับทุก provider — ทำงานหลัง AI เขียนโค้ดเสร็จ. รองรับเฉพาะ claude / deepseek
            </p>
            <div className="flex gap-1.5">
              {(["deepseek", "claude"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setCriticProviderDraft(p);
                    setCriticModelDraft(p === "claude" ? "claude-haiku-4-5-20251001" : "deepseek-chat");
                  }}
                  disabled={busy}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                    criticProviderDraft === p
                      ? "bg-emerald-500 text-white"
                      : "border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-700/60 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
                >
                  {p}
                  {criticProviderDraft === p ? " ✓" : ""}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input
                value={criticModelDraft}
                onChange={(e) => setCriticModelDraft(e.target.value)}
                placeholder="ชื่อโมเดล critic"
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs outline-none focus:ring-2 focus:ring-emerald-300 dark:border-slate-700/60 dark:bg-slate-800"
              />
              <button onClick={saveCritic} disabled={busy} className="shrink-0 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50">
                บันทึก
              </button>
            </div>
            <p className="mt-2 text-xs">
              <span className={criticKeyReady ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                {criticKeyReady ? `✓ API key ของ ${criticProvider} พร้อมใช้งาน` : `✗ ไม่มี API key ของ ${criticProvider} (env) — critic จะรันไม่ได้`}
              </span>
            </p>
          </section>

          <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-700/60">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">ตัวถอดรูป (Vision proxy)</h2>
            <p className="mb-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
              เมื่อผู้ใช้แนบรูปกับผู้ช่วยที่อ่านรูปไม่ได้ (เช่น DeepSeek) ระบบใช้ตัวนี้อ่านรูป → แปลงเป็นข้อความ → ส่งต่อให้ตัวเขียนโค้ด
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(["gemini", "chatgpt", "claude"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setVision(p)}
                  disabled={busy}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                    visionProvider === p
                      ? "bg-emerald-500 text-white"
                      : "border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-700/60 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
                >
                  {p}
                  {visionProvider === p ? " ✓" : ""}
                  {!providerKeys[p] && <span className="ml-1 text-red-500">✗key</span>}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
              ถ้าตัวที่เลือกไม่มี API key ระบบจะ fallback ไปตัวที่มี key ให้อัตโนมัติ (gemini → chatgpt → claude)
            </p>
          </section>
        </div>
      )}

      {/* ───────── ผู้ใช้ ───────── */}
      {tab === "users" && (
        <div className="mt-5 space-y-8">
          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">ผลรายผู้ใช้ ({userMetrics.length})</h2>
            {userMetrics.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500">ยังไม่มีข้อมูลการใช้งานรายคน</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/60">
                <table className="w-full min-w-[480px] text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-slate-400 dark:border-slate-800 dark:text-slate-500">
                      <th className="px-3 py-2 font-medium">ผู้ใช้</th>
                      <th className="px-2 py-2 font-medium">arm</th>
                      <th className="px-2 py-2 text-right font-medium">gen</th>
                      <th className="px-2 py-2 text-right font-medium">token</th>
                      <th className="px-2 py-2 text-right font-medium">👍/👎</th>
                      <th className="px-3 py-2 text-right font-medium">ใช้งานล่าสุด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userMetrics.map((u) => (
                      <tr key={u.email} className="border-t border-slate-100 first:border-t-0 dark:border-slate-800">
                        <td className="max-w-[160px] truncate px-3 py-2 text-slate-700 dark:text-slate-300">{u.email}</td>
                        <td className="px-2 py-2">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${ARM_STYLE[u.arm]}`}>{u.arm}</span>
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-slate-600 dark:text-slate-300">{fmt(u.gens)}</td>
                        <td className="px-2 py-2 text-right font-mono text-slate-600 dark:text-slate-300">{fmt(u.tokens)}</td>
                        <td className="px-2 py-2 text-right font-mono text-slate-500 dark:text-slate-400">
                          {u.up}/{u.down}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-400 dark:text-slate-500">{u.lastActive ? u.lastActive.slice(0, 10) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">ผู้ใช้ ({users.length}) — กำหนดกลุ่ม</h2>
              <button onClick={balance} disabled={busy} className="shrink-0 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50">
                auto-balance เท่ากัน
              </button>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700/60">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="flex flex-col gap-2 border-t border-slate-100 px-3 py-2.5 first:border-t-0 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-300">{u.email}</span>
                  <div className="flex flex-wrap gap-1">
                    {LLM_PROVIDERS.map((p) => (
                      <button
                        key={p}
                        onClick={() => setArm(u.id, p)}
                        disabled={busy}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
                          u.arm === p ? ARM_STYLE[p] : "text-slate-400 hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-slate-800"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ───────── Beta ───────── */}
      {tab === "beta" && (
        <div className="mt-5 space-y-8">
          <AllowlistManager emails={allowlist} />
          <BetaApplicationsViewer applications={applications} />
        </div>
      )}

      {/* ───────── รายงาน ───────── */}
      {tab === "reports" && (
        <div className="mt-5">
          <ReportsViewer reports={reports} />
        </div>
      )}

      {/* ───────── bottom menu (responsive, all sizes) ───────── */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-md items-stretch justify-around px-2">
          {TABS.map((t) => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition ${
                  active ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                }`}
              >
                <Icon className="h-5 w-5" />
                {t.label}
                {!!t.badge && t.badge > 0 && (
                  <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white">
                    {t.badge}
                  </span>
                )}
                {active && <span className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-emerald-500" />}
              </button>
            );
          })}
        </div>
      </nav>
    </main>
  );
}
