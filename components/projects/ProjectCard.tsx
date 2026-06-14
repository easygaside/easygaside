"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircleIcon, GlobeAltIcon, TableCellsIcon, TrashIcon } from "@heroicons/react/24/outline";
import { deleteProjectAction } from "@/app/projects/actions";
import type { EgsProject } from "@/types/db";

const KIND_LABEL: Record<string, string> = { webapp: "เว็บแอป", bound: "ผูก Sheet" };

export function ProjectCard({ project, deployUrl }: { project: EgsProject; deployUrl?: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const isBound = project.kind === "bound";
  const deployed = !!deployUrl;

  async function remove() {
    setBusy(true);
    try {
      await deleteProjectAction(project.id);
      router.refresh();
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/70 bg-white p-5 shadow-[0_8px_24px_rgba(60,70,110,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(60,70,110,0.13)]">
      {/* accent = deploy status */}
      <span className={`absolute inset-x-0 top-0 h-1 ${deployed ? "bg-emerald-400" : "bg-slate-300"}`} />

      <div className="flex items-start gap-3">
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
            isBound ? "bg-blue-50 text-blue-500" : "bg-emerald-50 text-emerald-500"
          }`}
        >
          {isBound ? <TableCellsIcon className="h-5 w-5" /> : <GlobeAltIcon className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1 pr-7">
          <h3 className="line-clamp-2 font-semibold leading-snug text-slate-800 group-hover:text-emerald-600">
            {project.name}
          </h3>
          <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
            {KIND_LABEL[project.kind] ?? project.kind}
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <p className="text-xs text-slate-400">
          แก้ไข{" "}
          {new Date(project.updated_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
        </p>
        {deployed ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
            <CheckCircleIcon className="h-3 w-3" />
            deploy แล้ว
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-400">
            ยังไม่ deploy
          </span>
        )}
      </div>

      {/* full-card navigation overlay (under the delete button) */}
      <Link href={`/projects/${project.id}`} aria-label={project.name} className="absolute inset-0 rounded-2xl" />

      {/* delete (above the overlay) */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setConfirm(true);
        }}
        aria-label="ลบโปรเจกต์"
        className="absolute right-2.5 top-2.5 z-10 grid h-7 w-7 place-items-center rounded-lg text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
      >
        <TrashIcon className="h-4 w-4" />
      </button>

      {confirm && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm"
          onClick={() => !busy && setConfirm(false)}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-red-500">
                <TrashIcon className="h-6 w-6" />
              </span>
            </div>
            <h3 className="mt-3 text-center font-bold text-slate-800">ลบโปรเจกต์?</h3>
            <p className="mt-1 line-clamp-2 text-center text-sm text-slate-500">&ldquo;{project.name}&rdquo;</p>
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-center text-[12px] leading-relaxed text-amber-700">
              ลบเฉพาะใน EasyGAS เท่านั้น — ไฟล์/สคริปต์ใน Google Drive ของคุณ <b>ไม่ถูกลบ</b>
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setConfirm(false)}
                disabled={busy}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={remove}
                disabled={busy}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white transition hover:bg-red-400 disabled:opacity-50"
              >
                {busy ? "กำลังลบ…" : "ลบเลย"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
