"use client";

import { useState } from "react";
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  BoltIcon,
  CheckIcon,
  ClipboardIcon,
  RocketLaunchIcon,
} from "@heroicons/react/24/outline";

/**
 * Persistent bar for a deployed project: open/copy the live /exec URL, plus quick actions —
 * "เปิด /dev" (push current files to a scratch script and open its always-latest /dev preview) and
 * "deploy ใหม่" (re-PATCH the same deployment → same /exec URL). The /exec URL is stable across
 * re-deploys, so it's safe to share once.
 */
export function DeployedUrlBar({ url, projectId }: { url: string; projectId: string }) {
  const [copied, setCopied] = useState(false);
  const [devBusy, setDevBusy] = useState(false);
  const [deployBusy, setDeployBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the open link still works */
    }
  }

  async function openDev() {
    if (devBusy) return;
    setDevBusy(true);
    setNote(null);
    // open the tab inside the click gesture so the popup blocker doesn't eat it; fill it after fetch
    const tab = window.open("", "_blank");
    try {
      const r = await fetch(`/api/preview/${projectId}`, { method: "POST" });
      const data = await r.json();
      if (r.ok && data.devUrl) {
        if (tab) tab.location.href = data.devUrl;
        else window.open(data.devUrl, "_blank");
      } else {
        tab?.close();
        setNote("เปิด /dev ไม่สำเร็จ — ลองใหม่");
      }
    } catch {
      tab?.close();
      setNote("เปิด /dev ไม่สำเร็จ");
    } finally {
      setDevBusy(false);
    }
  }

  async function redeploy() {
    if (deployBusy) return;
    setDeployBusy(true);
    setNote(null);
    try {
      const r = await fetch(`/api/deploy/${projectId}`, { method: "POST" });
      const data = await r.json();
      if (r.ok) setNote("อัปเดตแล้ว ✓ (ลิงก์เดิม)");
      else if (data.error === "USER_SETTINGS_DISABLED")
        setNote("ต้องเปิด Apps Script API ก่อน — ใช้ปุ่ม Deploy ด้านบน");
      else setNote("deploy ไม่สำเร็จ ลองใหม่");
    } catch {
      setNote("deploy ไม่สำเร็จ");
    } finally {
      setDeployBusy(false);
    }
  }

  const ICON_BTN =
    "flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition disabled:opacity-50";

  return (
    <div className="mx-3 mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[13px] dark:border-emerald-800/50 dark:bg-emerald-950/30">
      <RocketLaunchIcon className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <span className="font-medium text-emerald-700 dark:text-emerald-300">แอปของคุณออนไลน์แล้ว</span>
      {note && <span className="text-[11px] text-emerald-700/80 dark:text-emerald-300/70">· {note}</span>}
      <span className="min-w-0 flex-1" />

      <button
        onClick={openDev}
        disabled={devBusy}
        title="เปิดดูโค้ดล่าสุด (/dev) โดยไม่ต้อง deploy ใหม่ — ต้องล็อกอิน Google เป็นเจ้าของ"
        className={`${ICON_BTN} text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-slate-800/50`}
      >
        <BoltIcon className={`h-3.5 w-3.5 ${devBusy ? "animate-pulse" : ""}`} />
        {devBusy ? "กำลังเปิด…" : "เปิด /dev"}
      </button>
      <button
        onClick={redeploy}
        disabled={deployBusy}
        title="deploy โค้ดล่าสุดทับเวอร์ชันเดิม (ลิงก์ /exec เดิม)"
        className={`${ICON_BTN} text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-slate-800/50`}
      >
        <ArrowPathIcon className={`h-3.5 w-3.5 ${deployBusy ? "animate-spin" : ""}`} />
        {deployBusy ? "กำลัง deploy…" : "deploy ใหม่"}
      </button>
      <button
        onClick={copy}
        className={`${ICON_BTN} text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/40`}
      >
        {copied ? <CheckIcon className="h-3.5 w-3.5" /> : <ClipboardIcon className="h-3.5 w-3.5" />}
        {copied ? "คัดลอกแล้ว" : "คัดลอก"}
      </button>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-emerald-400"
      >
        เปิด <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
