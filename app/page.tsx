import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-4">
        <span className="w-fit rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          Phase 0 · de-risking spike
        </span>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          easygas
        </h1>
        <p className="max-w-xl text-lg text-slate-700 dark:text-slate-300">
          คุยกับ AI เพื่อสร้างเครื่องมือบน <strong>Google Apps Script</strong>{" "}
          พรีวิวสด แล้วกดปุ่ม deploy เข้าบัญชี Google ของคุณเองได้ทันที
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/login"
          className="rounded-lg bg-emerald-500 px-5 py-2.5 font-medium text-emerald-950 transition hover:bg-emerald-400"
        >
          เข้าสู่ระบบ
        </Link>
        <Link
          href="/connect"
          className="rounded-lg border border-slate-300 dark:border-slate-600 px-5 py-2.5 font-medium text-slate-700 dark:text-slate-200 transition hover:border-slate-400"
        >
          เชื่อมต่อ Google
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-5 text-sm text-slate-600 dark:text-slate-400">
        <p className="mb-2 font-semibold text-slate-800 dark:text-slate-200">
          Phase 0 พิสูจน์ critical chain:
        </p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>เข้าสู่ระบบ (Supabase Auth)</li>
          <li>เชื่อมต่อ Google → grant scopes (custom OAuth) → เก็บ refresh token แบบเข้ารหัส</li>
          <li>กด deploy → Apps Script REST API สร้างโปรเจกต์ + push + deploy</li>
          <li>ได้ URL <code>/exec</code> สดบนบัญชี Google ของคุณ</li>
        </ol>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        <Link href="/privacy" className="underline">
          นโยบายความเป็นส่วนตัว
        </Link>
      </p>
    </main>
  );
}
