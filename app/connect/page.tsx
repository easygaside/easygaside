import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  CodeBracketSquareIcon,
  ExclamationTriangleIcon,
  FolderIcon,
  LockClosedIcon,
  ServerStackIcon,
} from "@heroicons/react/24/outline";
import { AppsScriptEnableNotice } from "@/components/AppsScriptEnableNotice";
import { getAppsScriptReadiness, getConnectionStatus } from "@/lib/google-connection";
import { createClient } from "@/lib/supabase/server";

const ERROR_MESSAGES: Record<string, string> = {
  bad_state: "การยืนยันความปลอดภัยล้มเหลว (state ไม่ตรง) ลองใหม่อีกครั้ง",
  exchange_failed: "แลกเปลี่ยน token กับ Google ไม่สำเร็จ",
  no_refresh_token: "Google ไม่ได้คืน refresh token — ลองใหม่และกดยอมรับสิทธิ์",
  store_failed: "บันทึกการเชื่อมต่อไม่สำเร็จ",
  access_denied: "คุณปฏิเสธการให้สิทธิ์",
};

/** The official multicolor Google "G" — a recognizable trust mark on the connect button. */
function GoogleG({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.4-11.3-8.1l-6.6 5.1C9.6 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.6l6.3 5.2C41.4 36.3 44 30.7 44 24c0-1.3-.1-2.7-.4-3.5z"
      />
    </svg>
  );
}

/** One requested-permission row — icon + what we get + a plain-language scope limit. */
function Permission({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</div>
        <div className="text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">{detail}</div>
      </div>
    </li>
  );
}

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { connected, status, email } = await getConnectionStatus(user.id);
  const { error } = await searchParams;
  const isConnected = connected && status === "active";
  const accountMismatch =
    isConnected && !!email && !!user.email && email.toLowerCase() !== user.email.toLowerCase();

  // Once connected, probe whether the per-user Apps Script API toggle is on (cached after success).
  const readiness = isConnected ? await getAppsScriptReadiness(user.id) : { state: "not_connected" as const };
  const needsApiEnable =
    readiness.state === "needs_user_enable" || readiness.state === "needs_project_enable";

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-b from-[#eef3fb] to-[#e6ecf7] px-4 py-10 text-slate-800 dark:from-[#0b0f14] dark:to-[#0d1117] dark:text-slate-100">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-slate-200/70 bg-white/85 p-7 shadow-[0_18px_50px_rgba(60,70,110,0.12)] backdrop-blur sm:p-8 dark:border-slate-800 dark:bg-slate-900/85">
          {/* brand */}
          <div className="flex items-center gap-2.5">
            <Image
              src="/icon/android-icon-192x192.png"
              alt="EasyGAS"
              width={36}
              height={36}
              className="rounded-xl"
            />
            <span className="text-sm font-bold tracking-tight">
              Easy<span className="text-emerald-600 dark:text-emerald-400">GAS</span>
            </span>
          </div>

          <h1 className="mt-5 text-[22px] font-bold leading-tight">เชื่อมบัญชี Google ของคุณ</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            EasyGAS จะ push โค้ดและ deploy เครื่องมือเข้า <b className="text-slate-700 dark:text-slate-200">บัญชี Google ของคุณเอง</b> —
            ข้อมูลและไฟล์ทั้งหมดอยู่ในบัญชีคุณ ไม่ได้เก็บไว้ที่เรา
          </p>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300">
              <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{ERROR_MESSAGES[error] ?? `เกิดข้อผิดพลาด: ${error}`}</span>
            </div>
          )}

          {/* what we ask for — transparency builds trust */}
          <div className="mt-5 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/30">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              สิทธิ์ที่ขอเข้าถึง
            </div>
            <ul className="flex flex-col gap-3.5">
              <Permission
                icon={<CodeBracketSquareIcon className="h-5 w-5" />}
                title="Google Apps Script"
                detail="สร้าง แก้ไข และ deploy โปรเจกต์ในบัญชีของคุณ"
              />
              <Permission
                icon={<FolderIcon className="h-5 w-5" />}
                title="Google Drive (เฉพาะไฟล์ที่แอปสร้าง)"
                detail="เห็นเฉพาะไฟล์ที่ EasyGAS สร้างเท่านั้น — ไม่เห็นไฟล์อื่นใน Drive ของคุณ"
              />
            </ul>
          </div>

          {/* reassurance strip */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { icon: <LockClosedIcon className="h-4 w-4" />, label: "ข้อมูลอยู่ในบัญชีคุณ" },
              { icon: <ServerStackIcon className="h-4 w-4" />, label: "เราไม่เก็บข้อมูลคุณ" },
              { icon: <ArrowPathIcon className="h-4 w-4" />, label: "เพิกถอนได้ทุกเมื่อ" },
            ].map((t) => (
              <div
                key={t.label}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200/70 bg-white/60 px-2 py-3 text-center dark:border-slate-800 dark:bg-slate-900/40"
              >
                <span className="text-emerald-600 dark:text-emerald-400">{t.icon}</span>
                <span className="text-[11px] font-medium leading-tight text-slate-500 dark:text-slate-400">
                  {t.label}
                </span>
              </div>
            ))}
          </div>

          {/* action */}
          <div className="mt-6">
            {isConnected ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2.5 rounded-xl border border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-800/60 dark:bg-emerald-950/40">
                  <CheckCircleIcon className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                      เชื่อมต่อกับ Google แล้ว
                    </div>
                    {email && (
                      <div className="truncate text-[13px] text-emerald-600/90 dark:text-emerald-400/80">
                        {email}
                      </div>
                    )}
                  </div>
                </div>
                {accountMismatch && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[12px] leading-relaxed text-amber-700 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
                    <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      คุณเข้าสู่ระบบเป็น <b>{user.email}</b> แต่กำลัง deploy ไปบัญชี <b>{email}</b> —
                      งานจะถูกสร้างในบัญชีที่เชื่อมนี้ ถ้าไม่ตั้งใจ กด “เชื่อม Google ใหม่” ด้านล่างเพื่อสลับกลับ
                    </span>
                  </div>
                )}
                {needsApiEnable && (
                  <AppsScriptEnableNotice
                    enableUrl={readiness.state === "needs_user_enable" || readiness.state === "needs_project_enable" ? readiness.enableUrl : ""}
                    reloadHref="/connect"
                    projectLevel={readiness.state === "needs_project_enable"}
                  />
                )}
                {readiness.state === "ready" && (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2.5 text-[13px] text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                    <CheckCircleIcon className="h-4 w-4 shrink-0" />
                    Apps Script API พร้อมแล้ว — สร้างและ deploy ได้เลย
                  </div>
                )}
                <Link
                  href="/connect/done"
                  className="flex w-full items-center justify-center rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(16,185,129,0.35)] transition hover:bg-emerald-400"
                >
                  ไปทดสอบ deploy →
                </Link>
                {/* re-grant path: switching Google account or swapping the OAuth client leaves a stale
                    token here — this forces a fresh consent (prompt=consent) and upserts a new token. */}
                <a
                  href="/api/auth/google/start"
                  className="text-center text-[13px] text-slate-500 underline-offset-2 transition hover:text-emerald-600 hover:underline dark:text-slate-400 dark:hover:text-emerald-400"
                >
                  เชื่อม Google ใหม่ (สลับบัญชี / เปลี่ยน client)
                </a>
              </div>
            ) : (
              <a
                href="/api/auth/google/start"
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:shadow-md dark:border-slate-600 dark:bg-slate-100 dark:text-slate-800"
              >
                <GoogleG className="h-5 w-5" />
                {status === "needs_reauth" ? "เชื่อมต่อ Google อีกครั้ง" : "ดำเนินการต่อด้วย Google"}
              </a>
            )}
          </div>

          {/* unverified-app note — calm, low-emphasis (it's expected during beta) */}
          <details className="group mt-5 rounded-xl border border-slate-200/70 bg-slate-50/50 px-3.5 py-2.5 text-[13px] dark:border-slate-800 dark:bg-slate-800/20">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-slate-500 dark:text-slate-400">
              <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />
              จะเห็นจอเตือน “Google hasn’t verified this app” — ปกติของช่วงเบต้า
              <span className="ml-auto text-slate-400 transition group-open:rotate-180">⌄</span>
            </summary>
            <p className="mt-2 leading-relaxed text-slate-500 dark:text-slate-400">
              แอปยังไม่ผ่าน Google verification (อยู่ระหว่างเบต้า) — ที่จอเตือนให้กด{" "}
              <strong className="text-slate-700 dark:text-slate-200">Advanced</strong> →{" "}
              <strong className="text-slate-700 dark:text-slate-200">Go to EasyGAS (unsafe)</strong>{" "}
              เพื่อดำเนินการต่อ ไม่กระทบความปลอดภัยของบัญชีคุณ
            </p>
          </details>
        </div>

        <p className="mt-4 text-center text-[12px] text-slate-400 dark:text-slate-500">
          เชื่อมต่ออย่างปลอดภัยผ่าน Google OAuth · เพิกถอนสิทธิ์ได้ที่{" "}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            บัญชี Google
          </a>{" "}
          ทุกเมื่อ
        </p>
      </div>
    </main>
  );
}
