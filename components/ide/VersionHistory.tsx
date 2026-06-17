"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUturnLeftIcon,
  ClockIcon,
  PencilSquareIcon,
  RocketLaunchIcon,
  SparklesIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { listVersionsAction, restoreVersionAction } from "@/app/projects/version-actions";
import type { VersionMeta, VersionSource } from "@/lib/versions";

const SOURCE: Record<VersionSource, { label: string; Icon: typeof SparklesIcon; cls: string }> = {
  ai: { label: "AI สร้าง", Icon: SparklesIcon, cls: "text-emerald-600 dark:text-emerald-400" },
  manual: { label: "แก้เอง", Icon: PencilSquareIcon, cls: "text-sky-600 dark:text-sky-400" },
  deploy: { label: "Deploy", Icon: RocketLaunchIcon, cls: "text-violet-600 dark:text-violet-400" },
  restore: { label: "กู้คืน", Icon: ArrowUturnLeftIcon, cls: "text-amber-600 dark:text-amber-400" },
};

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "เมื่อสักครู่";
  if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ชม.ที่แล้ว`;
  return `${Math.floor(h / 24)} วันที่แล้ว`;
}

/** "ประวัติ" — list code snapshots; restore rolls egs_files back (current code is snapshotted first). */
export function VersionHistory({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<VersionMeta[] | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);

  async function openPanel() {
    setOpen(true);
    setVersions(null);
    setVersions(await listVersionsAction(projectId));
  }

  async function restore(id: string) {
    if (restoring) return;
    if (!confirm("กู้คืนโค้ดเป็นเวอร์ชันนี้?\nโค้ดปัจจุบันถูกบันทึกเป็นเวอร์ชันไว้แล้ว — ย้อนกลับได้")) return;
    setRestoring(id);
    const r = await restoreVersionAction(id);
    setRestoring(null);
    if (r.ok) {
      setOpen(false);
      router.refresh(); // re-fetch files → IdeShell setInitial → editor shows restored code
    }
  }

  return (
    <>
      <button
        onClick={openPanel}
        className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      >
        <ClockIcon className="h-3.5 w-3.5" />
        ประวัติ
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-slate-200/70 px-4 py-3 dark:border-slate-800">
              <ClockIcon className="h-5 w-5 text-slate-400" />
              <h3 className="text-sm font-bold">ประวัติโค้ด</h3>
              <span className="flex-1" />
              <button onClick={() => setOpen(false)} aria-label="ปิด" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {versions === null ? (
                <div className="grid place-items-center py-10 text-sm text-slate-400">กำลังโหลด…</div>
              ) : versions.length === 0 ? (
                <div className="grid place-items-center py-10 text-center text-sm text-slate-400">
                  ยังไม่มีประวัติ — จะบันทึกเวอร์ชันเมื่อ AI สร้าง แก้เอง หรือ deploy
                </div>
              ) : (
                <ul className="flex flex-col gap-1">
                  {versions.map((v) => {
                    const s = SOURCE[v.source] ?? SOURCE.manual;
                    return (
                      <li
                        key={v.id}
                        className="flex items-center gap-3 rounded-xl px-3 py-2 transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      >
                        <s.Icon className={`h-5 w-5 shrink-0 ${s.cls}`} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{s.label}</div>
                          <div className="text-[11px] text-slate-400 dark:text-slate-500">
                            {timeAgo(v.created_at)} · {v.fileCount} ไฟล์
                          </div>
                        </div>
                        <button
                          onClick={() => restore(v.id)}
                          disabled={restoring !== null}
                          className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <ArrowUturnLeftIcon className="h-3.5 w-3.5" />
                          {restoring === v.id ? "กำลังกู้คืน…" : "กู้คืน"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
