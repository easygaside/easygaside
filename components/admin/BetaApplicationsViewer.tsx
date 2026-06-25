"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckBadgeIcon,
  ChatBubbleLeftRightIcon,
  CheckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  approveBetaApplicationAction,
  approveBetaApplicationsAction,
  rejectBetaApplicationAction,
} from "@/app/admin/actions";

export interface BetaApplication {
  email: string;
  emailVerified: boolean;
  name: string | null;
  businessType: string | null;
  buildIdea: string;
  techLevel: string | null;
  device: string | null;
  willingFeedback: boolean;
  status: string;
  createdAt: string;
}

const TECH_LABEL: Record<string, string> = {
  none: "ไม่เคยเขียนโค้ด",
  sheet: "เคยใช้สูตร Sheet",
  automation: "เคยใช้ AppSheet / automation",
  code: "เขียนโค้ดได้บ้าง",
};
const DEVICE_LABEL: Record<string, string> = {
  mobile: "📱 มือถือ",
  computer: "💻 คอม",
  both: "📱💻 ทั้งคู่",
};
const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  rejected: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "รอพิจารณา",
  approved: "อนุมัติแล้ว",
  rejected: "ปฏิเสธ",
};

/** Closed-beta applicant dashboard: read survey answers + approve (→ allowlist) / reject. */
export function BetaApplicationsViewer({ applications }: { applications: BetaApplication[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const pending = applications.filter((a) => a.status === "pending").length;
  // Anything not already approved can be (re)approved + emailed in a batch.
  const selectable = applications.filter((a) => a.status !== "approved");
  const allSelected = selectable.length > 0 && selectable.every((a) => selected.has(a.email));

  function toggle(email: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectable.map((a) => a.email)));
  }

  async function act(email: string, fn: (e: string) => Promise<void>) {
    setBusy(email);
    try {
      await fn(email);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function bulkApprove() {
    if (selected.size === 0) return;
    setBulkBusy(true);
    setResult(null);
    try {
      const res = await approveBetaApplicationsAction([...selected]);
      setSelected(new Set());
      setResult(`อนุมัติ ${res.approved} ราย · ส่งอีเมลสำเร็จ ${res.emailed} ราย`);
      router.refresh();
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
        ใบสมัคร Beta ({applications.length})
        {pending > 0 && (
          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            {pending} รอพิจารณา
          </span>
        )}
      </h2>
      <p className="mb-3 text-xs text-slate-400 dark:text-slate-500">
        คำตอบแบบสอบถามจากหน้า /beta — กด &ldquo;อนุมัติ&rdquo; เพื่อเพิ่มเข้า allowlist + ส่งอีเมลแจ้งผู้สมัครอัตโนมัติ
      </p>

      {/* bulk toolbar */}
      {selectable.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 dark:border-slate-700/60 dark:bg-slate-800/40">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 accent-emerald-500" />
            เลือกทั้งหมดที่ยังไม่อนุมัติ ({selectable.length})
          </label>
          {selected.size > 0 && (
            <>
              <span className="text-xs text-slate-400 dark:text-slate-500">เลือกแล้ว {selected.size} ราย</span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => setSelected(new Set())}
                  disabled={bulkBusy}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-200/70 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-700/60"
                >
                  ล้าง
                </button>
                <button
                  onClick={bulkApprove}
                  disabled={bulkBusy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
                >
                  <CheckIcon className="h-4 w-4" />
                  {bulkBusy ? "กำลังส่ง…" : `อนุมัติ + ส่งอีเมล (${selected.size})`}
                </button>
              </div>
            </>
          )}
          {result && selected.size === 0 && (
            <span className="ml-auto text-xs font-medium text-emerald-600 dark:text-emerald-400">✓ {result}</span>
          )}
        </div>
      )}

      {applications.length === 0 ? (
        <p className="text-xs text-slate-400 dark:text-slate-500">
          ยังไม่มีใบสมัคร — เมื่อมีคนกรอกแบบสอบถามที่หน้า /beta จะแสดงที่นี่
        </p>
      ) : (
        <div className="space-y-2.5">
          {applications.map((a) => (
            <div
              key={a.email}
              className={`rounded-xl border p-3 transition ${
                selected.has(a.email)
                  ? "border-emerald-300 ring-1 ring-emerald-300 dark:border-emerald-700/60 dark:ring-emerald-700/40"
                  : a.status === "rejected"
                    ? "border-slate-200 opacity-60 dark:border-slate-800"
                    : "border-slate-200 dark:border-slate-700/60"
              }`}
            >
              {/* header: identity + status */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {a.status !== "approved" && (
                  <input
                    type="checkbox"
                    checked={selected.has(a.email)}
                    onChange={() => toggle(a.email)}
                    className="h-4 w-4 shrink-0 accent-emerald-500"
                    aria-label={`เลือก ${a.email}`}
                  />
                )}
                <span className="break-all text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {a.name || a.email}
                </span>
                {a.emailVerified && (
                  <CheckBadgeIcon
                    className="h-4 w-4 shrink-0 text-emerald-500"
                    title="ยืนยันอีเมลด้วย Google แล้ว"
                  />
                )}
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[a.status] ?? STATUS_STYLE.pending}`}
                >
                  {STATUS_LABEL[a.status] ?? a.status}
                </span>
                <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500">
                  {a.createdAt.slice(0, 10)}
                </span>
              </div>

              {a.name && <p className="mt-0.5 break-all text-[12px] text-slate-400 dark:text-slate-500">{a.email}</p>}

              {/* meta chips */}
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                {a.businessType && (
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    🏢 {a.businessType}
                  </span>
                )}
                {a.techLevel && (
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    🧩 {TECH_LABEL[a.techLevel] ?? a.techLevel}
                  </span>
                )}
                {a.device && (
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {DEVICE_LABEL[a.device] ?? a.device}
                  </span>
                )}
                {a.willingFeedback && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <ChatBubbleLeftRightIcon className="h-3 w-3" /> ยินดีให้ feedback
                  </span>
                )}
              </div>

              {/* build idea */}
              <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-slate-50 px-3 py-2 text-[13px] leading-relaxed text-slate-700 dark:bg-slate-800/40 dark:text-slate-200">
                {a.buildIdea}
              </p>

              {/* actions */}
              <div className="mt-2.5 flex gap-2">
                <button
                  onClick={() => act(a.email, approveBetaApplicationAction)}
                  disabled={busy === a.email || a.status === "approved"}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-40 sm:flex-none"
                >
                  <CheckIcon className="h-4 w-4" />
                  {a.status === "approved" ? "อนุมัติแล้ว" : "อนุมัติ → allowlist"}
                </button>
                <button
                  onClick={() => act(a.email, rejectBetaApplicationAction)}
                  disabled={busy === a.email || a.status === "rejected"}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:border-slate-700/60 dark:text-slate-400 dark:hover:bg-red-950/30 sm:flex-none"
                >
                  <XMarkIcon className="h-4 w-4" />
                  ปฏิเสธ
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
