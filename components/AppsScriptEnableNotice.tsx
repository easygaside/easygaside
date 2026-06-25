import { ArrowTopRightOnSquareIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

/**
 * Recovery card for the Apps Script API "enable" wall. Two flavours:
 *  - user toggle (script.google.com/home/usersettings) — what every end user must flip once
 *  - project-level (our Cloud Console) — rare, app-config; shown with a different explanation
 * "ตรวจสอบอีกครั้ง" just reloads the page; the server re-probes Google while the flag is still off.
 */
export function AppsScriptEnableNotice({
  enableUrl,
  reloadHref,
  projectLevel = false,
}: {
  enableUrl: string;
  reloadHref: string;
  projectLevel?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700/60 dark:bg-amber-950/40">
      <div className="flex items-start gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-300">
          <ExclamationTriangleIcon className="h-5 w-5" />
        </span>
        <div>
          <div className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            ต้องเปิด Apps Script API ก่อนถึงจะ deploy ได้
          </div>
          <p className="mt-0.5 text-[13px] leading-relaxed text-amber-800/90 dark:text-amber-200/80">
            {projectLevel
              ? "ระบบยังเปิด Apps Script API ในโปรเจกต์ Google Cloud ไม่ครบ — ปกติผู้ใช้ทั่วไปไม่ต้องทำขั้นนี้ ลองเปิดลิงก์แล้วตรวจสอบอีกครั้ง"
              : "บัญชี Google ของคุณยังไม่ได้เปิดสวิตช์ Apps Script API (ทำครั้งเดียวจบ) — เปิดลิงก์ด้านล่างโดยล็อกอินด้วยบัญชีที่เชื่อมไว้ กดเปิดสวิตช์ แล้วกลับมาตรวจสอบอีกครั้ง"}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-[2.875rem]">
        <a
          href={enableUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-amber-400"
        >
          {projectLevel ? "เปิด Google Cloud Console" : "เปิดสวิตช์ Apps Script API"}
          <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
        </a>
        <a
          href={reloadHref}
          className="rounded-lg border border-amber-300 px-4 py-2 text-[13px] font-medium text-amber-700 transition hover:bg-amber-100 dark:border-amber-700/60 dark:text-amber-200 dark:hover:bg-amber-900/30"
        >
          เปิดแล้ว — ตรวจสอบอีกครั้ง
        </a>
      </div>
    </div>
  );
}
