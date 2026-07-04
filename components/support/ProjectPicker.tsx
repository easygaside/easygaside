"use client";

import { useEffect, useRef, useState } from "react";
import { FolderIcon } from "@heroicons/react/24/outline";

/**
 * Project-name picker for the customer chat composer — clicking a project
 * inserts its name into the message text so the customer can reference it
 * without typing (replaces the emoji button on the customer side).
 */

interface ProjectPickerProps {
  projects: { id: string; name: string }[];
  onPick: (name: string) => void;
}

export function ProjectPicker({ projects, onPick }: ProjectPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      {open && (
        <div className="absolute bottom-11 left-0 z-10 max-h-48 w-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-800">
          <p className="px-2 pb-1 pt-0.5 text-[10px] font-semibold text-slate-400">
            แทรกชื่อโปรเจกต์ลงในข้อความ
          </p>
          {projects.length === 0 ? (
            <p className="px-2 pb-1.5 text-xs text-slate-400">ยังไม่มีโปรเจกต์</p>
          ) : (
            projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onPick(p.name);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <FolderIcon className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                <span className="truncate">{p.name}</span>
              </button>
            ))
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="แทรกชื่อโปรเจกต์"
        aria-expanded={open}
        className="rounded-xl p-2.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
      >
        <FolderIcon className="h-5 w-5" />
      </button>
    </div>
  );
}
