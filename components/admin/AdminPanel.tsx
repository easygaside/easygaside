"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  BanknotesIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  CreditCardIcon,
  FlagIcon,
  InboxStackIcon,
  TrashIcon,
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
  setMonthlyPoolAction,
  setPlanLimitsAction,
  setProviderModelAction,
  setProviderTankAction,
  setProviderBaseUrlAction,
  setUserArmAction,
  setVisionProviderAction,
  addPaymentAction,
  deletePaymentAction,
  setFxRateAction,
} from "@/app/admin/actions";
import { BASE_URL_PRESETS, LLM_PROVIDERS, type LlmProvider } from "@/lib/llm/catalog";
import { AllowlistManager, type AllowlistEntry } from "./AllowlistManager";
import { BetaApplicationsViewer, type BetaApplication } from "./BetaApplicationsViewer";
import { UpgradeRequestsViewer, type UpgradeRequest } from "./UpgradeRequestsViewer";
import { SubscribersViewer, type Subscriber } from "./SubscribersViewer";
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
export interface FinanceData {
  fxRate: number;
  currentMonth: string;
  months: string[]; // YYYY-MM, desc — for the month picker
  revenueByMonth: Record<string, number>; // month → THB
  expenseByMonth: Record<string, Record<string, number>>; // month → (provider → USD)
  revenueTotalThb: number;
  expenseByProviderTotal: Record<string, number>; // provider → USD (all time)
  providers: string[]; // all providers with spend, desc by total — table rows
  payments: { id: string; amountThb: number; note: string | null; paidAt: string }[];
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
  baseUrl: string;
}

type Tab = "overview" | "finance" | "providers" | "users" | "plans" | "beta" | "reports";

export function AdminPanel({
  users,
  metrics,
  models,
  defaultProvider,
  dailyLimit,
  monthlyToolLimit,
  freeMonthlyPool,
  planLimits,
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
  upgradeRequests,
  subscribers,
  userMetrics,
  finance,
  providerKeys,
}: {
  users: AdminUser[];
  metrics: ArmMetric[];
  models: ProviderModel[];
  defaultProvider: LlmProvider;
  dailyLimit: number;
  monthlyToolLimit: number;
  freeMonthlyPool: number;
  planLimits: { plan: string; pool: number; tools: number }[];
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
  upgradeRequests: UpgradeRequest[];
  subscribers: Subscriber[];
  userMetrics: UserMetric[];
  finance: FinanceData;
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
  const [baseUrlDraft, setBaseUrlDraft] = useState<Record<string, string>>(
    Object.fromEntries(models.map((m) => [m.provider, m.baseUrl])),
  );
  const [limitDraft, setLimitDraft] = useState(String(dailyLimit));
  const [monthlyDraft, setMonthlyDraft] = useState(String(monthlyToolLimit));
  const [poolDraft, setPoolDraft] = useState(String(freeMonthlyPool));
  const [planDraft, setPlanDraft] = useState<Record<string, { pool: string; tools: string }>>(
    Object.fromEntries(planLimits.map((p) => [p.plan, { pool: String(p.pool), tools: String(p.tools) }])),
  );
  const [tankDefaultDraft, setTankDefaultDraft] = useState(String(energyTankDefault));
  const [criticProviderDraft, setCriticProviderDraft] = useState<"claude" | "deepseek">(criticProvider);
  const [criticModelDraft, setCriticModelDraft] = useState(criticModel);
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [fxDraft, setFxDraft] = useState(String(finance.fxRate));
  const [selMonth, setSelMonth] = useState(finance.currentMonth);

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
      await setProviderBaseUrlAction(p, baseUrlDraft[p] ?? "");
    });
  const saveMonthly = () => run(() => setMonthlyToolLimitAction(Number(monthlyDraft)));
  const savePool = () => run(() => setMonthlyPoolAction(Number(poolDraft)));
  const savePlan = (plan: string) =>
    run(() => setPlanLimitsAction(plan, Number(planDraft[plan]?.pool), Number(planDraft[plan]?.tools)));
  const saveTankDefault = () => run(() => setEnergyTankDefaultAction(Number(tankDefaultDraft)));
  const toggleBeta = () => run(() => setBetaEnforcedAction(!betaEnforced));
  const saveCritic = () => run(() => setCriticAction(criticProviderDraft, criticModelDraft));
  const setDefault = (p: LlmProvider) => run(() => setDefaultProviderAction(p));
  const setArm = (userId: string, arm: LlmProvider) => run(() => setUserArmAction(userId, arm));
  const setVision = (p: "gemini" | "chatgpt" | "claude") => run(() => setVisionProviderAction(p));
  const addPayment = () =>
    run(async () => {
      await addPaymentAction(Number(payAmount), payNote);
      setPayAmount("");
      setPayNote("");
    });
  const delPayment = (id: string) => run(() => deletePaymentAction(id));
  const saveFx = () => run(() => setFxRateAction(Number(fxDraft)));
  const baht = (n: number) => `฿${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  const usd = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  const toThb = (u: number) => u * finance.fxRate;
  const monthExp = finance.expenseByMonth[selMonth] ?? {};
  const revenueMonthThb = finance.revenueByMonth[selMonth] ?? 0;
  const expenseMonthUsd = Object.values(monthExp).reduce((a, b) => a + b, 0);
  const expenseTotalUsd = Object.values(finance.expenseByProviderTotal).reduce((a, b) => a + b, 0);
  function balance() {
    if (!confirm("แบ่งผู้ใช้ทั้งหมดเป็นกลุ่มเท่า ๆ กัน (เขียนทับ arm เดิม)?")) return;
    run(() => autoBalanceArmsAction());
  }

  const TABS: { id: Tab; label: string; icon: typeof ChartBarIcon; badge?: number }[] = [
    { id: "overview", label: "ภาพรวม", icon: ChartBarIcon },
    { id: "finance", label: "การเงิน", icon: BanknotesIcon },
    { id: "providers", label: "Provider", icon: Cog6ToothIcon },
    { id: "users", label: "ผู้ใช้", icon: UsersIcon },
    { id: "plans", label: "แพ็กเกจ", icon: CreditCardIcon, badge: upgradeRequests.length },
    { id: "beta", label: "Beta", icon: InboxStackIcon, badge: pendingApps },
    { id: "reports", label: "รายงาน", icon: FlagIcon, badge: openReports },
  ];

  const activeLabel = TABS.find((t) => t.id === tab)?.label ?? "";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1400px] lg:gap-8 lg:px-6">
      {/* ── desktop sidebar nav (lg+) — replaces the bottom bar on wide screens ── */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-1 border-r border-slate-200 px-3 py-6 lg:flex dark:border-slate-800">
        <Link
          href="/projects"
          className="mb-4 inline-flex items-center gap-1.5 px-2 text-sm text-slate-500 transition hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          กลับไปหน้าโปรเจกต์
        </Link>
        <h1 className="mb-3 px-2 text-lg font-bold">Admin</h1>
        {TABS.map((t) => {
          const active = tab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="flex-1 text-left">{t.label}</span>
              {!!t.badge && t.badge > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </aside>

      {/* ── main content column ── */}
      <main className="min-w-0 flex-1 px-4 pb-28 pt-8 sm:px-6 lg:pb-10">
        {/* mobile header (the sidebar carries this on desktop) */}
        <div className="lg:hidden">
          <Link
            href="/projects"
            className="mb-5 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            กลับไปหน้าโปรเจกต์
          </Link>
          <h1 className="text-xl font-bold sm:text-2xl">Admin — ข้อมูล &amp; ตั้งค่า</h1>
        </div>
        {/* desktop section title */}
        <h1 className="hidden text-2xl font-bold lg:block">{activeLabel}</h1>

      {/* ───────── ภาพรวม ───────── */}
      {tab === "overview" && (
        <div className="mt-5 space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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

      {/* ───────── การเงิน ───────── */}
      {tab === "finance" && (
        <div className="mt-5 space-y-6">
          {/* month picker — defaults to the current month, lists every month that has data */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400">ดูข้อมูลของเดือน:</span>
            <select
              value={selMonth}
              onChange={(e) => setSelMonth(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs outline-none focus:ring-2 focus:ring-emerald-300 dark:border-slate-700/60 dark:bg-slate-800"
            >
              {finance.months.map((m) => (
                <option key={m} value={m}>
                  {m}
                  {m === finance.currentMonth ? " (เดือนนี้)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {[
              { label: `รายรับ ${selMonth}`, value: baht(revenueMonthThb), tone: "rev" as const },
              { label: "รายรับรวมทั้งหมด", value: baht(finance.revenueTotalThb), tone: "rev" as const },
              { label: `กำไร ${selMonth}`, value: baht(revenueMonthThb - toThb(expenseMonthUsd)), tone: "net" as const },
              { label: `รายจ่าย ${selMonth}`, value: baht(toThb(expenseMonthUsd)), sub: usd(expenseMonthUsd), tone: "exp" as const },
              { label: "รายจ่ายรวมทั้งหมด", value: baht(toThb(expenseTotalUsd)), sub: usd(expenseTotalUsd), tone: "exp" as const },
              { label: "กำไรรวมทั้งหมด", value: baht(finance.revenueTotalThb - toThb(expenseTotalUsd)), tone: "net" as const },
            ].map((c) => (
              <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700/60 dark:bg-slate-900">
                <div className="text-xs text-slate-500 dark:text-slate-400">{c.label}</div>
                <div
                  className={`mt-1 text-lg font-bold sm:text-xl ${
                    c.tone === "rev"
                      ? "text-emerald-600 dark:text-emerald-300"
                      : c.tone === "exp"
                        ? "text-rose-600 dark:text-rose-300"
                        : "text-slate-800 dark:text-slate-100"
                  }`}
                >
                  {c.value}
                </div>
                {c.sub && <div className="text-[11px] text-slate-400 dark:text-slate-500">({c.sub})</div>}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-700/60">
            <span className="text-slate-500 dark:text-slate-400">เรตแปลง USD → บาท:</span>
            <input
              value={fxDraft}
              onChange={(e) => setFxDraft(e.target.value)}
              type="number"
              step="0.1"
              className="w-24 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 font-mono dark:border-slate-700/60 dark:bg-slate-800"
            />
            <span className="text-slate-400 dark:text-slate-500">฿/$</span>
            <button onClick={saveFx} disabled={busy} className="rounded-lg bg-emerald-500 px-3 py-1 font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50">
              บันทึก
            </button>
          </div>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">รายจ่ายแยกตาม Provider (แปลงเป็นบาท)</h2>
            {finance.providers.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500">ยังไม่มีรายจ่าย (เริ่มนับจาก generation ใหม่)</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/60">
                <table className="w-full min-w-[360px] text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-slate-400 dark:border-slate-800 dark:text-slate-500">
                      <th className="px-3 py-2 font-medium">Provider</th>
                      <th className="px-3 py-2 text-right font-medium">{selMonth}</th>
                      <th className="px-3 py-2 text-right font-medium">รวมทั้งหมด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finance.providers.map((p) => {
                      const monthUsd = monthExp[p] ?? 0;
                      const totalUsd = finance.expenseByProviderTotal[p] ?? 0;
                      return (
                        <tr key={p} className="border-t border-slate-100 first:border-t-0 dark:border-slate-800">
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{p}</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-300">
                            {baht(toThb(monthUsd))} <span className="text-[10px] text-slate-400">({usd(monthUsd)})</span>
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-300">
                            {baht(toThb(totalUsd))} <span className="text-[10px] text-slate-400">({usd(totalUsd)})</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
              * ประมาณการจาก token × ราคา (DeepSeek = ราคาทางการ, อื่น ๆ = ราคา list โดยประมาณ — แก้ได้ที่ lib/pricing.ts)
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">บันทึกรายรับ (PromptPay — กรอกเอง)</h2>
            <div className="flex flex-wrap gap-2">
              <input
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                type="number"
                placeholder="จำนวนเงิน (บาท)"
                className="w-32 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-emerald-300 dark:border-slate-700/60 dark:bg-slate-800"
              />
              <input
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                placeholder="หมายเหตุ (เช่น อีเมลผู้จ่าย / แพ็กเกจ)"
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-emerald-300 dark:border-slate-700/60 dark:bg-slate-800"
              />
              <button
                onClick={addPayment}
                disabled={busy || !payAmount.trim()}
                className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
              >
                เพิ่มรายรับ
              </button>
            </div>
            {finance.payments.length > 0 && (
              <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700/60">
                {finance.payments.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 border-t border-slate-100 px-3 py-2 text-xs first:border-t-0 dark:border-slate-800">
                    <span className="shrink-0 font-mono font-semibold text-emerald-600 dark:text-emerald-400">{baht(p.amountThb)}</span>
                    <span className="shrink-0 text-slate-400 dark:text-slate-500">{p.paidAt}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-500 dark:text-slate-400">{p.note ?? ""}</span>
                    <button
                      onClick={() => delPayment(p.id)}
                      disabled={busy}
                      title="ลบรายการ"
                      className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50 dark:hover:bg-red-950/40"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
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

            <p className="mb-2 mt-4 text-xs text-slate-500 dark:text-slate-400">ชื่อโมเดล + ถังพลังงาน (token/โปรเจกต์) + API base URL (เว้นว่าง=ค่าเริ่มต้น) ของแต่ละ provider:</p>
            <div className="space-y-2.5">
              {LLM_PROVIDERS.map((p) => (
                <div key={p} className="flex flex-col gap-2 rounded-lg border border-slate-100 p-2 sm:flex-row sm:items-center sm:border-0 sm:p-0 dark:border-slate-800 sm:dark:border-0">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300 sm:w-20 sm:shrink-0">{p}</span>
                  <div className="flex flex-wrap gap-2">
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
                    {BASE_URL_PRESETS[p] && (
                      <select
                        value={baseUrlDraft[p] ?? ""}
                        onChange={(e) => setBaseUrlDraft((d) => ({ ...d, [p]: e.target.value }))}
                        title="API endpoint (เลือกได้ ไม่ต้องพิมพ์ URL)"
                        className="min-w-[12rem] flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-emerald-300 dark:border-slate-700/60 dark:bg-slate-800"
                      >
                        {BASE_URL_PRESETS[p]!.map((o) => (
                          <option key={o.url} value={o.url}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    )}
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

            <p className="mb-2 mt-4 text-xs text-slate-500 dark:text-slate-400">แต้มฟรีต่อคน/เดือน (pool รวมทุกโปรเจกต์ · 10,000 token = 1 แต้ม):</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={10000}
                step={50000}
                value={poolDraft}
                onChange={(e) => setPoolDraft(e.target.value)}
                className="w-32 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-emerald-300 dark:border-slate-700/60 dark:bg-slate-800"
              />
              <span className="text-xs text-slate-400 dark:text-slate-500">token/เดือน (≈ {Math.floor(Number(poolDraft || 0) / 10000)} แต้ม)</span>
              <button onClick={savePool} disabled={busy} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50">
                บันทึก
              </button>
            </div>

            <p className="mb-2 mt-4 text-xs text-slate-500 dark:text-slate-400">แพ็กเกจจ่ายเงิน — pool (token/เดือน) + สร้างใหม่/เดือน (free แก้ด้านบน):</p>
            <div className="space-y-2.5">
              {planLimits.map((pl) => (
                <div key={pl.plan} className="flex flex-col gap-2 rounded-lg border border-slate-100 p-2 sm:flex-row sm:items-center sm:border-0 sm:p-0 dark:border-slate-800 sm:dark:border-0">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300 sm:w-20 sm:shrink-0">{pl.plan}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min={10000}
                      step={100000}
                      value={planDraft[pl.plan]?.pool ?? ""}
                      onChange={(e) => setPlanDraft((d) => ({ ...d, [pl.plan]: { pool: e.target.value, tools: d[pl.plan]?.tools ?? "" } }))}
                      title="pool (token)/เดือน"
                      placeholder="token"
                      className="w-28 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 font-mono text-xs outline-none focus:ring-2 focus:ring-emerald-300 dark:border-slate-700/60 dark:bg-slate-800"
                    />
                    <input
                      type="number"
                      min={1}
                      value={planDraft[pl.plan]?.tools ?? ""}
                      onChange={(e) => setPlanDraft((d) => ({ ...d, [pl.plan]: { pool: d[pl.plan]?.pool ?? "", tools: e.target.value } }))}
                      title="สร้างใหม่/เดือน"
                      placeholder="ตัว"
                      className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 font-mono text-xs outline-none focus:ring-2 focus:ring-emerald-300 dark:border-slate-700/60 dark:bg-slate-800"
                    />
                    <span className="text-xs text-slate-400 dark:text-slate-500">≈ {Math.floor(Number(planDraft[pl.plan]?.pool || 0) / 10000)} แต้ม</span>
                    <button onClick={() => savePlan(pl.plan)} disabled={busy} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50">
                      บันทึก
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <p className="mb-2 mt-4 text-xs text-slate-500 dark:text-slate-400">ถังพลังงานเริ่มต้น (token/โปรเจกต์) — legacy (ตอนนี้ใช้แต้มรายเดือนด้านบนแทน):</p>
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

      {/* ───────── แพ็กเกจ (สมาชิก + คำขออัปเกรด) ───────── */}
      {tab === "plans" && (
        <div className="mt-5 space-y-8">
          <UpgradeRequestsViewer requests={upgradeRequests} />
          <SubscribersViewer subscribers={subscribers} />
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

      {/* ───────── mobile bottom menu (hidden on lg — sidebar takes over) ───────── */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/90">
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
    </div>
  );
}
