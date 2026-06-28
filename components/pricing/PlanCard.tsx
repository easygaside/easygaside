"use client";

import { useActionState, useState } from "react";
import { CheckIcon } from "@heroicons/react/24/outline";
import { submitUpgradeRequest, type UpgradeFormState } from "@/app/pricing/actions";

const PROMPTPAY_TARGET = "0995588665";

/**
 * One pricing tier. Paid tiers reveal a PromptPay QR (promptpay.io, no server call) + a slip-upload
 * form on "เลือก". Submitting creates a pending upgrade request (the founder approves in /admin).
 */
export function PlanCard({
  plan,
  label,
  priceThb,
  yearlyThb,
  highlights,
  isCurrent,
}: {
  plan: string;
  label: string;
  priceThb: number;
  yearlyThb: number;
  highlights: string[];
  isCurrent: boolean;
}) {
  const [showQr, setShowQr] = useState(false);
  const [state, formAction, pending] = useActionState<UpgradeFormState, FormData>(submitUpgradeRequest, {});
  const paid = priceThb > 0;

  return (
    <div
      className={`flex flex-col rounded-2xl border p-5 ${
        isCurrent
          ? "border-emerald-400 bg-emerald-50/50 dark:border-emerald-600/60 dark:bg-emerald-950/20"
          : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      }`}
    >
      <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{label}</h2>
      <p className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">
        {paid ? `฿${priceThb}` : "ฟรี"}
        {paid && <span className="text-sm font-medium text-slate-400"> /เดือน</span>}
      </p>
      {paid && yearlyThb > 0 && (
        <p className="text-xs text-slate-400 dark:text-slate-500">รายปี ฿{yearlyThb.toLocaleString()} (ถูกกว่า ~2 เดือน)</p>
      )}

      <ul className="mt-4 flex-1 space-y-2">
        {highlights.map((h) => (
          <li key={h} className="flex items-start gap-2 text-[13px] text-slate-600 dark:text-slate-300">
            <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <span>{h}</span>
          </li>
        ))}
      </ul>

      {isCurrent ? (
        <div className="mt-5 rounded-xl bg-emerald-100 py-2 text-center text-sm font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          แพ็กเกจปัจจุบัน
        </div>
      ) : paid ? (
        <div className="mt-5">
          <button
            onClick={() => setShowQr((v) => !v)}
            className="w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-400"
          >
            {showQr ? "ซ่อน" : "เลือกแพ็กเกจนี้"}
          </button>

          {showQr && (
            <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700/60 dark:bg-slate-800/50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://promptpay.io/${PROMPTPAY_TARGET}/${priceThb}.png`}
                alt={`PromptPay ฿${priceThb}`}
                width={168}
                height={168}
                className="rounded-lg bg-white"
              />
              <p className="text-center text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
                สแกนโอน <b>฿{priceThb}</b> (พร้อมเพย์ {PROMPTPAY_TARGET}) แล้วแนบสลิปเพื่อยืนยัน
              </p>

              {state.ok ? (
                <p className="rounded-lg bg-emerald-100 px-3 py-2 text-center text-[12px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  ✓ ส่งคำขอแล้ว — ทีมงานจะยืนยันแล้วเปิดแพ็กเกจให้
                </p>
              ) : (
                <form action={formAction} className="flex w-full flex-col gap-2">
                  <input type="hidden" name="plan" value={plan} />
                  <input
                    type="file"
                    name="slip"
                    accept="image/*"
                    required
                    className="text-[11px] text-slate-500 file:mr-2 file:rounded-md file:border-0 file:bg-slate-200 file:px-2 file:py-1 file:text-[11px] file:font-medium dark:text-slate-400 dark:file:bg-slate-700"
                  />
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-lg bg-emerald-600 py-1.5 text-[12px] font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {pending ? "กำลังส่ง…" : "แนบสลิป + ส่งคำขอ"}
                  </button>
                  {state.error && <p className="text-center text-[11px] text-red-600 dark:text-red-400">{state.error}</p>}
                </form>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
