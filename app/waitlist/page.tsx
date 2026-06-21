import Link from "next/link";
import { ArrowRightIcon, CheckBadgeIcon, ClockIcon } from "@heroicons/react/24/outline";
import { AuthShell, AUTH_CARD } from "@/components/auth/AuthShell";
import { getAccessGate } from "@/lib/beta";
import { getCurrentUser } from "@/lib/projects";

export const metadata = { title: "อยู่ในคิวรอบทดสอบ — EasyGAS IDE" };

export default async function WaitlistPage() {
  const user = await getCurrentUser();
  // If this account is actually approved (reached here by typing the URL, not by the gate),
  // show a "you're in" state with a way into the app instead of the queue message.
  const approved = user ? (await getAccessGate(user.id, user.email)).allowed : false;

  if (approved) {
    return (
      <AuthShell>
        <div className={AUTH_CARD}>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200/70 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/50">
            <CheckBadgeIcon className="h-3.5 w-3.5" />
            ผ่านการลงทะเบียนแล้ว
          </span>

          <h1 className="mt-4 text-2xl font-bold tracking-tight">บัญชีของคุณพร้อมใช้งานแล้ว 🎉</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            คุณได้รับสิทธิ์เข้าร่วมรอบทดสอบเรียบร้อย เริ่มสร้างเครื่องมือ Google Apps Script ตัวแรกของคุณได้เลย
          </p>

          {user?.email && (
            <div className="mt-5 rounded-xl border border-slate-200/80 bg-slate-50/70 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-800/40">
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                เข้าสู่ระบบในชื่อ
              </div>
              <div className="mt-0.5 truncate font-medium text-slate-700 dark:text-slate-200">{user.email}</div>
            </div>
          )}

          <Link
            href="/projects"
            className="group mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(16,185,129,0.35)] transition hover:bg-emerald-400"
          >
            ไปยังโปรเจกต์ของฉัน
            <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className={AUTH_CARD}>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200/70 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800/50">
          <ClockIcon className="h-3.5 w-3.5" />
          อยู่ในคิว
        </span>

        <h1 className="mt-4 text-2xl font-bold tracking-tight">คุณอยู่ในคิวรอบทดสอบแล้ว</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          ตอนนี้ EasyGAS เปิดให้ทดสอบแบบจำกัดจำนวน เพื่อดูแลผู้ใช้รอบแรกได้อย่างใกล้ชิด
          บัญชีของคุณอยู่ในคิวเรียบร้อย — เราจะส่งอีเมลแจ้งทันทีที่ถึงรอบของคุณ
        </p>

        {user?.email && (
          <div className="mt-5 rounded-xl border border-slate-200/80 bg-slate-50/70 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-800/40">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
              บัญชีที่ลงคิวไว้
            </div>
            <div className="mt-0.5 truncate font-medium text-slate-700 dark:text-slate-200">{user.email}</div>
          </div>
        )}
      </div>

      <p className="mt-5 text-center text-xs text-slate-400 dark:text-slate-500">
        ไม่ใช่บัญชีนี้?{" "}
        <Link href="/login" className="font-medium text-emerald-600 underline underline-offset-2 dark:text-emerald-400">
          เข้าด้วยบัญชีอื่น
        </Link>
      </p>
    </AuthShell>
  );
}
