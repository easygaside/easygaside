import Link from "next/link";
import { PlanCard } from "@/components/pricing/PlanCard";
import { getCurrentUser } from "@/lib/projects";
import { PLAN_CONFIG, getUserPlan, type Plan } from "@/lib/plan";

const ORDER: Plan[] = ["free", "lite", "starter", "pro"];

export default async function PricingPage() {
  const user = await getCurrentUser();
  const currentPlan: Plan = user ? await getUserPlan(user.id, user.email) : "free";

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">เลือกแพ็กเกจ easygas</h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          ฟรีใช้ DeepSeek สร้างเครื่องมือได้จริง — อัปเกรดเป็นแพ็กเกจจ่ายเงินเพื่อใช้ <b>GLM</b> (แอปสวย/ฉลาดขึ้น),
          สร้างได้มากขึ้น, แต้มเยอะขึ้น และฟีเจอร์ระดับโปร
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ORDER.map((p) => {
          const c = PLAN_CONFIG[p];
          return (
            <PlanCard
              key={p}
              plan={p}
              label={c.label}
              priceThb={c.priceThb}
              yearlyThb={c.yearlyThb}
              highlights={c.highlights}
              isCurrent={currentPlan === p}
            />
          );
        })}
      </div>

      <p className="mt-8 text-center text-xs text-slate-400 dark:text-slate-500">
        ชำระผ่าน PromptPay แล้วแนบสลิป — ทีมงานยืนยันแล้วเปิดแพ็กเกจให้ · <Link href="/projects" className="underline">กลับไปที่เครื่องมือ</Link>
      </p>
    </main>
  );
}
