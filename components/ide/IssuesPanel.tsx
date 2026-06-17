"use client";

import { ExclamationTriangleIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { useProjectStore } from "@/store/useProjectStore";

const sevBg: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-slate-400",
};

/** Findings from "ให้ AI ตรวจซ้ำ" (Gate 0 lint + Gate 1 critic). Click an item to jump to the file
 *  (its line is marked in the editor); "ให้ AI แก้ให้" routes a repair prompt into the chat flow. */
export function IssuesPanel() {
  const issues = useProjectStore((s) => s.issues);
  const setActive = useProjectStore((s) => s.setActive);
  const clearIssues = useProjectStore((s) => s.clearIssues);
  const runAgent = useProjectStore((s) => s.runAgent);
  const flat = Object.values(issues).flat();
  if (flat.length === 0) return null;

  function fixAll() {
    const lines = flat.map(
      (i) => `- ${i.file}${i.line ? `:${i.line}` : ""} — ${i.problem}${i.fix ? ` (แนวทาง: ${i.fix})` : ""}`,
    );
    runAgent(
      "send",
      "ช่วยแก้จุดที่ตรวจพบต่อไปนี้ให้เรียบร้อยด้วย edit_file/write_file แล้วสรุปสั้น ๆ ว่าแก้อะไรบ้าง:\n" +
        lines.join("\n"),
    );
    clearIssues(); // the fix streams into chat + updates the editor; findings will be stale
  }

  return (
    <div className="flex max-h-44 flex-none flex-col overflow-y-auto border-t border-slate-200/70 dark:border-slate-700/60">
      <div className="sticky top-0 flex items-center gap-2 bg-amber-50/90 px-3 py-1.5 text-[11px] font-semibold text-amber-700 backdrop-blur dark:bg-amber-950/40 dark:text-amber-300">
        <ExclamationTriangleIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">พบ {flat.length} จุดที่ควรแก้ — คลิกเพื่อไปที่ไฟล์</span>
        <span className="flex-1" />
        <button
          onClick={fixAll}
          className="flex shrink-0 items-center gap-1 rounded-md bg-emerald-500 px-2 py-0.5 font-semibold text-white transition hover:bg-emerald-400"
        >
          <SparklesIcon className="h-3 w-3" />
          ให้ AI แก้ให้
        </button>
        <button onClick={clearIssues} className="shrink-0 text-amber-700/70 hover:text-amber-700 dark:text-amber-300/70">
          ล้าง
        </button>
      </div>
      <ul className="flex flex-col gap-1 p-2">
        {flat.map((i, idx) => (
          <li key={idx}>
            <button
              onClick={() => setActive(i.file)}
              className="w-full rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800/60"
            >
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className={`rounded px-1 font-bold uppercase leading-none text-white ${sevBg[i.severity] ?? "bg-amber-500"}`}>
                  {i.severity}
                </span>
                <span className="font-mono text-slate-500 dark:text-slate-400">
                  {i.file}
                  {i.line ? `:${i.line}` : ""}
                </span>
              </div>
              <div className="mt-0.5 text-[12px] leading-snug text-slate-700 dark:text-slate-200">{i.problem}</div>
              {i.fix && <div className="text-[11px] leading-snug text-emerald-700 dark:text-emerald-400">→ {i.fix}</div>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
