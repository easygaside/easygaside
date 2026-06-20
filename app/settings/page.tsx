import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, ArrowRightOnRectangleIcon, BoltIcon } from "@heroicons/react/24/outline";
import { ApiKeyForm } from "@/components/settings/ApiKeyForm";
import { signOutAction } from "@/app/auth-actions";
import { getMonthlyToolUsage, hasOwnApiKey } from "@/lib/beta";
import { getCurrentUser } from "@/lib/projects";

export const metadata = { title: "ตั้งค่า — EasyGAS IDE" };

// NOTE: intentionally NOT behind the beta gate — a waitlisted user reaches /settings to add their
// own Anthropic key, which grants them access (BYOK bypasses the allowlist).
export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [usage, hasKey] = await Promise.all([getMonthlyToolUsage(user.id), hasOwnApiKey(user.id)]);
  const pct = Math.min(100, Math.round((usage.used / Math.max(1, usage.limit)) * 100));

  return (
    <main className="mx-auto min-h-screen max-w-lg px-6 py-10">
      <Link
        href="/projects"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        กลับไปหน้าโปรเจกต์
      </Link>

      <h1 className="text-2xl font-bold">ตั้งค่า</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{user.email}</p>

      <section className="mt-6">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <BoltIcon className="h-4 w-4 text-emerald-500" />
          โควตาการสร้าง
          <span className="ml-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            แผน Free
          </span>
        </h2>
        {hasKey ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
            ใช้ Anthropic key ของคุณเอง — <b>สร้างได้ไม่จำกัด</b>
          </p>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700/60 dark:bg-slate-900">
            <div className="flex items-end justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-300">เหลือสร้างใหม่เดือนนี้</span>
              <span className="text-2xl font-bold leading-none text-slate-800 dark:text-slate-100">
                {usage.remaining}
                <span className="ml-1 text-sm font-medium text-slate-400">ตัว</span>
              </span>
            </div>
            <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className={`h-full rounded-full ${pct >= 100 ? "bg-red-400" : pct >= 80 ? "bg-amber-400" : "bg-emerald-400"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
              เดือนนี้สร้างไป {usage.used} จาก {usage.limit} · รีเซ็ตต้นเดือน · แก้/ปรับเครื่องมือเดิม
              <b className="font-medium">ไม่กินสิทธิ์สร้างใหม่</b>
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              อยากสร้างได้มากขึ้น — อัปเกรดแพ็กเกจ หรือใส่ Anthropic key ของคุณด้านล่างเพื่อสร้างไม่จำกัด
            </p>
          </div>
        )}
      </section>

      <section className="mt-6">
        <ApiKeyForm hasKey={hasKey} />
      </section>

      <section className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-800">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">บัญชี</p>
            <p className="truncate text-xs text-slate-400 dark:text-slate-500">{user.email}</p>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-red-700/60 dark:hover:bg-red-950/40 dark:hover:text-red-400"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
              ออกจากระบบ
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
