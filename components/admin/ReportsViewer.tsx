"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { setReportStatusAction } from "@/app/admin/actions";

export interface FailureReport {
  id: string;
  kind: string;
  message: string;
  project: string | null;
  url: string | null;
  status: string;
  created_at: string;
  files: { path: string; content: string }[] | null;
}

const KIND_LABEL: Record<string, string> = {
  broken: "🚨 โค้ดพัง แก้ไม่ได้",
  bug: "🐞 บั๊ก",
  idea: "💡 ข้อเสนอแนะ",
  other: "📝 อื่น ๆ",
};

/** Failure-capture flywheel viewer: read problem reports + their code snapshot for analysis. */
export function ReportsViewer({ reports }: { reports: FailureReport[] }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function toggleStatus(r: FailureReport) {
    setBusy(true);
    try {
      await setReportStatusAction(r.id, r.status === "done" ? "open" : "done");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8">
      <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        รายงานปัญหา ({reports.length}) — flywheel วิเคราะห์โค้ดที่พัง
      </h2>
      {reports.length === 0 ? (
        <p className="text-xs text-slate-400 dark:text-slate-500">
          ยังไม่มีรายงาน — เมื่อผู้ใช้แจ้ง &ldquo;โค้ดพัง แก้ไม่ได้&rdquo; โค้ดจะถูกเก็บมาที่นี่เพื่อวิเคราะห์
        </p>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => {
            const open = openId === r.id;
            return (
              <div
                key={r.id}
                className={`rounded-xl border ${
                  r.status === "done"
                    ? "border-slate-200 opacity-60 dark:border-slate-800"
                    : "border-slate-200 dark:border-slate-700/60"
                }`}
              >
                <div className="flex items-start gap-2 p-3">
                  <button
                    onClick={() => r.files && setOpenId(open ? null : r.id)}
                    className={`mt-0.5 shrink-0 text-slate-400 transition ${r.files ? "hover:text-slate-700 dark:hover:text-slate-200" : "opacity-30"}`}
                    title={r.files ? "ดูโค้ดที่แนบมา" : "ไม่มีโค้ดแนบ"}
                  >
                    <ChevronRightIcon className={`h-4 w-4 transition ${open ? "rotate-90" : ""}`} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-200">{KIND_LABEL[r.kind] ?? r.kind}</span>
                      {r.project && <span className="text-slate-400 dark:text-slate-500">· {r.project}</span>}
                      {r.files && <span className="text-emerald-600 dark:text-emerald-400">· 📎 {r.files.length} ไฟล์</span>}
                      <span className="text-slate-400 dark:text-slate-500">· {r.created_at.slice(0, 16).replace("T", " ")}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600 dark:text-slate-300">{r.message}</p>
                  </div>
                  <button
                    onClick={() => toggleStatus(r)}
                    disabled={busy}
                    className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-50 ${
                      r.status === "done"
                        ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                        : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
                    }`}
                  >
                    {r.status === "done" ? "เปิดใหม่" : "ทำเสร็จ"}
                  </button>
                </div>
                {open && r.files && (
                  <div className="space-y-2 border-t border-slate-100 p-3 dark:border-slate-800">
                    {r.files.map((f) => (
                      <details key={f.path}>
                        <summary className="cursor-pointer font-mono text-[11px] text-slate-500 dark:text-slate-400">{f.path}</summary>
                        <pre className="mt-1 max-h-64 overflow-auto rounded-lg bg-slate-900 p-2 font-mono text-[11px] leading-relaxed text-slate-200">
                          {f.content}
                        </pre>
                      </details>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
