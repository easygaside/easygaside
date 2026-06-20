"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

/**
 * Lightweight confirm modal (portal + backdrop + Esc-to-cancel). Controlled via `open`.
 * Used to gate side-effectful actions like deploy. Keep copy short; pass `tone` for accent color.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "ยืนยัน",
  cancelLabel = "ยกเลิก",
  tone = "emerald",
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "emerald" | "amber";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const confirmCls =
    tone === "amber"
      ? "bg-amber-500 hover:bg-amber-400"
      : "bg-emerald-500 hover:bg-emerald-400";

  return createPortal(
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={() => !busy && onCancel()}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${
              tone === "amber"
                ? "bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400"
                : "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
            }`}
          >
            <ExclamationTriangleIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h3>
            {body && (
              <div className="mt-1.5 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
                {body}
              </div>
            )}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700/60 dark:text-slate-300 dark:hover:bg-slate-800/60"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50 ${confirmCls}`}
          >
            {busy ? "กำลังทำงาน…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
