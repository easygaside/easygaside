"use client";

import { useEffect, useState } from "react";
import { ArrowPathIcon, BeakerIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { useProjectStore } from "@/store/useProjectStore";
import { saveDirtyFiles } from "@/lib/client/save-files";
import { Tooltip } from "@/components/ui/Tooltip";
import { VersionHistory } from "./VersionHistory";

/**
 * Toolbar above the editor: autosave status + the three quality gates within reach —
 * ประวัติ (versions), ทดสอบรันจริง (Gate 2 run-and-repair, routed to the chat flow), and
 * ให้ AI ตรวจซ้ำ (Gate 0 lint + Gate 1 rulebook critic → markers/badges/issues panel).
 */
export function EditorToolbar({ projectId }: { projectId: string }) {
  const files = useProjectStore((s) => s.files);
  const order = useProjectStore((s) => s.order);
  const setIssues = useProjectStore((s) => s.setIssues);
  const runAgent = useProjectStore((s) => s.runAgent);
  const addEnergy = useProjectStore((s) => s.addEnergy);
  const actionRequest = useProjectStore((s) => s.actionRequest);
  const clearActionRequest = useProjectStore((s) => s.clearActionRequest);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const hasFiles = order.length > 0;
  const dirty = order.some((p) => files[p]?.dirty);

  // command palette → "ให้ AI ตรวจซ้ำ"
  useEffect(() => {
    if (actionRequest !== "recheck" || checking) return;
    clearActionRequest();
    recheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionRequest]);

  // warn before leaving the page while manual edits are unsaved (saving is manual now)
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  async function save() {
    if (saving || !dirty) return;
    setSaving(true);
    try {
      await saveDirtyFiles(projectId);
    } finally {
      setSaving(false);
    }
  }

  async function recheck() {
    if (checking || !hasFiles) return;
    setChecking(true);
    setNote(null);
    try {
      // flush pending edits first so the gates review (and we persist) the latest code
      await saveDirtyFiles(projectId);

      const res = await fetch(`/api/recheck/${projectId}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setIssues([]);
        setNote(
          data?.message ??
            (res.status === 429 ? "ตรวจถี่เกินไป — รอสักครู่" : "⚠️ ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้งภายหลัง"),
        );
        return;
      }
      const list = data.issues ?? [];
      setIssues(list);
      addEnergy(data.tokens ?? 0); // the re-check (critic) spends energy too — deduct from the bar
      if (data.criticError) {
        setNote(
          list.length
            ? "⚠️ ตรวจ rulebook ไม่ได้ชั่วคราว — แสดงผลตรวจโครงสร้างแล้ว"
            : "⚠️ ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้งภายหลัง",
        );
      } else {
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
    <div className="flex flex-none flex-wrap items-center gap-2 border-b border-slate-200/70 px-3 py-1.5 dark:border-slate-700/60">
      <button
        onClick={save}
        disabled={!dirty || saving}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition disabled:cursor-default ${
          dirty
            ? "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/50"
            : "text-slate-400 dark:text-slate-500"
        }`}
      >
        {saving ? (
          <>
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
            กำลังบันทึก…
          </>
        ) : dirty ? (
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            บันทึก
          </>
        ) : (
          <>
            <CheckCircleIcon className="h-3.5 w-3.5" /> บันทึกแล้ว
          </>
        )}
      </button>
      <span className="min-w-0 flex-1" />
      {note && <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">{note}</span>}

      <VersionHistory projectId={projectId} />
      <Tooltip
        label="เปิดแอปจริงเพื่อทดสอบการรัน แล้วซ่อมให้ถ้าเจอปัญหา (ต้อง deploy ก่อน)"
        placement="bottom"
        className="shrink-0"
      >
        <button
          onClick={() => runAgent("verify")}
          className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <BeakerIcon className="h-3.5 w-3.5" />
          ทดสอบรันจริง
        </button>
      </Tooltip>
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
