"use client";

import { useState } from "react";
import { BoltIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { repointProjectModelAction } from "@/app/projects/actions";

const GLM_ARM = "zai";
// arms whose stored history is OpenAI wire format → can re-point to GLM without losing the conversation
const OPENAI_FAMILY = new Set(["deepseek", "deepseek-pro", "chatgpt", "gemini", "zai"]);

/**
 * Compact PACKAGE chip (NOT a banner) — shows the user's plan name, never the underlying AI model.
 * The ✨ hints there's a better tier:
 *  - already on the Flagship arm (GLM) → quiet status chip, no action
 *  - paid + same-family arm            → click re-points THIS project to the Flagship arm in place
 *  - free                              → click → /pricing
 * `lowCredit` (แต้มใกล้หมด) adds a stronger one-line CTA for free users — the high-intent moment.
 */
export function UpgradeModelButton({
  projectId,
  currentArm,
  isPaid,
  planLabel,
  lowCredit = false,
}: {
  projectId: string;
  currentArm: string | null;
  isPaid: boolean;
  planLabel: string;
  lowCredit?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  const arm = currentArm ?? (isPaid ? GLM_ARM : "deepseek-pro");

  // already on the Flagship arm → quiet status chip showing the package name
  if (arm === GLM_ARM) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
        <SparklesIcon className="h-3.5 w-3.5" /> {planLabel}
      </span>
    );
  }

  const paidRepoint = isPaid && (!currentArm || OPENAI_FAMILY.has(arm));

  async function go() {
    if (!paidRepoint) {
      window.location.href = "/pricing";
      return;
    }
    setBusy(true);
    try {
      const r = await repointProjectModelAction(projectId);
      if ("ok" in r) {
        window.location.reload();
        return;
      }
      if (r.error === "not_paid") {
        window.location.href = "/pricing";
        return;
      }
      setHidden(true); // already / wrong_family / not_found → nothing to do
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        onClick={go}
        disabled={busy}
        title={paidRepoint ? "สลับเครื่องมือนี้เป็น AI Flagship (สวย/ฉลาดขึ้น)" : "อัปเกรดเพื่อใช้ AI Flagship"}
        className="group inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500 transition hover:border-amber-300 hover:text-amber-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-amber-300"
      >
        <BoltIcon className="h-3.5 w-3.5" />
        {busy ? "กำลังสลับ…" : planLabel}
        <SparklesIcon className="h-3.5 w-3.5 text-amber-400 transition group-hover:text-amber-500" />
      </button>
      {lowCredit && !isPaid && (
        <a
          href="/pricing"
          className="text-[11px] font-semibold text-amber-600 underline underline-offset-2 dark:text-amber-400"
        >
          แต้มใกล้หมด — อัปเกรดเพิ่มแต้ม + AI สวยขึ้น ✨
        </a>
      )}
    </div>
  );
}
