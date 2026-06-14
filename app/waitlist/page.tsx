import Image from "next/image";
import { ClockIcon } from "@heroicons/react/24/outline";
import { getCurrentUser } from "@/lib/projects";

export const metadata = { title: "อยู่ในคิวรอบทดสอบ — EasyGAS IDE" };

export default async function WaitlistPage() {
  const user = await getCurrentUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <Image src="/icon/android-icon-192x192.png" alt="EasyGAS IDE" width={64} height={64} className="rounded-2xl shadow-sm" />

      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-500 dark:bg-amber-950/40 dark:text-amber-300">
        <ClockIcon className="h-7 w-7" />
      </span>

      <div>
        <h1 className="text-2xl font-bold">ยังไม่เปิดให้ใช้งานทั่วไป</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          ตอนนี้ EasyGAS IDE เปิดทดสอบแบบจำกัดจำนวน — บัญชีของคุณยังไม่อยู่ในรอบนี้
          <br />
          เราจะแจ้งทางอีเมลเมื่อถึงคิวของคุณ ขอบคุณที่สนใจครับ 🙏
        </p>
      </div>

      {user?.email && (
        <p className="rounded-full bg-slate-100 px-4 py-1.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {user.email}
        </p>
      )}

      <div className="flex flex-col items-center gap-1.5">
        <a href="/settings" className="text-sm font-medium text-emerald-600 underline dark:text-emerald-400">
          มี Anthropic API key อยู่แล้ว? ใส่คีย์เองเพื่อเริ่มใช้ทันที →
        </a>
        <a href="/login" className="text-xs text-slate-400 underline dark:text-slate-500">
          เข้าด้วยบัญชีอื่น
        </a>
      </div>
    </main>
  );
}
