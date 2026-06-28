import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRightOnRectangleIcon,
  BoltIcon,
  CheckBadgeIcon,
  RocketLaunchIcon,
  SparklesIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import { createServiceClient } from "@/lib/supabase/service";
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
    body: "พิมพ์คุยกับAiว่าอยากได้ระบบอะไร — ฟอร์มจองคิว, ตัดสต๊อก, ส่งอีเมลอัตโนมัติ — AI เขียนโค้ดให้",
  },
  {
    icon: CheckBadgeIcon,
    title: "ทดสอบให้รันจริงก่อน",
    body: "ไม่ใช่แค่เขียนโค้ดแล้วส่งงานให้เลย — เราตรวจและซ่อมให้รันได้จริงก่อนส่งถึงมือคุณ",
  },
  {
    icon: RocketLaunchIcon,
    title: "deploy เข้าบัญชีคุณเอง",
    body: "คลิกเดียวติดตั้งไปยังGoogleของคุณทันที ไม่ต้องDeployให้ยุ่งยาก",
  },
];

async function getSystemStats() {
  const svc = createServiceClient();
  const [{ data: gens }, { data: projs }] = await Promise.all([
    svc.from("egs_generations").select("input_tokens, output_tokens, project_id"),
    svc.from("egs_projects").select("id"),
  ]);

  const totalInTokens = (gens ?? []).reduce((sum, g) => sum + (g.input_tokens || 0), 0);
  const totalOutTokens = (gens ?? []).reduce((sum, g) => sum + (g.output_tokens || 0), 0);
  const totalTokens = totalInTokens + totalOutTokens;

  // Count unique projects that have generations
  const projectsWithGens = new Set((gens ?? []).map((g) => g.project_id).filter(Boolean));
  const totalProjects = projectsWithGens.size || (projs?.length || 0);

  return { totalTokens, totalProjects };
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect("/projects"); // returning users go straight to work

  const stats = await getSystemStats();

  return (
    <main className="min-h-screen bg-[#eef2f8] text-slate-800 dark:bg-[#0b0f14] dark:text-slate-100">
      <header className="mx-auto flex max-w-6xl items-center gap-2 px-5 py-4">
        <Image
          src="/icon/favicon-96x96.png"
          alt="EasyGAS"
          width={28}
          height={28}
          className="h-7 w-7"
          priority
        />
        <span className="text-lg font-bold tracking-tight">
          Easy<span className="text-emerald-600 dark:text-emerald-400">GAS</span>
        </span>
        <span className="flex-1" />
        <Link
          href="/login"
          className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.1a6.6 6.6 0 0 1 0-4.22V7.04H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
            />
          </svg>
          เข้าสู่ระบบ
        </Link>
      </header>

      {/* hero */}
      <section className="mx-auto max-w-3xl px-5 pb-12 pt-10 text-center sm:pt-16">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          <BoltIcon className="h-3.5 w-3.5" /> IDEตัวแรก ที่สร้างมาเพื่อGoogle App Script
        </span>
        <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          สร้างเครื่องมือบน <span className="text-emerald-600 dark:text-emerald-400">Google Apps Script</span> ด้วยการพิมพ์คุยกับ AI
        </h1>
        <div className="mt-7 flex flex-row items-stretch justify-center gap-3">
          <Link
            href="/styleshopping"
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 sm:flex-none"
          >
            <Squares2X2Icon className="h-4 w-4 shrink-0" /> เลือกสไตล์ให้เว็บคุณ
          </Link>
          <Link
            href="/login"
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 sm:flex-none"
          >
            <ArrowRightOnRectangleIcon className="h-4 w-4 shrink-0" /> ลงทะเบียน / เข้าสู่ระบบ
          </Link>
        </div>
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

      {/* live stats banner */}
      <section className="mx-auto max-w-5xl px-5">
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white/80 px-5 py-3 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">ระบบกำลังทำงาน</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-xs text-slate-400 dark:text-slate-500">โทเคนที่ใช้</p>
              <p className="text-lg font-bold text-slate-700 dark:text-slate-200">{formatNumber(stats.totalTokens)}</p>
            </div>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
            <div className="text-center">
              <p className="text-xs text-slate-400 dark:text-slate-500">โปรเจ็ค</p>
              <p className="text-lg font-bold text-slate-700 dark:text-slate-200">{stats.totalProjects}</p>
            </div>
          </div>
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
