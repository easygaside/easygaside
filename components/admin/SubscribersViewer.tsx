"use client";

import { useState } from "react";
import { cancelPlanAction, extendPlanAction, setPlanAction } from "@/app/admin/actions";

export interface Subscriber {
  userId: string;
  email: string;
  plan: string;
  expiresAt: string | null;
  toolsLeft: number;
  toolsLimit: number;
  creditsLeft: number;
  creditsLimit: number;
}

const PAID = ["lite", "starter", "pro"];
const SOON_MS = 5 * 24 * 3600 * 1000;

/** Paid subscribers: plan, expiry (+ badge), remaining quota, and extend / change / cancel actions. */
export function SubscribersViewer({ subscribers }: { subscribers: Subscriber[] }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function run(id: string, fn: () => Promise<void>) {
    setBusy(id);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">ผู้สมัครแพ็กเกจ ({subscribers.length})</h3>
      {subscribers.length === 0 ? (
        <p className="text-xs text-slate-400 dark:text-slate-500">ยังไม่มีผู้สมัครแพ็กเกจ</p>
      ) : (
        subscribers.map((s) => {
          const exp = s.expiresAt ? new Date(s.expiresAt) : null;
          const expired = exp ? exp.getTime() < Date.now() : false;
          const soon = !!exp && !expired && exp.getTime() - Date.now() < SOON_MS;
          return (
            <div
              key={s.userId}
              className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1 text-xs">
                <p className="flex flex-wrap items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
                  {s.plan.toUpperCase()} · <span className="truncate font-normal text-slate-500 dark:text-slate-400">{s.email}</span>
                  {expired && <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 dark:bg-red-950/40 dark:text-red-400">หมดแล้ว</span>}
                  {soon && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">ใกล้หมด</span>}
                </p>
                <p className="text-slate-500 dark:text-slate-400">
                  หมดอายุ: {exp ? exp.toLocaleDateString("th-TH") : "—"} · เหลือสร้างใหม่ {s.toolsLeft}/{s.toolsLimit} · เหลือ {s.creditsLeft}/{s.creditsLimit} แต้ม
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button
                  onClick={() => run(s.userId, () => extendPlanAction(s.userId))}
                  disabled={busy === s.userId}
                  className="rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
                >
                  ต่อ +30วัน
                </button>
                <select
                  value={s.plan}
                  onChange={(e) => run(s.userId, () => setPlanAction(s.userId, e.target.value))}
                  disabled={busy === s.userId}
                  title="เปลี่ยนแพ็กเกจ (รีเซ็ตหมดอายุ +30วัน)"
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-emerald-300 dark:border-slate-700/60 dark:bg-slate-800"
                >
                  {PAID.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => run(s.userId, () => cancelPlanAction(s.userId))}
                  disabled={busy === s.userId}
                  className="rounded-lg border border-red-300 px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-800/60 dark:text-red-400 dark:hover:bg-red-950/30"
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
