import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BoltIcon,
  CheckBadgeIcon,
  RocketLaunchIcon,
  SparklesIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import { getCurrentUser } from "@/lib/projects";

export const metadata = {
  title: "EasyGAS — สร้างเครื่องมือบน Google Apps Script ด้วย AI",
  description:
    "คุยกับ AI เพื่อสร้างเครื่องมือบน Google Apps Script พรีวิวสด ทดสอบให้รันจริงก่อน แล้วกดเดียว deploy เข้าบัญชี Google ของคุณเอง — สำหรับร้านค้า/ธุรกิจไทยที่ไม่ต้องเขียนโค้ด",
};

const FEATURES = [
  {
    icon: SparklesIcon,
    title: "บอก AI ว่าอยากได้อะไร",
    body: "พิมพ์เป็นภาษาคนว่าอยากได้ระบบอะไร — ฟอร์มจองคิว, ตัดสต๊อก, ส่งอีเมลอัตโนมัติ — AI เขียนโค้ดให้",
  },
  {
    icon: CheckBadgeIcon,
    title: "ทดสอบให้รันจริงก่อน",
    body: "ไม่ใช่แค่เดาโค้ดแล้วโยนให้ไปแก้เอง — เราตรวจและซ่อมให้รันได้จริงก่อนส่งถึงมือคุณ",
  },
  {
    icon: RocketLaunchIcon,
    title: "deploy เข้าบัญชีคุณเอง",
    body: "กดเดียวติดตั้งขึ้น Google ของคุณ ได้ลิงก์ใช้งานจริงทันที — โค้ดและข้อมูลเป็นของคุณ 100%",
  },
];

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect("/projects"); // returning users go straight to work

  return (
    <main className="min-h-screen bg-[#eef2f8] text-slate-800 dark:bg-[#0b0f14] dark:text-slate-100">
      <header className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-4">
        <span className="text-lg font-bold tracking-tight">
          Easy<span className="text-emerald-600 dark:text-emerald-400">GAS</span>
        </span>
        <span className="flex-1" />
        <Link
          href="/beta"
          className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(16,185,129,0.3)] transition hover:bg-emerald-400"
        >
          สมัคร Beta
        </Link>
        <Link
          href="/login"
          className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-white/70 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          เข้าสู่ระบบ
        </Link>
      </header>

      {/* hero */}
      <section className="mx-auto max-w-3xl px-5 pb-12 pt-10 text-center sm:pt-16">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          <BoltIcon className="h-3.5 w-3.5" /> สำหรับร้านค้า/ธุรกิจไทย ไม่ต้องเขียนโค้ด
        </span>
        <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          สร้างเครื่องมือบน <span className="text-emerald-600 dark:text-emerald-400">Google Apps Script</span> ด้วยการพิมพ์คุยกับ AI
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600 dark:text-slate-300">
          พรีวิวสด ทดสอบให้รันจริงก่อน แล้วกดเดียว deploy เข้าบัญชี Google ของคุณเอง
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/beta"
            className="rounded-2xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(16,185,129,0.35)] transition hover:bg-emerald-400"
          >
            สมัครเข้าร่วม Close Beta →
          </Link>
          <Link
            href="/styleshopping"
            className="flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <Squares2X2Icon className="h-4 w-4" /> เลือกสไตล์ให้เว็บคุณ
          </Link>
        </div>
        <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
          เปิดให้ทดสอบ <b className="text-slate-500 dark:text-slate-400">25 มิ.ย. 2569</b> · รับจำนวนจำกัด หากได้รับเลือกมีอีเมลแจ้ง
        </p>
      </section>

      {/* features */}
      <section className="mx-auto grid max-w-5xl gap-4 px-5 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <f.icon className="h-5 w-5" />
            </span>
            <h3 className="mt-3 font-bold">{f.title}</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">{f.body}</p>
          </div>
        ))}
      </section>

      {/* style lab band */}
      <section className="mx-auto mt-10 max-w-5xl px-5">
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-emerald-200/60 bg-gradient-to-br from-white to-emerald-50/50 p-7 text-center shadow-sm dark:border-emerald-900/50 dark:from-slate-900 dark:to-emerald-950/30 sm:flex-row sm:text-left">
          <Squares2X2Icon className="h-9 w-9 shrink-0 text-emerald-500" />
          <div className="flex-1">
            <h3 className="font-bold">ยังไม่รู้ว่าอยากได้หน้าตาแบบไหน?</h3>
            <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
              เดินเลือกองค์ประกอบ — เมนู ปุ่ม ป๊อปอัป ตาราง พร้อมเพย์ — กดดูตัวอย่างได้ แล้วรวมเป็นคำสั่งให้ AI สร้างให้
            </p>
          </div>
          <Link
            href="/styleshopping"
            className="shrink-0 rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
          >
            ลองเลือกสไตล์
          </Link>
        </div>
      </section>

      {/* community teaser (Showcase = BUILDPLAN §K, v2) */}
      <section className="mx-auto mt-6 max-w-5xl px-5">
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white/50 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
          🚧 เร็วๆ นี้: <b className="text-slate-700 dark:text-slate-200">ผลงานยอดนิยมประจำสัปดาห์</b> — ดูเครื่องมือที่คนอื่นสร้าง แล้วกด &ldquo;ต่อยอด&rdquo; เป็นของคุณได้
        </div>
      </section>

      <footer className="mx-auto mt-12 max-w-6xl px-5 pb-10 text-center text-xs text-slate-400 dark:text-slate-500">
        <Link href="/privacy" className="underline hover:text-slate-600 dark:hover:text-slate-300">
          นโยบายความเป็นส่วนตัว
        </Link>
        {" · "}
        <Link href="/terms" className="underline hover:text-slate-600 dark:hover:text-slate-300">
          เงื่อนไขการใช้งาน
        </Link>
      </footer>
    </main>
  );
}
