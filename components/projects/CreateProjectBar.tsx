"use client";

import { SparklesIcon } from "@heroicons/react/24/outline";
import { newProjectAction } from "@/app/projects/actions";

export function CreateProjectBar() {
  return (
    <form
      action={newProjectAction}
      className="rounded-3xl border border-white/60 dark:border-slate-700/60 bg-gradient-to-br from-white to-emerald-50/40 dark:from-slate-900 dark:to-emerald-950/30 p-5 shadow-[0_18px_50px_rgba(16,185,129,0.10)] ring-1 ring-emerald-100/70 dark:ring-emerald-800/60"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-500 text-white shadow-[0_8px_20px_rgba(16,185,129,0.35)]">
          <SparklesIcon className="h-5 w-5" />
        </span>
        <input
          name="name"
          required
          maxLength={80}
          placeholder="ตั้งชื่อโปรเจกต์ใหม่ เช่น ระบบจองคิวร้านตัดผม"
          className="min-w-[220px] flex-1 rounded-2xl bg-white/80 dark:bg-slate-900/70 px-4 py-3 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none ring-1 ring-slate-200 dark:ring-slate-700/60 transition focus:ring-2 focus:ring-emerald-300"
        />
        <button
          type="submit"
          className="rounded-2xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(16,185,129,0.35)] transition hover:bg-emerald-400"
        >
          สร้างโปรเจกต์ →
        </button>
      </div>
      <p className="mt-2 pl-1 text-xs text-slate-400 dark:text-slate-500">
        ตั้งชื่อก่อน — เดี๋ยวเข้าไปบอก AI ว่าอยากได้ระบบอะไรในหน้าโปรเจกต์
      </p>
    </form>
  );
}
