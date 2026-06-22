"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  RocketLaunchIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { AuthShell, AUTH_CARD } from "@/components/auth/AuthShell";
import { createClient } from "@/lib/supabase/client";
import { submitBetaApplication } from "./actions";

const LAUNCH = "26 มิ.ย. 2569";
const DEADLINE = "25 มิ.ย. 2569";

/** Official multicolor Google "G" for the sign-up button. */
function GoogleG({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.4-11.3-8.1l-6.6 5.1C9.6 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.6l6.3 5.2C41.4 36.3 44 30.7 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  );
}

const FIELD =
  "mt-1.5 w-full rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none ring-1 ring-slate-200 transition focus:bg-white focus:ring-2 focus:ring-emerald-300 dark:bg-slate-800/70 dark:text-slate-100 dark:ring-slate-700 dark:focus:bg-slate-800";
const LABEL = "block text-[13px] font-medium text-slate-600 dark:text-slate-300";

export default function BetaApplyPage() {
  const [email, setEmail] = useState("");
  const [googleVerified, setGoogleVerified] = useState(false);
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [buildIdea, setBuildIdea] = useState("");
  const [techLevel, setTechLevel] = useState("");
  const [device, setDevice] = useState("");
  const [willingFeedback, setWillingFeedback] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // if they came back from Google sign-in, prefill + lock the email and mark it verified
  useEffect(() => {
    const sb = createClient();
    sb.auth.getUser().then(({ data }) => {
      if (data.user?.email) {
        setEmail(data.user.email);
        setGoogleVerified(true);
      }
    });
  }, []);

  async function signInGoogle() {
    const sb = createClient();
    await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/beta` },
    });
  }

  async function submit() {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    const res = await submitBetaApplication({
      email,
      name,
      businessType,
      buildIdea,
      techLevel,
      device,
      willingFeedback,
    });
    if (res.ok) setDone(true);
    else {
      setError(res.error);
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <ThemeToggle className="absolute right-4 top-4 h-9 w-9 rounded-full border border-slate-200 bg-white/70 dark:border-slate-700/60 dark:bg-slate-900/50" />

      {done ? (
        <div className={`${AUTH_CARD} text-center`}>
          <CheckCircleIcon className="mx-auto h-14 w-14 text-emerald-500" />
          <h1 className="mt-3 text-xl font-bold">ได้รับใบสมัครแล้ว 🎉</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            ขอบคุณที่สนใจร่วมทดสอบ EasyGAS — ถ้าคุณได้รับเลือก เราจะส่ง
            <b className="text-slate-700 dark:text-slate-200"> อีเมลแจ้ง</b>ไปที่{" "}
            <b className="text-slate-700 dark:text-slate-200">{email}</b> ก่อนเปิดทดสอบวันที่ {LAUNCH}
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(16,185,129,0.35)] transition hover:bg-emerald-400"
          >
            เสร็จสิ้น
          </Link>
        </div>
      ) : (
        <div className={AUTH_CARD}>
          {/* header */}
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200/70 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/50">
              <UsersIcon className="h-3.5 w-3.5" />
              รับจำนวนจำกัด
            </span>
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
              ปิดรับ {DEADLINE}
            </span>
          </div>

          <h1 className="mt-4 text-[22px] font-bold leading-tight tracking-tight">สมัครเข้าร่วม Closed Beta</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            เราเปิดให้ทดลองใช้รอบจำกัด เพื่อรับฟังความเห็นและพัฒนาให้ตรงงานจริงของคุณ
            หากได้รับเลือก เราจะส่งรายละเอียดให้ทางอีเมลก่อนวันเปิดทดสอบ
          </p>

          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-[13px] text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-300">
            <CalendarDaysIcon className="h-4 w-4 shrink-0" />
            เปิดให้ทดสอบวันที่ <b>{LAUNCH}</b>
          </div>

          {/* identity: Google or email */}
          <div className="mt-5">
            {googleVerified ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-800/60 dark:bg-emerald-950/40">
                <CheckCircleIcon className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">ยืนยันด้วย Google แล้ว</div>
                  <div className="truncate text-[13px] text-emerald-600/90 dark:text-emerald-400/80">{email}</div>
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={signInGoogle}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-100 dark:text-slate-800"
                >
                  <GoogleG className="h-5 w-5" />
                  สมัครด้วย Google
                </button>
                <p className="mt-2.5 text-center text-[12px] text-slate-400 dark:text-slate-500">
                  สมัครด้วยบัญชี Google ที่จะใช้กับ EasyGAS
                </p>
              </>
            )}
          </div>

          {/* screening questions */}
          <div className="mt-4 flex flex-col gap-3.5">
            <div>
              <label htmlFor="b-name" className={LABEL}>ชื่อ (เรียกคุณว่าอะไรดี)</label>
              <input id="b-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น คุณเอ / ร้านกาแฟบ้านสวน" className={FIELD} />
            </div>
            <div>
              <label htmlFor="b-biz" className={LABEL}>ทำธุรกิจ/งานอะไร</label>
              <input id="b-biz" value={businessType} onChange={(e) => setBusinessType(e.target.value)} placeholder="เช่น ร้านตัดผม คลินิก ขายของออนไลน์" className={FIELD} />
            </div>
            <div>
              <label htmlFor="b-idea" className={LABEL}>อยากสร้างเครื่องมืออะไร? <span className="text-emerald-600">*</span></label>
              <textarea id="b-idea" value={buildIdea} onChange={(e) => setBuildIdea(e.target.value)} rows={3} placeholder="เช่น ระบบจองคิว บันทึกลง Google Sheet แล้วส่งอีเมลยืนยันให้ลูกค้า" className={`${FIELD} resize-none leading-relaxed`} />
            </div>
            <div>
              <label htmlFor="b-tech" className={LABEL}>เคยใช้เครื่องมือพวกนี้ระดับไหน</label>
              <select id="b-tech" value={techLevel} onChange={(e) => setTechLevel(e.target.value)} className={FIELD}>
                <option value="">เลือก…</option>
                <option value="none">ไม่เคยเขียนโค้ด/สูตรเลย</option>
                <option value="sheet">เคยใช้สูตร Google Sheet</option>
                <option value="automation">เคยใช้ AppSheet / automation</option>
                <option value="code">เขียนโค้ดได้บ้าง</option>
              </select>
            </div>
            <div>
              <label htmlFor="b-device" className={LABEL}>ใช้ผ่านอะไรเป็นหลัก</label>
              <select id="b-device" value={device} onChange={(e) => setDevice(e.target.value)} className={FIELD}>
                <option value="">เลือก…</option>
                <option value="mobile">มือถือเป็นหลัก</option>
                <option value="computer">คอมพิวเตอร์เป็นหลัก</option>
                <option value="both">ทั้งคู่</option>
              </select>
            </div>
            <label className="flex cursor-pointer items-start gap-2 text-[13px] text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={willingFeedback} onChange={(e) => setWillingFeedback(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-500" />
              ยินดีตอบแบบสอบถามสั้น ๆ หรือให้สัมภาษณ์ เพื่อช่วยเราพัฒนา
            </label>
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-[13px] text-red-700 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300">
              <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={submit}
            disabled={submitting || !googleVerified}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(16,185,129,0.35)] transition hover:bg-emerald-400 disabled:opacity-50"
          >
            <RocketLaunchIcon className="h-5 w-5" />
            {submitting ? "กำลังส่งใบสมัคร…" : googleVerified ? "ส่งใบสมัคร" : "ยืนยันด้วย Google ก่อนส่งใบสมัคร"}
          </button>
          <p className="mt-2.5 text-center text-[11px] text-slate-400 dark:text-slate-500">
            สมัครฟรี · เราใช้อีเมลนี้เพื่อแจ้งผลการคัดเลือกเท่านั้น
          </p>
        </div>
      )}

      <p className="mt-5 text-center text-xs text-slate-400 dark:text-slate-500">
        <Link href="/" className="inline-flex items-center gap-1 font-medium text-slate-500 underline underline-offset-2 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400">
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          กลับหน้าแรก
        </Link>
      </p>
    </AuthShell>
  );
}
