import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, ArrowRightOnRectangleIcon, BellIcon, BoltIcon, KeyIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { ApiKeyForm } from "@/components/settings/ApiKeyForm";
import { PushToggle } from "@/components/settings/PushToggle";
import { signOutAction } from "@/app/auth-actions";
import { getMonthlyToolUsage, hasOwnApiKey, isByoActive } from "@/lib/beta";
import { CREDIT_TOKENS, getUserMonthlyEnergyUsed, poolSizeForUser } from "@/lib/energy";
import { BYO_PRICE_THB, PLAN_CONFIG, getUserPlan, isPaidPlan } from "@/lib/plan";
import { getCurrentUser } from "@/lib/projects";

export const metadata = { title: "ตั้งค่า — EasyGAS IDE" };

// NOTE: intentionally NOT behind the beta gate — a waitlisted user reaches /settings to add their
// own Anthropic key, which grants them access (BYOK bypasses the allowlist).
export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [plan, usage, hasKey, byoActive, poolSize, poolUsed] = await Promise.all([
    getUserPlan(user.id, user.email),
    getMonthlyToolUsage(user.id, user.email),
    hasOwnApiKey(user.id),
    isByoActive(user.id),
    poolSizeForUser(user.id, user.email),
    getUserMonthlyEnergyUsed(user.id),
  ]);

  const planLabel = PLAN_CONFIG[plan].label;
  const paid = isPaidPlan(plan);
  const unlimited = byoActive && hasKey; // BYO add-on active + key stored → runs on own key, no limits
  const creditsTotal = Math.floor(poolSize / CREDIT_TOKENS);
  const creditsLeft = Math.max(0, Math.floor((poolSize - poolUsed) / CREDIT_TOKENS));
  const creditPct = Math.min(100, Math.round((poolUsed / Math.max(1, poolSize)) * 100));
  const toolPct = Math.min(100, Math.round((usage.used / Math.max(1, usage.limit)) * 100));

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
          แพ็กเกจของฉัน
          <span
            className={`ml-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
              paid
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
            }`}
          >
            แผน {planLabel}
          </span>
        </h2>

        {unlimited ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
            BYO เปิดอยู่ — ใช้ Anthropic key ของคุณ <b>สร้างได้ไม่จำกัด</b> (ไม่กินแต้ม/โควตาแพ็กเกจ)
          </p>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700/60 dark:bg-slate-900">
              <div className="flex items-end justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-300">แต้มคงเหลือเดือนนี้</span>
                <span className="text-2xl font-bold leading-none text-slate-800 dark:text-slate-100">
                  {creditsLeft}
                  <span className="ml-1 text-sm font-medium text-slate-400">/ {creditsTotal} แต้ม</span>
                </span>
              </div>
              <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={`h-full rounded-full ${creditPct >= 100 ? "bg-red-400" : creditPct >= 80 ? "bg-amber-400" : "bg-emerald-400"}`}
                  style={{ width: `${creditPct}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                1 แต้ม ≈ การคุยกับ AI สั้น ๆ · ใช้ร่วมกันได้ทุกโปรเจกต์ · รีเซ็ตต้นเดือน
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700/60 dark:bg-slate-900">
              <div className="flex items-end justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-300">เหลือสร้างเครื่องมือใหม่</span>
                <span className="text-2xl font-bold leading-none text-slate-800 dark:text-slate-100">
                  {usage.remaining}
                  <span className="ml-1 text-sm font-medium text-slate-400">/ {usage.limit} ตัว</span>
                </span>
              </div>
              <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={`h-full rounded-full ${toolPct >= 100 ? "bg-red-400" : toolPct >= 80 ? "bg-amber-400" : "bg-emerald-400"}`}
                  style={{ width: `${toolPct}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                เดือนนี้สร้างไป {usage.used} จาก {usage.limit} · แก้/ปรับเครื่องมือเดิม
                <b className="font-medium">ไม่กินสิทธิ์สร้างใหม่</b>
              </p>
            </div>

            {!paid && (
              <Link
                href="/pricing"
                className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-emerald-400 hover:to-teal-400"
              >
                <SparklesIcon className="h-4 w-4" />
                อัปเกรดแพ็กเกจ — แต้มเยอะขึ้น + AI ที่ฉลาด/สวยกว่า
              </Link>
            )}
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <BellIcon className="h-4 w-4 text-emerald-500" />
          การแจ้งเตือน
        </h2>
        <PushToggle />
      </section>

      <section className="mt-6">
        {byoActive ? (
          <ApiKeyForm hasKey={hasKey} />
        ) : (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <KeyIcon className="h-4 w-4 text-indigo-500" />
              ใช้ Anthropic (Claude) key ของคุณเอง — BYO
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              สมัคร BYO (฿{BYO_PRICE_THB}/เดือน) แล้วใส่คีย์ของคุณ เพื่อใช้ Claude ระดับ Flagship แบบ
              <b>ไม่จำกัด · ไม่กินแต้ม</b> — จ่ายค่า AI กับ Anthropic ตามจริงเอง
            </p>
            <Link
              href="/pricing"
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400"
            >
              <SparklesIcon className="h-4 w-4" />
              อัปเกรดเป็น BYO ฿{BYO_PRICE_THB}/เดือน →
            </Link>
          </div>
        )}
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
