import Link from "next/link";
import { ArrowRightIcon, ClockIcon, KeyIcon } from "@heroicons/react/24/outline";
import { AuthShell, AUTH_CARD } from "@/components/auth/AuthShell";
import { getCurrentUser } from "@/lib/projects";

export const metadata = { title: "อยู่ในคิวรอบทดสอบ — EasyGAS IDE" };

export default async function WaitlistPage() {
  const user = await getCurrentUser();

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

        {/* self-serve shortcut */}
        <Link
          href="/settings"
          className="group mt-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3.5 transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-emerald-600 shadow-sm dark:bg-slate-900 dark:text-emerald-400">
            <KeyIcon className="h-4.5 w-4.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-emerald-800 dark:text-emerald-200">
              มี Anthropic API key อยู่แล้ว?
            </span>
            <span className="block text-[12.5px] text-emerald-700/80 dark:text-emerald-300/70">
              ใส่คีย์ของคุณเองเพื่อข้ามคิวและเริ่มใช้งานได้ทันที
            </span>
          </span>
          <ArrowRightIcon className="h-4 w-4 shrink-0 text-emerald-500 transition group-hover:translate-x-0.5" />
        </Link>
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
