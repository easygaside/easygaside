"use client";

import { useState } from "react";
import { approveUpgradeAction, rejectUpgradeAction } from "@/app/admin/actions";

export interface UpgradeRequest {
  id: string;
  email: string | null;
  plan: string;
  amountThb: number;
  slipUrl: string | null;
  createdAt: string;
}

/** Pending upgrade requests (PromptPay slip) with approve/reject. Approve → sets plan + GLM arm. */
export function UpgradeRequestsViewer({ requests }: { requests: UpgradeRequest[] }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, fn: (id: string) => Promise<void>) {
    setBusy(id);
    try {
      await fn(id);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
        คำขออัปเกรด {requests.length > 0 && `(${requests.length} รออนุมัติ)`}
      </h3>
      {requests.length === 0 ? (
        <p className="text-xs text-slate-400 dark:text-slate-500">ยังไม่มีคำขอที่รออนุมัติ</p>
      ) : (
        requests.map((r) => (
          <div
            key={r.id}
            className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800 sm:flex-row sm:items-center"
          >
            {r.slipUrl && (
              <a href={r.slipUrl} target="_blank" rel="noreferrer" className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.slipUrl} alt="สลิป" className="h-20 w-20 rounded-lg border border-slate-200 object-cover dark:border-slate-700" />
              </a>
            )}
            <div className="min-w-0 flex-1 text-xs">
              <p className="font-semibold text-slate-700 dark:text-slate-200">
                {r.plan.toUpperCase()} · ฿{r.amountThb.toLocaleString()}
              </p>
              <p className="truncate text-slate-500 dark:text-slate-400">{r.email ?? r.id}</p>
              <p className="text-slate-400 dark:text-slate-500">{new Date(r.createdAt).toLocaleString("th-TH")}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => act(r.id, approveUpgradeAction)}
                disabled={busy === r.id}
                className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
              >
                อนุมัติ
              </button>
              <button
                onClick={() => act(r.id, rejectUpgradeAction)}
                disabled={busy === r.id}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-800/60 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                ปฏิเสธ
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
