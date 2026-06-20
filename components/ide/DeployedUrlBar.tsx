"use client";

import { useEffect, useState } from "react";
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  BoltIcon,
  CheckIcon,
  ClipboardIcon,
} from "@heroicons/react/24/outline";
import { useProjectStore } from "@/store/useProjectStore";
import { Tooltip } from "@/components/ui/Tooltip";

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
  const actionRequest = useProjectStore((s) => s.actionRequest);
  const clearActionRequest = useProjectStore((s) => s.clearActionRequest);

  // command palette → "เปิด /dev" / "deploy ใหม่"
  useEffect(() => {
    if (actionRequest === "openDev") {
      clearActionRequest();
      openDev();
    } else if (actionRequest === "redeploy") {
      clearActionRequest();
      redeploy();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionRequest]);

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
    // Open the tab inside the click gesture (popup blocker), and paint a placeholder right away so the
    // new tab is never a scary bare "about:blank" during the (sometimes slow) first-time scratch push.
    const tab = window.open("", "_blank");
    tab?.document.write(
      "<!doctype html><meta charset='utf-8'><title>กำลังเตรียมพรีวิว…</title>" +
        "<body style='margin:0;font-family:system-ui,sans-serif;display:grid;place-items:center;height:95vh;color:#334155'>" +
        "<div style='text-align:center'><div style='font-size:28px'>⏳</div>" +
        "<p>กำลังเตรียมพรีวิว /dev …</p>" +
        "<p style='font-size:13px;color:#64748b'>ครั้งแรกอาจใช้เวลาสักครู่</p></div></body>",
    );
    // surface the reason IN the tab — calling tab.close() on an error is often blocked by the browser,
    // which left the tab stuck on about:blank with no explanation.
    const fail = (msg: string) => {
      if (tab && !tab.closed)
        tab.document.body.innerHTML =
          "<div style='text-align:center;font-family:system-ui,sans-serif;color:#334155'>" +
          `<div style='font-size:28px'>⚠️</div><p style='color:#b91c1c;max-width:340px;margin:10px auto;line-height:1.5'>${msg}</p>` +
          "<p style='font-size:13px;color:#64748b'>ปิดแท็บนี้ได้เลย</p></div>";
      setNote(msg);
    };
    try {
      const r = await fetch(`/api/preview/${projectId}`, { method: "POST" });
      const data = await r.json();
      if (r.ok && data.devUrl) {
        if (tab) tab.location.href = data.devUrl;
        else window.open(data.devUrl, "_blank");
      } else if (data.error === "USER_SETTINGS_DISABLED") {
        fail("ต้องเปิด Apps Script API ก่อน — ใช้ปุ่ม Deploy ด้านบนเพื่อทำตามขั้นตอนหนึ่งครั้ง");
      } else if (data.error === "NEEDS_REAUTH" || data.error === "NOT_CONNECTED") {
        fail("การเชื่อมต่อ Google หมดอายุ หรือยังไม่ได้เชื่อม — เชื่อมใหม่ที่หน้า เชื่อมบัญชี Google");
      } else if (data.error === "NO_FILES") {
        fail("ยังไม่มีไฟล์ให้พรีวิว — ให้ AI สร้างโค้ดก่อน");
      } else {
        fail(data.message || "เปิด /dev ไม่สำเร็จ — ลองใหม่อีกครั้ง");
      }
    } catch {
      fail("เปิด /dev ไม่สำเร็จ (เครือข่ายขัดข้อง) — ลองใหม่อีกครั้ง");
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
    <div className="flex flex-wrap items-center gap-2.5 border-b border-slate-200 bg-slate-50 px-4 py-1.5 text-[13px] dark:border-slate-800 dark:bg-slate-900/60">
      <span className="flex shrink-0 items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
        <span className="h-[7px] w-[7px] rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(34,197,94,0.18)]" />
        ออนไลน์
      </span>
      {note && (
        <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">· {note}</span>
      )}
      <span className="min-w-0 flex-1" />

      <Tooltip
        label="เปิดดูโค้ดล่าสุด (/dev) โดยไม่ต้อง deploy ใหม่ — ต้องล็อกอิน Google เป็นเจ้าของ"
        placement="bottom"
        className="shrink-0"
      >
        <button
          onClick={openDev}
          disabled={devBusy}
          className={`${ICON_BTN} text-slate-600 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-200`}
        >
          <BoltIcon className={`h-3.5 w-3.5 ${devBusy ? "animate-pulse" : ""}`} />
          {devBusy ? "กำลังเปิด…" : "เปิด /dev"}
        </button>
      </Tooltip>
      <Tooltip label="deploy โค้ดล่าสุดทับเวอร์ชันเดิม (ลิงก์ /exec เดิม)" placement="bottom" className="shrink-0">
        <button
          onClick={redeploy}
          disabled={deployBusy}
          className={`${ICON_BTN} text-slate-600 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-200`}
        >
          <ArrowPathIcon className={`h-3.5 w-3.5 ${deployBusy ? "animate-spin" : ""}`} />
          {deployBusy ? "กำลัง deploy…" : "deploy ใหม่"}
        </button>
      </Tooltip>
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
