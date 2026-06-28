"use client";

import { useState } from "react";
import { SparklesIcon } from "@heroicons/react/24/outline";
import { repointProjectModelAction } from "@/app/projects/actions";

const GLM_ARM = "zai";
// arms whose stored history is OpenAI wire format → can re-point to GLM without losing the conversation
const OPENAI_FAMILY = new Set(["deepseek", "deepseek-pro", "chatgpt", "gemini", "zai"]);

/**
 * Inline CTA under the energy bar:
 *  - free user  → upsell to /pricing ("อัปเกรดเป็น GLM")
 *  - paid user on a same-family arm (DeepSeek) → re-point THIS project to GLM in place
 *  - already GLM, or a cross-family (Claude) project → render nothing
 */
export function UpgradeModelButton({
  projectId,
  currentArm,
  isPaid,
}: {
  projectId: string;
  currentArm: string | null;
  isPaid: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);

  if (hidden || currentArm === GLM_ARM) return null;

  if (!isPaid) {
    return (
      <a
        href="/pricing"
        className="mt-2 flex items-center justify-center gap-1.5 rounded-[10px] border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-700 transition hover:bg-amber-100 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-300"
      >
        <SparklesIcon className="h-4 w-4 shrink-0" /> อัปเกรดเป็น GLM — แอปสวย/ฉลาดขึ้น
      </a>
    );
  }

  // paid: only re-point within the same wire family (a Claude project's history can't carry to GLM)
  if (currentArm && !OPENAI_FAMILY.has(currentArm)) return null;

  async function go() {
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
    <button
      onClick={go}
      disabled={busy}
      className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-emerald-300 bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-300"
    >
      <SparklesIcon className="h-4 w-4 shrink-0" />
      {busy ? "กำลังสลับเป็น GLM…" : "ใช้โมเดล Pro (GLM) กับเครื่องมือนี้"}
    </button>
  );
}
