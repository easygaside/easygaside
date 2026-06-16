"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  RocketLaunchIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

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
      } else if (data.error === "USER_SETTINGS_DISABLED" || data.error === "PROJECT_API_DISABLED") {
        setResult({ kind: "enable_api", enableUrl: data.enableUrl, message: data.message });
      } else if (data.error === "NEEDS_REAUTH" || data.error === "NOT_CONNECTED") {
        setResult({
          kind: "error",
          message: "การเชื่อมต่อ Google หมดอายุหรือยังไม่ได้เชื่อม — กลับไปเชื่อมต่อใหม่ที่หน้า เชื่อมบัญชี Google",
        });
      } else {
        setResult({
          kind: "error",
          message: `เกิดข้อผิดพลาด: ${data.detail ?? data.message ?? data.error ?? "unknown"}`,
        });
      }
    } catch (e) {
      setResult({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  const busy = result.kind === "busy";

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-b from-[#eef3fb] to-[#e6ecf7] px-4 py-10 text-slate-800 dark:from-[#0b0f14] dark:to-[#0d1117] dark:text-slate-100">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-slate-200/70 bg-white/85 p-7 shadow-[0_18px_50px_rgba(60,70,110,0.12)] backdrop-blur sm:p-8 dark:border-slate-800 dark:bg-slate-900/85">
          {/* brand */}
          <div className="flex items-center gap-2.5">
            <Image
              src="/icon/android-icon-192x192.png"
              alt="EasyGAS"
              width={36}
              height={36}
              className="rounded-xl"
            />
            <span className="text-sm font-bold tracking-tight">
              Easy<span className="text-emerald-600 dark:text-emerald-400">GAS</span>
            </span>
          </div>

          <h1 className="mt-5 text-[22px] font-bold leading-tight">ทดสอบความพร้อมระบบ</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            กดปุ่มเพื่อให้ระบบลองสร้างเครื่องมือทดสอบเล็กๆ แล้ว deploy เข้า{" "}
            <b className="text-slate-700 dark:text-slate-200">บัญชี Google ของคุณ</b> หนึ่งครั้ง —
            เพื่อยืนยันว่าทุกอย่างพร้อมสำหรับสร้างงานจริง
          </p>

          {/* primary action */}
          <button
            onClick={deploy}
            disabled={busy}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(16,185,129,0.35)] transition hover:bg-emerald-400 disabled:opacity-50"
          >
            {busy ? (
              "กำลังทดสอบ deploy…"
            ) : (
              <>
                <RocketLaunchIcon className="h-5 w-5" />
                เริ่มทดสอบ Deploy
              </>
            )}
          </button>

          {result.kind === "ok" && (
            <div className="mt-4 flex flex-col gap-2.5 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800/60 dark:bg-emerald-950/40">
              <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                <CheckCircleIcon className="h-5 w-5" />
                สำเร็จ! ระบบพร้อมใช้งานจริง
              </p>
              <a
                href={`https://drive.google.com/open?id=${result.scriptId}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 break-all text-[13px] font-medium text-emerald-700 underline underline-offset-2 dark:text-emerald-300"
              >
                ดูโปรเจกต์ทดสอบใน Drive ของคุณ
                <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5 shrink-0" />
              </a>
              <p className="text-[12px] leading-relaxed text-emerald-700/70 dark:text-emerald-300/60">
                นี่เป็นโปรเจกต์ทดสอบในบัญชีคุณ — ลบทิ้งเมื่อไหร่ก็ได้ที่ Apps Script
              </p>
            </div>
          )}

          {result.kind === "enable_api" && (
            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700/60 dark:bg-amber-950/40">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
                <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
                ต้องเปิด Apps Script API ก่อน
              </p>
              <p className="text-[13px] leading-relaxed text-amber-700/90 dark:text-amber-200/80">
                {result.message}
              </p>
              <a
                href={result.enableUrl}
                target="_blank"
                rel="noreferrer"
                className="flex w-fit items-center gap-1.5 rounded-lg border border-amber-400 bg-white/60 px-4 py-2 text-[13px] font-medium text-amber-700 transition hover:bg-amber-100 dark:bg-transparent dark:text-amber-200 dark:hover:bg-amber-900/30"
              >
                {result.enableUrl.includes("usersettings")
                  ? "เปิดหน้าตั้งค่า Apps Script"
                  : "เปิด Google Cloud Console"}
                <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
              </a>
              <button
                onClick={deploy}
                className="w-fit text-[13px] font-medium text-amber-700 underline underline-offset-2 dark:text-amber-200"
              >
                เปิดแล้ว — ลองอีกครั้ง
              </button>
            </div>
          )}

          {result.kind === "error" && (
            <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-300 bg-red-50 p-4 text-[13px] leading-relaxed text-red-700 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300">
              <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{result.message}</span>
            </div>
          )}

          {/* reassurance */}
          <div className="mt-5 flex items-start gap-2 rounded-xl border border-slate-200/70 bg-slate-50/60 px-3.5 py-3 text-[12px] leading-relaxed text-slate-500 dark:border-slate-800 dark:bg-slate-800/30 dark:text-slate-400">
            <ShieldCheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            การทดสอบนี้สร้างไฟล์ในบัญชี Google ของคุณเองเท่านั้น เราไม่เก็บข้อมูลของคุณ และลบโปรเจกต์ทดสอบได้ทุกเมื่อ
          </div>
        </div>

        <p className="mt-4 text-center text-[12px] text-slate-400 dark:text-slate-500">
          <Link
            href="/projects"
            className="underline underline-offset-2 hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            ข้ามไปเริ่มสร้างโปรเจกต์ →
          </Link>
        </p>
      </div>
    </main>
  );
}
