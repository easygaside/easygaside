"use client";

import { useState } from "react";
import { CheckIcon } from "@heroicons/react/24/outline";

const PROMPTPAY_TARGET = "0995588665";

/**
 * One pricing tier. Paid tiers reveal a PromptPay QR (promptpay.io, no server call) for the selected
 * amount on "เลือก". The slip upload + upgrade request + Discord notify land in the next stage; for now
 * the card guides the manual transfer.
 */
export function PlanCard({
  label,
  priceThb,
  yearlyThb,
  highlights,
  isCurrent,
}: {
  label: string;
  priceThb: number;
  yearlyThb: number;
  highlights: string[];
  isCurrent: boolean;
}) {
  const [showQr, setShowQr] = useState(false);
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
            {showQr ? "ซ่อน QR" : "เลือกแพ็กเกจนี้"}
          </button>
          {showQr && (
            <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700/60 dark:bg-slate-800/50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://promptpay.io/${PROMPTPAY_TARGET}/${priceThb}.png`}
                alt={`PromptPay ฿${priceThb}`}
                width={176}
                height={176}
                className="rounded-lg bg-white"
              />
              <p className="text-center text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
                สแกนโอน <b>฿{priceThb}</b> (พร้อมเพย์ {PROMPTPAY_TARGET})
                <br />
                แล้วแนบสลิปเพื่อยืนยัน — <span className="text-amber-600 dark:text-amber-400">ระบบแนบสลิปในแอปเร็ว ๆ นี้</span> หรือแจ้งทาง LINE
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
