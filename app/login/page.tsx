"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const fn =
      mode === "signin"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });
    const { error } = await fn;
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/connect");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <h1 className="text-2xl font-bold">เข้าสู่ระบบ easygas</h1>
      <p className="text-sm text-slate-400">
        ขั้นนี้คือ identity เท่านั้น — การเชื่อมต่อ Google (สำหรับ deploy) แยกอีกขั้น
      </p>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="อีเมล"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 outline-none focus:border-emerald-500"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="รหัสผ่าน (อย่างน้อย 6 ตัว)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 outline-none focus:border-emerald-500"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-emerald-500 px-4 py-2.5 font-medium text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {busy ? "กำลังดำเนินการ…" : mode === "signin" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
        </button>
      </form>

      <button
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="text-sm text-slate-400 underline"
      >
        {mode === "signin" ? "ยังไม่มีบัญชี? สมัครสมาชิก" : "มีบัญชีแล้ว? เข้าสู่ระบบ"}
      </button>
    </main>
  );
}
