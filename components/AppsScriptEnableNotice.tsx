import { ArrowTopRightOnSquareIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

/**
 * Reminder shown while a connection is "unverified" (no successful deploy yet). We don't claim the
 * toggle is on or off — Google gives no API to read it — we just prompt the one-time enable and
 * point at a real test deploy, which is the only reliable confirmation. Once a deploy succeeds the
 * flag flips to ready and this disappears.
 */
export function AppsScriptEnableNotice({
  enableUrl,
  testHref,
}: {
  enableUrl: string;
  testHref?: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700/60 dark:bg-amber-950/40">
      <div className="flex items-start gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-300">
          <ExclamationTriangleIcon className="h-5 w-5" />
        </span>
        <div>
          <div className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            เปิด Apps Script API ก่อน deploy ครั้งแรก
          </div>
          <p className="mt-0.5 text-[13px] leading-relaxed text-amber-800/90 dark:text-amber-200/80">
            บัญชี Google ของคุณต้องเปิดสวิตช์ Apps Script API หนึ่งครั้ง ระบบถึงจะติดตั้ง (deploy)
            เครื่องมือขึ้นบัญชีของคุณได้ — เปิดสวิตช์ที่ลิงก์ด้านล่าง (ล็อกอินด้วยบัญชีที่เชื่อมไว้)
            แล้วกดทดสอบ deploy เพื่อยืนยัน ระบบจะจำให้อัตโนมัติเมื่อสำเร็จ
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:pl-[2.875rem]">
        <a
          href={enableUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-amber-400"
        >
          เปิดสวิตช์ Apps Script API
          <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
        </a>
        {testHref && (
          <a
            href={testHref}
            className="rounded-lg border border-amber-300 px-4 py-2 text-[13px] font-medium text-amber-700 transition hover:bg-amber-100 dark:border-amber-700/60 dark:text-amber-200 dark:hover:bg-amber-900/30"
          >
            ทดสอบ deploy เพื่อยืนยัน →
          </a>
        )}
      </div>
    </div>
  );
}
