"use client";

import { useState } from "react";
import { SparklesIcon } from "@heroicons/react/24/outline";
import { newProjectAction } from "@/app/projects/actions";

const EXAMPLES = [
  "ฟอร์มจองคิว บันทึกลง Sheet ส่งอีเมลยืนยัน",
  "ระบบเช็คสต๊อกสินค้า ตัด/เพิ่มสต๊อก",
  "ส่งอีเมลอัตโนมัติจากรายชื่อใน Google Sheet",
  "แดชบอร์ดสรุปยอดขายรายวัน",
];

export function CreateProjectBar() {
  const [name, setName] = useState("");

  return (
    <form
      action={newProjectAction}
      className="rounded-3xl border border-white/60 bg-gradient-to-br from-white to-emerald-50/40 p-5 shadow-[0_18px_50px_rgba(16,185,129,0.10)] ring-1 ring-emerald-100/70"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-500 text-white shadow-[0_8px_20px_rgba(16,185,129,0.35)]">
          <SparklesIcon className="h-5 w-5" />
        </span>
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="อยากสร้างอะไร? พิมพ์บอกเป็นภาษาคนได้เลย…"
          className="min-w-[220px] flex-1 rounded-2xl bg-white/80 px-4 py-3 text-sm outline-none ring-1 ring-slate-200 transition focus:ring-2 focus:ring-emerald-300"
        />
        <button
          type="submit"
          className="rounded-2xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(16,185,129,0.35)] transition hover:bg-emerald-400"
        >
          สร้างโปรเจกต์ →
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 pl-1">
        <span className="text-xs text-slate-400">ลองเช่น</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setName(ex)}
            className="rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs text-slate-500 transition hover:border-emerald-300 hover:text-emerald-600"
          >
            {ex}
          </button>
        ))}
      </div>
    </form>
  );
}
