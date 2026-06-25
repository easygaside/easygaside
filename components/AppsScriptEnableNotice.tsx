import { ArrowTopRightOnSquareIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { StepImages } from "./StepImages";

const TR = "https://qimwyprjnlejefeukuuy.supabase.co/storage/v1/object/public/tr";
const API_STEPS = [
  { src: `${TR}/api1.png`, alt: "เปิดหน้า Apps Script API settings" },
  { src: `${TR}/api2.png`, alt: "กดสวิตช์ Apps Script API ให้เป็น เปิด" },
];

/**
 * Shown while a connection is "unverified" (no successful deploy yet). We don't claim the toggle is
 * on/off — Google gives no API to read it — we walk the user through the one-time enable. A silent
 * background test deploy (AppsScriptAutoVerify) confirms it and flips the card to ready on its own.
 */
export function AppsScriptEnableNotice({ enableUrl }: { enableUrl: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700/60 dark:bg-amber-950/40">
      <div className="flex items-start gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-300">
          <ExclamationTriangleIcon className="h-5 w-5" />
        </span>
        <div>
          <div className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            เปิดสิทธิ์ Apps Script API ก่อนใช้งาน
          </div>
          <p className="mt-0.5 text-[13px] leading-relaxed text-amber-800/90 dark:text-amber-200/80">
            เชื่อมต่อบัญชีแล้ว แต่ยังเหลืออีกหนึ่งขั้นที่ต้องทำเองครั้งเดียว — เปิดสวิตช์ Apps Script API
            ในบัญชี Google ของคุณ ทำตามรูปด้านล่าง: กดปุ่มเพื่อเปิดหน้าตั้งค่า (ล็อกอินด้วยบัญชีที่เชื่อมไว้) →
            กดสวิตช์ให้เป็น “เปิด” แล้วรอสักครู่ ระบบจะตรวจสอบและยืนยันให้อัตโนมัติ
          </p>
        </div>
      </div>

      <a
        href={enableUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-amber-400 sm:ml-[2.875rem]"
      >
        เปิดหน้าตั้งค่า Apps Script API
        <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
      </a>

      <div className="sm:pl-[2.875rem]">
        <StepImages images={API_STEPS} />
      </div>
    </div>
  );
}
