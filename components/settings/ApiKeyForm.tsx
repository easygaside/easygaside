"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircleIcon, KeyIcon, TrashIcon } from "@heroicons/react/24/outline";
import { removeApiKeyAction, saveApiKeyAction } from "@/app/settings/actions";

export function ApiKeyForm({ hasKey }: { hasKey: boolean }) {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!key.trim() || busy) return;
    setBusy(true);
    setError(null);
    const r = await saveApiKeyAction(key);
    setBusy(false);
    if (!r.ok) {
      setError(r.error ?? "บันทึกไม่สำเร็จ");
      return;
    }
    setKey("");
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    await removeApiKeyAction();
    setBusy(false);
    router.refresh();
  }

  if (hasKey) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800/60 dark:bg-emerald-950/40">
        <span className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          <CheckCircleIcon className="h-5 w-5 shrink-0" />
          ใช้คีย์ Claude ของคุณ — สร้าง+ตรวจโค้ด ใช้โควตาคุณเอง ไม่จำกัด
        </span>
        <button
          onClick={remove}
          disabled={busy}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700/60 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60"
        >
          <TrashIcon className="h-3.5 w-3.5" />
          เอาคีย์ออก
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-900">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        <KeyIcon className="h-4 w-4 text-slate-400" />
        ใช้ Anthropic (Claude) key ของคุณเอง
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        ใส่คีย์แล้ว AI จะใช้ <b>Claude ด้วยโควตาคุณเอง</b> ทั้งตอน<b>สร้าง</b>และตอน<b>ตรวจซ้ำ</b> — ไม่จำกัด ไม่พึ่งเครดิตเรา ·
        คีย์ถูก<b>เข้ารหัส AES-256-GCM</b> เก็บฝั่งเซิร์ฟเวอร์ <b>ไม่ส่งกลับเบราว์เซอร์</b> และลบได้ทุกเมื่อ · สร้างคีย์ที่ console.anthropic.com
      </p>
      <div className="mt-3 flex gap-2">
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="sk-ant-..."
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-emerald-300 dark:border-slate-700/60 dark:bg-slate-800"
        />
        <button
          onClick={save}
          disabled={busy || !key.trim()}
          className="shrink-0 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {busy ? "กำลังตรวจ…" : "บันทึก"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-500 dark:text-red-400">{error}</p>}
    </div>
  );
}
