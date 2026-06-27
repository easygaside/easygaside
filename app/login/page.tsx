"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { AuthShell, AUTH_CARD } from "@/components/auth/AuthShell";
import { StepImages } from "@/components/StepImages";

const TR = "https://qimwyprjnlejefeukuuy.supabase.co/storage/v1/object/public/tr";
const CONSENT_STEPS = [
  { src: `${TR}/1.png`, alt: "จอเตือน Google hasn't verified this app — กด Advanced" },
  { src: `${TR}/2.png`, alt: "กด Go to EasyGAS (unsafe)" },
  { src: `${TR}/3-4.png`, alt: "กดอนุญาตสิทธิ์ให้ EasyGAS" },
];

const URL_ERR: Record<string, string> = {
  signin_failed: "เข้าสู่ระบบด้วย Google ไม่สำเร็จ ลองอีกครั้ง",
  bad_state: "การยืนยันความปลอดภัยไม่ผ่าน ลองใหม่อีกครั้ง",
  exchange_failed: "แลกเปลี่ยน token กับ Google ไม่สำเร็จ",
  no_refresh_token: "Google ไม่ได้ส่ง refresh token กลับมา — ลองใหม่และกดอนุญาตสิทธิ์",
  no_id_token: "Google ไม่ได้ส่ง id token กลับมา — ลองใหม่อีกครั้ง",
  invalid_id_token: "ยืนยัน id token จาก Google ไม่ผ่าน — ลองใหม่อีกครั้ง",
  store_failed: "บันทึกการเชื่อมต่อไม่สำเร็จ",
  access_denied: "คุณยกเลิกการให้สิทธิ์",
};

function GoogleG() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const e = new URLSearchParams(window.location.search).get("error");
    if (e) setError(URL_ERR[e] ?? e);
  }, []);

  return (
    <AuthShell>
      <ThemeToggle className="absolute right-4 top-4 h-9 w-9 rounded-full border border-slate-200 bg-white/70 dark:border-slate-700/60 dark:bg-slate-900/50" />

      <div className={AUTH_CARD}>
        <h1 className="text-2xl font-bold tracking-tight">เข้าสู่ระบบ</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          ใช้บัญชี Google เดียวจบ — เข้าสู่ระบบแล้วเริ่มสร้างเครื่องมือ พร้อมติดตั้งขึ้นบัญชี Google ของคุณได้ทันที
        </p>

        <label className="mt-6 flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-500"
          />
          <span className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
            ฉันยอมรับ{" "}
            <Link href="/terms" target="_blank" className="font-medium text-emerald-600 underline underline-offset-2 dark:text-emerald-400">
              เงื่อนไขการใช้งาน
            </Link>{" "}
            และ{" "}
            <Link href="/privacy" target="_blank" className="font-medium text-emerald-600 underline underline-offset-2 dark:text-emerald-400">
              นโยบายความเป็นส่วนตัว
            </Link>
          </span>
        </label>

        {accepted ? (
          <a
            href="/api/auth/google/start"
            className="mt-5 flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-100 dark:text-slate-800"
          >
            <GoogleG />
            เข้าสู่ระบบด้วย Google
          </a>
        ) : (
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="กรุณายอมรับเงื่อนไขก่อน"
            className="mt-5 flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-400 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-500"
          >
            <GoogleG />
            เข้าสู่ระบบด้วย Google
          </button>
        )}

        {!accepted && (
          <p className="mt-2.5 text-center text-xs text-slate-400 dark:text-slate-500">
            กดยอมรับเงื่อนไขด้านบนก่อน จึงจะเข้าสู่ระบบได้
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-center text-[13px] text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        {/* unverified-app note — same as connect page */}
        <details className="group mt-5 rounded-xl border border-slate-200/70 bg-slate-50/50 px-3.5 py-2.5 text-[13px] dark:border-slate-800 dark:bg-slate-800/20">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-slate-500 dark:text-slate-400">
            <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />
            จะเห็นจอเตือน “Google hasn't verified this app” — ปกติของช่วงเบต้า
            <span className="ml-auto text-slate-400 transition group-open:rotate-180">⌄</span>
          </summary>
          <p className="mt-2 leading-relaxed text-slate-500 dark:text-slate-400">
            แอปยังไม่ผ่าน Google verification (อยู่ระหว่างเบต้า) — ที่จอเตือนให้กด{" "}
            <strong className="text-slate-700 dark:text-slate-200">Advanced</strong> →{" "}
            <strong className="text-slate-700 dark:text-slate-200">Go to EasyGAS (unsafe)</strong>{" "}
            เพื่อดำเนินการต่อ ไม่กระทบความปลอดภัยของบัญชีคุณ
          </p>
          <StepImages images={CONSENT_STEPS} />
        </details>
      </div>
    </AuthShell>
  );
}
