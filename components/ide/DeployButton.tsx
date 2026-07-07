"use client";

import { useEffect, useState } from "react";
import {
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  RocketLaunchIcon,
} from "@heroicons/react/24/outline";
import { useProjectStore } from "@/store/useProjectStore";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Tooltip } from "@/components/ui/Tooltip";

type Result =
  | { kind: "idle" }
  | { kind: "busy" }
  | {
      kind: "ok";
      execUrl?: string;
      needsTriggerSetup: boolean;
      scriptEditorUrl: string;
      scopesAdded: string[];
      probe?: { ok: boolean; error?: string; authRequired?: boolean; infraError?: boolean };
    }
  | { kind: "enable_api"; enableUrl: string; message: string }
  | { kind: "error"; message: string };

const ERR_MSG: Record<string, string> = {
  NOT_CONNECTED: "ยังไม่ได้เชื่อมต่อ Google — ไปที่หน้า เชื่อมต่อ Google ก่อน",
  NEEDS_REAUTH: "การเชื่อมต่อ Google หมดอายุ — เชื่อมต่อใหม่ที่หน้า /connect",
  GOOGLE_API_ERROR: "Google API ตอบกลับผิดพลาด ลองใหม่อีกครั้ง",
  NO_FILES: "ยังไม่มีไฟล์ให้ deploy — ให้ AI สร้างระบบก่อน",
  UNKNOWN: "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง",
};

// Friendly Thai labels for scopes a redeploy may newly require (owner must re-authorize the script).
const SCOPE_LABELS: Record<string, string> = {
  "https://www.googleapis.com/auth/script.scriptapp": "ตั้งเวลา/แจ้งเตือนอัตโนมัติ",
  "https://www.googleapis.com/auth/script.send_mail": "ส่งอีเมล",
  "https://mail.google.com/": "ส่งอีเมล",
  "https://www.googleapis.com/auth/documents": "สร้างเอกสาร/PDF",
  "https://www.googleapis.com/auth/drive": "จัดการไฟล์ใน Drive",
  "https://www.googleapis.com/auth/drive.file": "ไฟล์ที่แอปสร้าง",
  "https://www.googleapis.com/auth/spreadsheets": "Google Sheets",
};
function scopeLabel(s: string): string {
  return SCOPE_LABELS[s] ?? s.replace("https://www.googleapis.com/auth/", "");
}

export function DeployButton({
  projectId,
  googleConnected = true,
  deployed = false,
  onDeployed,
}: {
  projectId: string;
  googleConnected?: boolean;
  deployed?: boolean;
  onDeployed?: (execUrl: string) => void;
}) {
  const [res, setRes] = useState<Result>({ kind: "idle" });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const actionRequest = useProjectStore((s) => s.actionRequest);
  const clearActionRequest = useProjectStore((s) => s.clearActionRequest);
  const runAgent = useProjectStore((s) => s.runAgent);

  // command palette → "Deploy เข้า Google" (palette only dispatches this when Google is connected)
  useEffect(() => {
    if (actionRequest !== "deploy" || res.kind === "busy") return;
    clearActionRequest();
    setConfirmOpen(true); // confirm first, then deploy
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionRequest]);

  async function deploy() {
    setConfirmOpen(false);
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
          scopesAdded: Array.isArray(data.scopesAdded) ? data.scopesAdded : [],
          probe: data.probe,
        });
        if (data.execUrl) onDeployed?.(data.execUrl); // surface the URL in the persistent bar
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
      {!googleConnected ? (
        <Tooltip label="ต้องเชื่อมบัญชี Google ก่อนถึงจะ deploy ได้" placement="bottom" className="shrink-0">
          <a
            href="/connect"
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-amber-300 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-sm font-semibold text-amber-700 dark:text-amber-300 transition hover:bg-amber-100 sm:px-4"
          >
            <RocketLaunchIcon className="h-4 w-4 shrink-0" />
            <span className="sm:hidden">เชื่อม Google</span>
            <span className="hidden sm:inline">เชื่อม Google ก่อน Deploy</span>
          </a>
        </Tooltip>
      ) : (
        <Tooltip
          label={
            deployed
              ? "โปรเจกต์นี้ deploy แล้ว — แก้โค้ดแล้วกด “deploy ใหม่” ในแถบสถานะด้านล่างเพื่ออัปเดตลิงก์เดิม"
              : undefined
          }
          placement="bottom"
          className="shrink-0"
        >
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={res.kind === "busy" || deployed}
            aria-label={deployed ? "Deploy แล้ว" : undefined}
            className={`flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(16,185,129,0.3)] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 ${
              deployed ? "px-2.5" : "px-3"
            }`}
          >
            {res.kind === "busy" ? (
              <>
                <span className="hidden sm:inline">กำลัง deploy…</span>
                <span className="sm:hidden">กำลัง…</span>
              </>
            ) : deployed ? (
              <>
                <CheckCircleIcon className="h-4 w-4 shrink-0" />
                {/* mobile: just the check; desktop: full label */}
                <span className="hidden sm:inline">Deploy แล้ว</span>
              </>
            ) : (
              <>
                <RocketLaunchIcon className="h-4 w-4 shrink-0" />
                <span className="sm:hidden">Deploy</span>
                <span className="hidden sm:inline">Deploy เข้า Google</span>
              </>
            )}
          </button>
        </Tooltip>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Deploy เข้าบัญชี Google ของคุณ?"
        body={
          <>
            ระบบจะสร้าง/อัปเดตแอปนี้ในบัญชี Google ของคุณเอง แล้วให้ลิงก์ <b>/exec</b> สำหรับเปิดใช้งานจริง
            <br />
            ครั้งแรก Google จะขอให้คุณอนุญาตสิทธิ์ของสคริปต์หนึ่งครั้ง
          </>
        }
        confirmLabel="Deploy เลย"
        onConfirm={deploy}
        onCancel={() => setConfirmOpen(false)}
      />

      {res.kind !== "idle" && res.kind !== "busy" && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl">
            {res.kind === "ok" && (
              <div className="flex flex-col gap-3">
                <CheckCircleIcon className="mx-auto h-10 w-10 text-emerald-500" />
                <h3 className="text-center font-bold">Deploy สำเร็จ! แอปอยู่ในบัญชี Google ของคุณ</h3>
                {res.execUrl && (
                  <a
                    href={res.execUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all rounded-xl bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-center text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100"
                  >
                    เปิดแอปของคุณ <ArrowTopRightOnSquareIcon className="inline h-3 w-3 align-text-bottom" />
                    <br />
                    {res.execUrl}
                  </a>
                )}
                {res.probe &&
                  !res.probe.authRequired &&
                  (res.probe.ok ? (
                    <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-[11px] text-emerald-700 dark:text-emerald-300">
                      ✓ ทดสอบเปิดหน้าแอปอัตโนมัติแล้ว — เปิดได้ (ทดสอบเฉพาะการเปิดหน้า ปุ่ม/การบันทึกยังไม่ได้ทดสอบ)
                    </div>
                  ) : res.probe.infraError ? (
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2 text-[11px] text-slate-500 dark:text-slate-400">
                      ⏳ เปิดหน้ายังไม่ได้/ช้า (อาจเพิ่งเย็นเครื่อง) — ลองเปิดลิงก์เอง หรือกด &ldquo;ทดสอบรันจริง&rdquo; อีกที
                    </div>
                  ) : (
                    <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
                      ⚠️ เปิดแล้วเจอปัญหาตอนรัน: {res.probe.error}
                      <button
                        onClick={() => {
                          setRes({ kind: "idle" });
                          runAgent("verify");
                        }}
                        className="mt-1.5 block w-full rounded-lg bg-amber-500 py-1.5 text-xs font-semibold text-white hover:bg-amber-400"
                      >
                        ให้ AI ทดสอบรันจริง + ซ่อมให้
                      </button>
                    </div>
                  ))}
                <p className="rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  ครั้งแรกที่เปิด Google จะขอให้คุณ (เจ้าของ) อนุญาตสิทธิ์ของสคริปต์ เช่น Sheets/Gmail —
                  กด <b>Review permissions → Advanced → Allow</b> ครั้งเดียว แล้วใช้ได้เลย ·
                  แอปนี้อยู่บนบัญชี Google ของคุณ (ตั้งให้รัน &ldquo;ในนามเจ้าของ&rdquo; — คนอื่นเปิดไม่ต้องขอสิทธิ์ซ้ำ)
                </p>
                {res.needsTriggerSetup && (
                  <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-700 dark:text-amber-300">
                    <ClockIcon className="inline h-4 w-4 align-text-bottom text-amber-600 dark:text-amber-400" /> ระบบนี้มีการแจ้งเตือน/ตั้งเวลา — เปิดสคริปต์แล้วรันฟังก์ชัน{" "}
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
                {res.scopesAdded.length > 0 && (
                  <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-700 dark:text-amber-300">
                    <ExclamationTriangleIcon className="inline h-4 w-4 align-text-bottom text-amber-600 dark:text-amber-400" />{" "}
                    ฟีเจอร์ใหม่ต้องการสิทธิ์เพิ่ม: <b>{res.scopesAdded.map(scopeLabel).join(", ")}</b> — เปิดแอปของคุณ (ลิงก์ด้านบน) หลังอัปเดตนี้ ถ้าแอปขึ้นปุ่ม “กดอนุญาตสิทธิ์” ให้กดครั้งเดียว (Advanced → Allow) แล้วใช้ได้เลย
                  </div>
                )}
                <button
                  onClick={() => setRes({ kind: "idle" })}
                  className="mt-1 rounded-xl border border-slate-200 dark:border-slate-700/60 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                >
                  ปิด
                </button>
              </div>
            )}

            {res.kind === "enable_api" && (
              <div className="flex flex-col gap-3">
                <h3 className="font-bold text-amber-700 dark:text-amber-300">ต้องเปิด Apps Script API ก่อน</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">{res.message}</p>
                <a
                  href={res.enableUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-amber-400 dark:border-amber-700/50 py-2 text-center text-sm text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                >
                  เปิดหน้า usersettings <ArrowTopRightOnSquareIcon className="inline h-3 w-3 align-text-bottom" />
                </a>
                <button
                  onClick={deploy}
                  className="rounded-xl bg-emerald-500 py-2 text-sm font-semibold text-white"
                >
                  เปิดแล้ว — ลองอีกครั้ง
                </button>
                <button onClick={() => setRes({ kind: "idle" })} className="text-sm text-slate-400 dark:text-slate-500 underline">
                  ปิด
                </button>
              </div>
            )}

            {res.kind === "error" && (
              <div className="flex flex-col gap-3">
                <h3 className="font-bold text-red-600 dark:text-red-400">Deploy ไม่สำเร็จ</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">{res.message}</p>
                <button
                  onClick={() => setRes({ kind: "idle" })}
                  className="rounded-xl border border-slate-200 dark:border-slate-700/60 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60"
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
