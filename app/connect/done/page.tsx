"use client";

import { useState } from "react";

type Result =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "ok"; execUrl: string; scriptId: string }
  | { kind: "enable_api"; enableUrl: string; message: string }
  | { kind: "error"; message: string };

export default function ConnectDonePage() {
  const [result, setResult] = useState<Result>({ kind: "idle" });

  async function deploy() {
    setResult({ kind: "busy" });
    try {
      const res = await fetch("/api/deploy/spike", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setResult({ kind: "ok", execUrl: data.execUrl, scriptId: data.scriptId });
      } else if (data.error === "USER_SETTINGS_DISABLED") {
        setResult({ kind: "enable_api", enableUrl: data.enableUrl, message: data.message });
      } else if (data.error === "NEEDS_REAUTH" || data.error === "NOT_CONNECTED") {
        setResult({
          kind: "error",
          message: "การเชื่อมต่อ Google หมดอายุหรือยังไม่ได้เชื่อม — กลับไปหน้า /connect",
        });
      } else {
        setResult({
          kind: "error",
          message: `${data.error}: ${data.detail ?? data.message ?? "unknown"}`,
        });
      }
    } catch (e) {
      setResult({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-6">
      <h1 className="text-2xl font-bold">ทดสอบ deploy (Phase 0 spike)</h1>
      <p className="text-sm text-slate-400">
        กดปุ่มเพื่อสร้างโปรเจกต์ Apps Script + push + deploy เป็น web app บนบัญชี Google ของคุณ
        ผ่าน REST API ทั้งหมด (ไม่ใช้ clasp)
      </p>

      <button
        onClick={deploy}
        disabled={result.kind === "busy"}
        className="w-fit rounded-lg bg-emerald-500 px-5 py-2.5 font-medium text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
      >
        {result.kind === "busy" ? "กำลัง deploy…" : "🚀 Deploy ตัวอย่าง"}
      </button>

      {result.kind === "ok" && (
        <div className="flex flex-col gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4">
          <p className="font-semibold text-emerald-300">✓ สำเร็จ! Chain ทำงานครบ</p>
          <a
            href={result.execUrl}
            target="_blank"
            rel="noreferrer"
            className="break-all text-sm text-emerald-200 underline"
          >
            เปิดแอปของคุณ → {result.execUrl}
          </a>
          <p className="text-xs text-slate-400">scriptId: {result.scriptId}</p>
        </div>
      )}

      {result.kind === "enable_api" && (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="font-semibold text-amber-300">ต้องเปิด Apps Script API ก่อน</p>
          <p className="text-sm text-amber-200/80">{result.message}</p>
          <a
            href={result.enableUrl}
            target="_blank"
            rel="noreferrer"
            className="w-fit rounded-lg border border-amber-400 px-4 py-2 text-sm text-amber-200 hover:bg-amber-500/10"
          >
            เปิดหน้า usersettings ↗
          </a>
          <button onClick={deploy} className="w-fit text-sm text-amber-200 underline">
            เปิดแล้ว — ลองอีกครั้ง
          </button>
        </div>
      )}

      {result.kind === "error" && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          {result.message}
        </div>
      )}
    </main>
  );
}
