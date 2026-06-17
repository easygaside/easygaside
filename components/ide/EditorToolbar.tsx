"use client";

import { useState } from "react";
import { ArrowPathIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { useProjectStore } from "@/store/useProjectStore";
import { VersionHistory } from "./VersionHistory";

/**
 * Toolbar above the editor: live autosave status + the manual "ให้ AI ตรวจซ้ำ" (Gate-1 critic).
 * Re-check flushes pending edits first so the server reviews the latest code, then paints findings
 * as editor markers / file badges / the issues panel.
 */
export function EditorToolbar({ projectId }: { projectId: string }) {
  const files = useProjectStore((s) => s.files);
  const order = useProjectStore((s) => s.order);
  const issues = useProjectStore((s) => s.issues);
  const markSaved = useProjectStore((s) => s.markSaved);
  const setIssues = useProjectStore((s) => s.setIssues);
  const clearIssues = useProjectStore((s) => s.clearIssues);
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const hasFiles = order.length > 0;
  const dirty = order.some((p) => files[p]?.dirty);
  const issueCount = Object.values(issues).reduce((a, l) => a + l.length, 0);

  async function recheck() {
    if (checking || !hasFiles) return;
    setChecking(true);
    setNote(null);
    try {
      // flush pending edits so the critic reviews the latest code
      const dirtyPaths = order.filter((p) => files[p]?.dirty);
      await Promise.all(
        dirtyPaths.map((p) =>
          fetch(`/api/files/${projectId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: p, content: files[p].content }),
          }),
        ),
      );
      dirtyPaths.forEach(markSaved);

      const res = await fetch(`/api/recheck/${projectId}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || data.error) {
        setIssues([]);
        setNote(res.status === 429 ? "ตรวจถี่เกินไป — รอสักครู่" : "⚠️ ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้งภายหลัง");
      } else {
        const list = data.issues ?? [];
        setIssues(list);
        setNote(list.length === 0 ? "✓ ไม่พบจุดที่ขัดกับกฎระบบ" : null);
      }
    } catch {
      setNote("⚠️ ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้งภายหลัง");
    } finally {
      setChecking(false);
    }
  }

  if (!hasFiles) return null;

  return (
    <div className="flex flex-none items-center gap-2 border-b border-slate-200/70 px-3 py-1.5 dark:border-slate-700/60">
      <span className="flex items-center gap-1 text-[11px] font-medium">
        {dirty ? (
          <span className="text-amber-500">● กำลังบันทึก…</span>
        ) : (
          <span className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
            <CheckCircleIcon className="h-3.5 w-3.5" /> บันทึกอัตโนมัติ
          </span>
        )}
      </span>
      <span className="flex-1" />
      {note && <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">{note}</span>}
      {issueCount > 0 && (
        <button
          onClick={clearIssues}
          className="text-[11px] text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300"
        >
          ล้างผลตรวจ
        </button>
      )}
      <VersionHistory projectId={projectId} />
      <button
        onClick={recheck}
        disabled={checking}
        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
      >
        <ArrowPathIcon className={`h-3.5 w-3.5 ${checking ? "animate-spin" : ""}`} />
        {checking ? "กำลังตรวจ…" : "ให้ AI ตรวจซ้ำ"}
      </button>
    </div>
  );
}
