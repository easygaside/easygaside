import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, BoltIcon } from "@heroicons/react/24/outline";
import { ApiKeyForm } from "@/components/settings/ApiKeyForm";
import { getDailyUsage, hasOwnApiKey } from "@/lib/beta";
import { getCurrentUser } from "@/lib/projects";

export const metadata = { title: "ตั้งค่า — EasyGAS IDE" };

// NOTE: intentionally NOT behind the beta gate — a waitlisted user reaches /settings to add their
// own Anthropic key, which grants them access (BYOK bypasses the allowlist).
export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [usage, hasKey] = await Promise.all([getDailyUsage(user.id), hasOwnApiKey(user.id)]);
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
          โควตาการใช้งาน
        </h2>
        {hasKey ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
            ใช้ Anthropic key ของคุณเอง — <b>ไม่จำกัดโควตา</b>
          </p>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700/60 dark:bg-slate-900">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-300">วันนี้ใช้ไป</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {usage.used} / {usage.limit} ครั้ง
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className={`h-full rounded-full ${pct >= 100 ? "bg-red-400" : pct >= 80 ? "bg-amber-400" : "bg-emerald-400"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
              รีเซ็ตทุกวัน · ใส่ Anthropic key ของคุณด้านล่างเพื่อใช้แบบไม่จำกัด
            </p>
          </div>
        )}
      </section>

      <section className="mt-6">
        <ApiKeyForm hasKey={hasKey} />
      </section>
    </main>
  );
}
