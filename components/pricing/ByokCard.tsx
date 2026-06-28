import Link from "next/link";
import { CheckIcon, KeyIcon } from "@heroicons/react/24/outline";

/**
 * "Bring your own Anthropic key" option — deliberately styled apart from the paid tiers (dark indigo,
 * not the emerald plan cards): it's not a subscription. The user adds their key in /settings, which
 * locks them to Claude (Flagship) with NO tool/แต้ม limits; they pay Anthropic directly for usage.
 */
const BYOK_POINTS = [
  "ใช้ Claude ระดับ Flagship โดยตรง — ฉลาด/สวยสุด",
  "สร้างเครื่องมือ + แชทได้ไม่จำกัด · ไม่กินแต้ม",
  "จ่ายค่า AI ตรงกับ Anthropic ตามจริง — เราไม่คิดค่าบริการเพิ่ม",
  "เหมาะกับนักพัฒนา/ทีมที่มีคีย์อยู่แล้ว",
];

export function ByokCard({ hasKey }: { hasKey: boolean }) {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-indigo-400/40 bg-gradient-to-br from-slate-900 to-indigo-950 p-6 text-slate-100 shadow-lg">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-200 ring-1 ring-inset ring-indigo-400/40">
              <KeyIcon className="h-3.5 w-3.5" /> ขั้นสูง
            </span>
            <h2 className="text-lg font-bold text-white">ใช้คีย์ของคุณเอง (BYO Anthropic Key)</h2>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            มี Anthropic API key อยู่แล้ว? ใส่คีย์ในหน้าตั้งค่า แล้วใช้ Claude ระดับ Flagship โดยตรง —
            ไม่จำกัดการสร้าง ไม่กินแต้มหรือโควตาของแพ็กเกจ และคุณชำระค่า AI กับ Anthropic ตามการใช้จริงเอง
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {BYOK_POINTS.map((p) => (
              <li key={p} className="flex items-start gap-2 text-[13px] text-slate-200">
                <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-indigo-300" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="shrink-0 sm:w-48">
          <p className="text-2xl font-extrabold text-white sm:text-right">
            ฟรีค่าบริการ
            <span className="mt-0.5 block text-xs font-medium text-slate-400">จ่ายค่า AI ตรงกับ Anthropic</span>
          </p>
          <Link
            href="/settings"
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-400"
          >
            {hasKey ? "จัดการคีย์" : "ใส่คีย์ในหน้าตั้งค่า"} →
          </Link>
          {hasKey && (
            <p className="mt-2 text-center text-[12px] font-semibold text-emerald-300">✓ กำลังใช้คีย์ของคุณ</p>
          )}
        </div>
      </div>
    </div>
  );
}
