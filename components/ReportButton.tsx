"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircleIcon, MegaphoneIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { submitReportAction } from "@/app/report/actions";

const KINDS = [
  { value: "bug", label: "บั๊ก / พัง" },
  { value: "idea", label: "ข้อเสนอแนะ" },
  { value: "other", label: "อื่น ๆ" },
];

/** Problem-report button + modal. Auto-attaches project id (if given) + current URL + the user. */
export function ReportButton({ projectId, className = "" }: { projectId?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("bug");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setKind("bug");
    setMessage("");
    setDone(false);
    setError(null);
    setBusy(false);
  }

  async function submit() {
    if (!message.trim() || busy) return;
    setBusy(true);
    setError(null);
    const r = await submitReportAction({
      message,
      kind,
      projectId: projectId ?? null,
      url: typeof window !== "undefined" ? window.location.href : "",
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.error ?? "ส่งไม่สำเร็จ");
      return;
    }
    setDone(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="แจ้งปัญหา / ข้อเสนอแนะ"
        className={`flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:border-emerald-300 hover:text-emerald-600 dark:border-slate-700/60 dark:bg-slate-900/50 dark:text-slate-400 dark:hover:border-emerald-700 dark:hover:text-emerald-400 ${className}`}
      >
        <MegaphoneIcon className="h-4 w-4" />
        <span className="hidden sm:inline">แจ้งปัญหา</span>
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm"
            onClick={() => !busy && close()}
          >
            <div
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900"
              onClick={(e) => e.stopPropagation()}
            >
              {done ? (
                <div className="flex flex-col items-center gap-3 py-2 text-center">
                  <CheckCircleIcon className="h-12 w-12 text-emerald-500" />
                  <h3 className="font-bold text-slate-800 dark:text-slate-100">ส่งแล้ว ขอบคุณมากครับ 🙏</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    เราได้รับรายงานของคุณแล้ว และจะรีบดูให้เร็วที่สุด
                  </p>
                  <button
                    onClick={close}
                    className="mt-1 rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400"
                  >
                    เรียบร้อย
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <MegaphoneIcon className="h-5 w-5 text-emerald-500" />
                    <b className="text-sm text-slate-800 dark:text-slate-100">แจ้งปัญหา / ข้อเสนอแนะ</b>
                    <span className="flex-1" />
                    <button
                      onClick={close}
                      aria-label="ปิด"
                      className="text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="mt-3 flex gap-1.5">
                    {KINDS.map((k) => (
                      <button
                        key={k.value}
                        type="button"
                        onClick={() => setKind(k.value)}
                        className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition ${
                          kind === k.value
                            ? "bg-emerald-500 text-white"
                            : "border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700/60 dark:text-slate-400 dark:hover:bg-slate-800/60"
                        }`}
                      >
                        {k.label}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    maxLength={2000}
                    placeholder="เล่าให้ฟังหน่อยว่าเจออะไร หรืออยากให้ปรับอะไร…"
                    className="mt-3 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-emerald-300 dark:border-slate-700/60 dark:bg-slate-800 dark:text-slate-100"
                  />

                  <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                    แนบหน้าที่กำลังใช้{projectId ? " + โปรเจกต์นี้" : ""} ให้อัตโนมัติ — ไม่ต้องพิมพ์เอง
                  </p>
                  {error && <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{error}</p>}

                  <button
                    onClick={submit}
                    disabled={busy || !message.trim()}
                    className="mt-3 w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {busy ? "กำลังส่ง…" : "ส่งรายงาน"}
                  </button>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
