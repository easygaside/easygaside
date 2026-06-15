"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TrashIcon } from "@heroicons/react/24/outline";
import { addAllowlistEmailAction, removeAllowlistEmailAction } from "@/app/admin/actions";

export interface AllowlistEntry {
  email: string;
  note: string | null;
  created_at: string;
}

/** Manage who can use the closed beta (egs_beta_allowlist) — no more raw SQL inserts. */
export function AllowlistManager({ emails }: { emails: AllowlistEntry[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add() {
    if (!draft.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await addAllowlistEmailAction(draft);
      setDraft("");
      router.refresh();
    } catch {
      setErr("อีเมลไม่ถูกต้อง หรือเพิ่มไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function remove(email: string) {
    if (!confirm(`ลบ ${email} ออกจาก allowlist?`)) return;
    setBusy(true);
    try {
      await removeAllowlistEmailAction(email);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8">
      <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        Beta allowlist ({emails.length}) — ใครเข้าใช้รอบทดสอบได้
      </h2>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="เพิ่มอีเมล เช่น tester@gmail.com"
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-emerald-300 dark:border-slate-700/60 dark:bg-slate-800"
        />
        <button
          onClick={add}
          disabled={busy || !draft.trim()}
          className="shrink-0 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
        >
          เพิ่ม
        </button>
      </div>
      {err && <p className="mt-1 text-[11px] text-red-500 dark:text-red-400">{err}</p>}

      {emails.length === 0 ? (
        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
          ยังไม่มีใครใน allowlist — เพิ่มอีเมลเทสเตอร์ด้านบน (BYOK users เข้าได้เสมอ)
        </p>
      ) : (
        <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700/60">
          {emails.map((e) => (
            <div
              key={e.email}
              className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-1.5 first:border-t-0 dark:border-slate-800"
            >
              <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-300">{e.email}</span>
              <button
                onClick={() => remove(e.email)}
                disabled={busy}
                title="ลบออกจาก allowlist"
                className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50 dark:hover:bg-red-950/40"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
