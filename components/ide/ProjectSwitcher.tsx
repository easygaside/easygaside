"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronUpDownIcon, FolderIcon, PlusIcon, Squares2X2Icon } from "@heroicons/react/24/outline";
import { Tooltip } from "@/components/ui/Tooltip";

export interface SwitcherProject {
  id: string;
  name: string;
  deployed: boolean;
}

/** Top-bar project switcher — jump between projects, create, or find ideas without leaving the IDE. */
export function ProjectSwitcher({
  currentId,
  currentName,
  projects,
  className = "",
}: {
  currentId: string;
  currentName: string;
  projects: SwitcherProject[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const others = projects.filter((p) => p.id !== currentId);

  return (
    <div className={`relative min-w-0 ${className}`} ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full min-w-0 items-center gap-1.5 rounded-xl px-2 py-1 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <FolderIcon className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
        <span className="truncate">{currentName}</span>
        <ChevronUpDownIcon className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_16px_40px_rgba(60,70,110,0.18)] dark:border-slate-700/70 dark:bg-slate-900">
          {others.length > 0 && (
            <div className="max-h-72 overflow-auto py-1">
              <p className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                สลับไปโปรเจกต์
              </p>
              {others.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/70"
                >
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  {p.deployed && (
                    <Tooltip label="deploy แล้ว" placement="left">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                    </Tooltip>
                  )}
                </Link>
              ))}
            </div>
          )}
          <div className="border-t border-slate-100 p-1 dark:border-slate-800">
            <Link
              href="/projects"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/70"
            >
              <PlusIcon className="h-4 w-4 text-emerald-500" />
              สร้างโปรเจกต์ใหม่ / ดูทั้งหมด
            </Link>
            <Link
              href="/styleshopping"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/70"
            >
              <Squares2X2Icon className="h-4 w-4 text-emerald-500" />
              หาไอเดีย / เลือกสไตล์
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
