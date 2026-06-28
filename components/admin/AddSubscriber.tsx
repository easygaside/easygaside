"use client";

import { useMemo, useState } from "react";
import { grantByoAction, grantPlanAction } from "@/app/admin/actions";

interface UserOption {
  id: string;
  email: string;
}

const OPTIONS: { value: string; label: string }[] = [
  { value: "lite", label: "Lite" },
  { value: "starter", label: "Starter" },
  { value: "pro", label: "Pro" },
  { value: "byo", label: "BYO (คีย์ตัวเอง)" },
];

/** Today + 30 days as yyyy-mm-dd (default expiry the founder can override). */
function plus30Days(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

/**
 * Founder tool: grant ANY user a paid plan with a chosen expiry (default +30 days). Used to add the
 * founder's own account — or any comped user — onto a REAL plan, instead of a virtual override.
 */
export function AddSubscriber({ users }: { users: UserOption[] }) {
  const sorted = useMemo(
    () => [...users].sort((a, b) => a.email.localeCompare(b.email)),
    [users],
  );
  const [userId, setUserId] = useState("");
  const [plan, setPlan] = useState<string>("pro");
  const [expiresAt, setExpiresAt] = useState(plus30Days);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit() {
    if (!userId) {
      setMsg({ ok: false, text: "เลือกผู้ใช้ก่อน" });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      if (plan === "byo") await grantByoAction(userId, expiresAt);
      else await grantPlanAction(userId, plan, expiresAt);
      const email = sorted.find((u) => u.id === userId)?.email ?? userId;
      const what = plan === "byo" ? "BYO" : plan.toUpperCase();
      setMsg({ ok: true, text: `ตั้ง ${what} ให้ ${email} ถึง ${expiresAt} แล้ว` });
      setUserId("");
      setExpiresAt(plus30Days());
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "ตั้งแพ็กเกจไม่สำเร็จ" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
      <div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">เพิ่ม/ตั้งแพ็กเกจให้ผู้ใช้</h3>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          เลือกผู้ใช้ → แพ็กเกจ/BYO → วันหมดอายุ (เริ่มต้น +30 วัน) · แพ็กเกจจ่ายเงินตั้ง GLM ให้อัตโนมัติ
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <select
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          disabled={busy}
          className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-300 dark:border-slate-700/60 dark:bg-slate-800"
        >
          <option value="">— เลือกผู้ใช้ —</option>
          {sorted.map((u) => (
            <option key={u.id} value={u.id}>
              {u.email}
            </option>
          ))}
        </select>

        <select
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          disabled={busy}
          title="แพ็กเกจ"
          className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-300 dark:border-slate-700/60 dark:bg-slate-800"
        >
          {OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          disabled={busy}
          title="วันหมดอายุ"
          className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-300 dark:border-slate-700/60 dark:bg-slate-800"
        />

        <button
          onClick={submit}
          disabled={busy || !userId}
          className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {busy ? "กำลังตั้ง…" : "ตั้งแพ็กเกจ"}
        </button>
      </div>

      {msg && (
        <p
          className={`text-xs ${msg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
