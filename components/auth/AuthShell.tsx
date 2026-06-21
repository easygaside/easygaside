import type { ReactNode } from "react";
import Image from "next/image";
import { RocketLaunchIcon, ShieldCheckIcon, SparklesIcon } from "@heroicons/react/24/outline";

/** Shared card surface for every auth/gate screen — keeps the three pages visually identical. */
export const AUTH_CARD =
  "rounded-3xl border border-slate-200/70 bg-white/80 p-7 shadow-[0_18px_50px_rgba(60,70,110,0.12)] backdrop-blur-xl sm:p-9 dark:border-slate-800/80 dark:bg-slate-900/70 dark:shadow-[0_18px_60px_rgba(0,0,0,0.45)]";

const VALUE_PROPS = [
  {
    Icon: SparklesIcon,
    title: "คุยกับ AI ที่เข้าใจ Apps Script",
    body: "บอกเป็นภาษาคนว่าอยากได้ระบบอะไร แล้วได้โค้ดที่รันได้จริง พร้อมแก้ต่อเองในเอดิเตอร์",
  },
  {
    Icon: ShieldCheckIcon,
    title: "ทำงานบนบัญชีของคุณเอง",
    body: "สร้างงานลง Sheets, Drive และฟอร์มของคุณโดยตรง ขอสิทธิ์เท่าที่จำเป็น ถอนเมื่อไรก็ได้",
  },
  {
    Icon: RocketLaunchIcon,
    title: "ติดตั้งจริงในคลิกเดียว",
    body: "กดปุ่มเดียวได้เว็บแอปพร้อมใช้บนบัญชี Google ไม่ต้องตั้งค่าเซิร์ฟเวอร์เอง",
  },
];

/**
 * Full-screen split shell for login / waitlist / beta.
 * Large screens: branded story panel (left) + action card (right).
 * Small screens: panel collapses to a compact header above the card.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-gradient-to-b from-[#eef3fb] to-[#e6ecf7] text-slate-800 dark:from-[#0b0f14] dark:to-[#0d1117] dark:text-slate-100">
      {/* atmosphere — same language as /projects */}
      <div className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-emerald-300/25 blur-3xl dark:bg-emerald-500/10" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-violet-300/25 blur-3xl dark:bg-violet-500/10" />

      <div className="relative mx-auto grid min-h-screen w-full max-w-[1500px] lg:grid-cols-[1.05fr_1fr]">
        {/* ── brand story (desktop) ── */}
        <aside className="relative hidden overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-600 p-12 text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:justify-between xl:p-16 dark:from-emerald-700 dark:via-emerald-800 dark:to-teal-900">
          <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-white/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-10 h-80 w-80 rounded-full bg-teal-300/20 blur-3xl" />

          <div className="relative flex items-center gap-3">
            <Image
              src="/icon/android-icon-192x192.png"
              alt="EasyGAS IDE"
              width={44}
              height={44}
              className="rounded-xl shadow-md ring-1 ring-white/30"
            />
            <span className="text-lg font-bold tracking-tight">EasyGAS IDE</span>
          </div>

          <div className="relative max-w-md">
            <h2 className="text-[2.1rem] font-bold leading-[1.15] xl:text-[2.5rem]">
              เปลี่ยนงานซ้ำ ๆ ใน Google
              <br />
              ให้เป็นระบบ ด้วยการพิมพ์บอก
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-emerald-50/90">
              ผู้ช่วยเขียน Google Apps Script ที่ทำงานบนบัญชีของคุณเอง — ไม่ต้องเขียนโค้ดเป็น
              ไม่ต้องดูแลเซิร์ฟเวอร์ บอกสิ่งที่อยากได้ แล้วกดใช้งานได้จริง
            </p>

            <ul className="mt-9 flex flex-col gap-5">
              {VALUE_PROPS.map(({ Icon, title, body }) => (
                <li key={title} className="flex gap-3.5">
                  <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="font-semibold">{title}</div>
                    <div className="mt-0.5 text-[13.5px] leading-relaxed text-emerald-50/80">{body}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <p className="relative text-[12.5px] text-emerald-50/70">
            เชื่อมต่อผ่าน Google OAuth อย่างเป็นทางการ · ข้อมูลของคุณไม่ถูกนำไปใช้ต่อ
          </p>
        </aside>

        {/* ── action card (all sizes) ── */}
        <section className="flex flex-col items-center justify-center px-5 py-10 sm:px-8">
          {/* compact brand for mobile (panel is hidden there) */}
          <div className="mb-7 flex items-center gap-2.5 lg:hidden">
            <Image
              src="/icon/android-icon-192x192.png"
              alt="EasyGAS IDE"
              width={36}
              height={36}
              className="rounded-xl shadow-sm"
            />
            <span className="text-base font-bold tracking-tight text-slate-700 dark:text-slate-200">
              EasyGAS IDE
            </span>
          </div>

          <div className="w-full max-w-md">{children}</div>
        </section>
      </div>
    </main>
  );
}
