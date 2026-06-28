"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CheckIcon, KeyIcon } from "@heroicons/react/24/outline";
import { submitUpgradeRequest, type UpgradeFormState } from "@/app/pricing/actions";

const PROMPTPAY_TARGET = "0995588665";

/**
 * "Bring your own Anthropic key" — a PAID add-on (฿99/mo), styled apart from the emerald plan tiers
 * (dark indigo). Purchase mirrors the plans: PromptPay slip → founder approves in /admin → byo_enabled
 * turns on → the key form unlocks in /settings. While active the user runs unlimited Claude on their
 * OWN key (no แต้ม/quota); they pay Anthropic for usage on top of the ฿99 service fee.
 */
const BYO_POINTS = [
  "ใช้ Claude ระดับ Flagship โดยตรง — ฉลาด/สวยสุด",
  "สร้างเครื่องมือ + แชทได้ไม่จำกัด · ไม่กินแต้ม",
  "ค่าบริการ ฿99/เดือน + จ่ายค่า AI ตรงกับ Anthropic ตามจริง",
  "เหมาะกับนักพัฒนา/ทีมที่มีคีย์อยู่แล้ว",
];

export function ByokCard({ active, priceThb }: { active: boolean; priceThb: number }) {
  const [showQr, setShowQr] = useState(false);
  const [state, formAction, pending] = useActionState<UpgradeFormState, FormData>(submitUpgradeRequest, {});

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-indigo-400/40 bg-gradient-to-br from-slate-900 to-indigo-950 p-6 text-slate-100 shadow-lg">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-200 ring-1 ring-inset ring-indigo-400/40">
              <KeyIcon className="h-3.5 w-3.5" /> ขั้นสูง
            </span>
            <h2 className="text-lg font-bold text-white">ใช้คีย์ของคุณเอง (BYO Anthropic Key)</h2>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            มี Anthropic API key อยู่แล้ว? สมัคร BYO แล้วใช้ Claude ระดับ Flagship โดยตรง — ไม่จำกัดการสร้าง
            ไม่กินแต้ม คุณชำระค่าบริการ ฿{priceThb}/เดือน และจ่ายค่า AI กับ Anthropic ตามการใช้จริงเอง
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {BYO_POINTS.map((p) => (
              <li key={p} className="flex items-start gap-2 text-[13px] text-slate-200">
                <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-indigo-300" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="shrink-0 sm:w-56">
          <p className="text-2xl font-extrabold text-white sm:text-right">
            ฿{priceThb}
            <span className="text-sm font-medium text-slate-400"> /เดือน</span>
          </p>

          {active ? (
            <div className="mt-3 space-y-2">
              <p className="rounded-lg bg-emerald-500/15 px-3 py-2 text-center text-[12px] font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-400/30">
                ✓ BYO เปิดอยู่
              </p>
              <Link
                href="/settings"
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400"
              >
                ใส่/จัดการคีย์ในตั้งค่า →
              </Link>
            </div>
          ) : (
            <div className="mt-3">
              <button
                onClick={() => setShowQr((v) => !v)}
                className="w-full rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-400"
              >
                {showQr ? "ซ่อน" : "สมัคร BYO"}
              </button>

              {showQr && (
                <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-indigo-400/30 bg-slate-950/40 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://promptpay.io/${PROMPTPAY_TARGET}/${priceThb}.png`}
                    alt={`PromptPay ฿${priceThb}`}
                    width={156}
                    height={156}
                    className="rounded-lg bg-white"
                  />
                  <p className="text-center text-[12px] leading-relaxed text-slate-300">
                    สแกนโอน <b>฿{priceThb}</b> (พร้อมเพย์ {PROMPTPAY_TARGET}) แล้วแนบสลิปเพื่อยืนยัน
                  </p>

                  {state.ok ? (
                    <p className="rounded-lg bg-emerald-500/15 px-3 py-2 text-center text-[12px] font-semibold text-emerald-300">
                      ✓ ส่งคำขอแล้ว — ทีมงานจะยืนยันแล้วเปิด BYO ให้
                    </p>
                  ) : (
                    <form action={formAction} className="flex w-full flex-col gap-2">
                      <input type="hidden" name="plan" value="byo" />
                      <input
                        type="file"
                        name="slip"
                        accept="image/*"
                        required
                        className="text-[11px] text-slate-400 file:mr-2 file:rounded-md file:border-0 file:bg-indigo-500/30 file:px-2 file:py-1 file:text-[11px] file:font-medium file:text-indigo-100"
                      />
                      <button
                        type="submit"
                        disabled={pending}
                        className="rounded-lg bg-indigo-600 py-1.5 text-[12px] font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
                      >
                        {pending ? "กำลังส่ง…" : "แนบสลิป + ส่งคำขอ"}
                      </button>
                      {state.error && <p className="text-center text-[11px] text-red-300">{state.error}</p>}
                    </form>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
