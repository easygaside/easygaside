"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import {
  autoBalanceArmsAction,
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

const fmt = (n: number) => n.toLocaleString("en-US");

export interface ProviderModel {
  provider: LlmProvider;
  model: string;
}

export function AdminPanel({
  users,
  metrics,
  models,
  defaultProvider,
  summary,
  projects,
}: {
  users: AdminUser[];
  metrics: ArmMetric[];
  models: ProviderModel[];
  defaultProvider: LlmProvider;
  summary: TokenSummary;
  projects: ProjectTokens[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [modelDraft, setModelDraft] = useState<Record<string, string>>(
    Object.fromEntries(models.map((m) => [m.provider, m.model])),
  );

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
    if (!confirm("แบ่งผู้ใช้ทั้งหมดเป็น 3 กลุ่มเท่า ๆ กัน (เขียนทับ arm เดิม)?")) return;
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
      </section>

      {/* metrics per arm */}
      <h2 className="mb-2 mt-6 text-sm font-semibold text-slate-700 dark:text-slate-200">ผลเทียบราย provider</h2>
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/60">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              {["provider", "คน", "gen", "in รวม", "out รวม", "in เฉลี่ย", "out เฉลี่ย", "critic/gen", "วินาที", "สำเร็จ%", "👍", "👎"].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.provider} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ARM_STYLE[m.provider]}`}>{m.provider}</span>
                </td>
                <td className="px-3 py-2">{m.assigned}</td>
                <td className="px-3 py-2">{m.gens}</td>
                <td className="px-3 py-2">{fmt(m.inTok)}</td>
                <td className="px-3 py-2">{fmt(m.outTok)}</td>
                <td className="px-3 py-2">{m.avgInTok}</td>
                <td className="px-3 py-2">{m.avgOutTok}</td>
                <td className="px-3 py-2">{m.avgCritic}</td>
                <td className="px-3 py-2">{m.avgSec}</td>
                <td className="px-3 py-2">{m.okRate}%</td>
                <td className="px-3 py-2 text-emerald-600 dark:text-emerald-400">{m.up}</td>
                <td className="px-3 py-2 text-red-500 dark:text-red-400">{m.down}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* tokens per project (top 15) */}
      <h2 className="mb-2 mt-8 text-sm font-semibold text-slate-700 dark:text-slate-200">
        Token ต่อโปรเจกต์ (สูงสุด 15) · เฉลี่ย {fmt(summary.avgPerProject)}/โปรเจกต์
      </h2>
      {projects.length === 0 ? (
        <p className="text-xs text-slate-400 dark:text-slate-500">ยังไม่มีข้อมูล</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700/60">
          {projects.map((p, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 border-t border-slate-100 px-3 py-2 text-sm first:border-t-0 dark:border-slate-800"
            >
              <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-300">{p.name}</span>
              <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">{p.gens} gen</span>
              <span className="shrink-0 font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">
                {fmt(p.tokens)} tok
              </span>
            </div>
          ))}
        </div>
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
          auto-balance 3 กลุ่มเท่ากัน
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
