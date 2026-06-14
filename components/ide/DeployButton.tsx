"use client";

import { useState } from "react";
import {
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  ClockIcon,
  RocketLaunchIcon,
} from "@heroicons/react/24/outline";

type Result =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "ok"; execUrl?: string; needsTriggerSetup: boolean; scriptEditorUrl: string }
  | { kind: "enable_api"; enableUrl: string; message: string }
  | { kind: "error"; message: string };

const ERR_MSG: Record<string, string> = {
  NOT_CONNECTED: "ยังไม่ได้เชื่อมต่อ Google — ไปที่หน้า เชื่อมต่อ Google ก่อน",
  NEEDS_REAUTH: "การเชื่อมต่อ Google หมดอายุ — เชื่อมต่อใหม่ที่หน้า /connect",
  GOOGLE_API_ERROR: "Google API ตอบกลับผิดพลาด ลองใหม่อีกครั้ง",
  NO_FILES: "ยังไม่มีไฟล์ให้ deploy — ให้ AI สร้างระบบก่อน",
  UNKNOWN: "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง",
};

export function DeployButton({ projectId }: { projectId: string }) {
  const [res, setRes] = useState<Result>({ kind: "idle" });

  async function deploy() {
    setRes({ kind: "busy" });
    try {
      const r = await fetch(`/api/deploy/${projectId}`, { method: "POST" });
      const data = await r.json();
      if (r.ok) {
        setRes({
          kind: "ok",
          execUrl: data.execUrl,
          needsTriggerSetup: !!data.needsTriggerSetup,
          scriptEditorUrl: data.scriptEditorUrl,
        });
      } else if (data.error === "USER_SETTINGS_DISABLED") {
        setRes({ kind: "enable_api", enableUrl: data.enableUrl, message: data.message });
      } else {
        setRes({ kind: "error", message: ERR_MSG[data.error] ?? data.error ?? "เกิดข้อผิดพลาด" });
      }
    } catch {
      setRes({ kind: "error", message: "เชื่อมต่อล้มเหลว" });
    }
  }

  return (
    <>
      <button
        onClick={deploy}
        disabled={res.kind === "busy"}
        className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(16,185,129,0.3)] transition hover:bg-emerald-400 disabled:opacity-50"
      >
        {res.kind === "busy" ? (
          "กำลัง deploy…"
        ) : (
          <>
            <RocketLaunchIcon className="h-4 w-4" />
            Deploy เข้า Google
          </>
        )}
      </button>

      {res.kind !== "idle" && res.kind !== "busy" && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            {res.kind === "ok" && (
              <div className="flex flex-col gap-3">
                <CheckCircleIcon className="mx-auto h-10 w-10 text-emerald-500" />
                <h3 className="text-center font-bold">Deploy สำเร็จ! แอปอยู่ในบัญชี Google ของคุณ</h3>
                {res.execUrl && (
                  <a
                    href={res.execUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all rounded-xl bg-emerald-50 px-3 py-2 text-center text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                  >
                    เปิดแอปของคุณ <ArrowTopRightOnSquareIcon className="inline h-3 w-3 align-text-bottom" />
                    <br />
                    {res.execUrl}
                  </a>
                )}
                {res.needsTriggerSetup && (
                  <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700">
                    <ClockIcon className="inline h-4 w-4 align-text-bottom text-amber-600" /> ระบบนี้มีการแจ้งเตือน/ตั้งเวลา — เปิดสคริปต์แล้วรันฟังก์ชัน{" "}
                    <code>installTriggers()</code> ครั้งเดียวเพื่อเปิดใช้
                    <a
                      href={res.scriptEditorUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-1 underline"
                    >
                      เปิดสคริปต์ <ArrowTopRightOnSquareIcon className="inline h-3 w-3 align-text-bottom" />
                    </a>
                  </div>
                )}
                <button
                  onClick={() => setRes({ kind: "idle" })}
                  className="mt-1 rounded-xl border border-slate-200 py-2 text-sm text-slate-600 hover:bg-slate-50"
                >
                  ปิด
                </button>
              </div>
            )}

            {res.kind === "enable_api" && (
              <div className="flex flex-col gap-3">
                <h3 className="font-bold text-amber-700">ต้องเปิด Apps Script API ก่อน</h3>
                <p className="text-sm text-slate-600">{res.message}</p>
                <a
                  href={res.enableUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-amber-400 py-2 text-center text-sm text-amber-700 hover:bg-amber-50"
                >
                  เปิดหน้า usersettings <ArrowTopRightOnSquareIcon className="inline h-3 w-3 align-text-bottom" />
                </a>
                <button
                  onClick={deploy}
                  className="rounded-xl bg-emerald-500 py-2 text-sm font-semibold text-white"
                >
                  เปิดแล้ว — ลองอีกครั้ง
                </button>
                <button onClick={() => setRes({ kind: "idle" })} className="text-sm text-slate-400 underline">
                  ปิด
                </button>
              </div>
            )}

            {res.kind === "error" && (
              <div className="flex flex-col gap-3">
                <h3 className="font-bold text-red-600">Deploy ไม่สำเร็จ</h3>
                <p className="text-sm text-slate-600">{res.message}</p>
                <button
                  onClick={() => setRes({ kind: "idle" })}
                  className="rounded-xl border border-slate-200 py-2 text-sm text-slate-600 hover:bg-slate-50"
                >
                  ปิด
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
