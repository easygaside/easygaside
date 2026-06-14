"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const URL_ERR: Record<string, string> = {
  signin_failed: "เข้าสู่ระบบด้วย Google ไม่สำเร็จ ลองใหม่อีกครั้ง",
  bad_state: "การยืนยันความปลอดภัยล้มเหลว ลองใหม่",
  exchange_failed: "แลกเปลี่ยน token กับ Google ไม่สำเร็จ",
  no_refresh_token: "Google ไม่ได้คืน refresh token — ลองใหม่และกดยอมรับสิทธิ์",
  no_id_token: "Google ไม่ได้คืน id token — ลองใหม่",
  store_failed: "บันทึกการเชื่อมต่อไม่สำเร็จ",
  access_denied: "คุณปฏิเสธการให้สิทธิ์",
};

function GoogleG() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const e = new URLSearchParams(window.location.search).get("error");
    if (e) setError(URL_ERR[e] ?? e);
  }, []);

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
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <Image
          src="/icon/android-icon-192x192.png"
          alt="EasyGAS IDE"
          width={64}
          height={64}
          className="rounded-2xl shadow-sm"
        />
        <div>
          <h1 className="text-2xl font-bold">เข้าสู่ระบบ EasyGAS IDE</h1>
          <p className="mt-1 text-sm text-slate-400">
            ใช้บัญชี Google เดียว — เข้าสู่ระบบ แล้วติดตั้งงานขึ้น Google ของคุณได้เลย
          </p>
        </div>
      </div>

      <a
        href="/api/auth/google/start"
        className="flex items-center justify-center gap-3 rounded-lg bg-white px-4 py-2.5 font-medium text-slate-800 shadow-sm transition hover:bg-slate-100"
      >
        <GoogleG />
        เข้าสู่ระบบด้วย Google
      </a>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span className="h-px flex-1 bg-slate-700" />
        หรือใช้อีเมล (สำรอง)
        <span className="h-px flex-1 bg-slate-700" />
      </div>

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
