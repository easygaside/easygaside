"use client";

import { useProjectStore } from "@/store/useProjectStore";

function dotColor(path: string): string {
  if (path.endsWith(".gs")) return "#e0b06a";
  if (path.endsWith(".html")) return "#7aa2f7";
  if (path.endsWith(".json")) return "#b69cf0";
  return "#9aa7b6";
}

export function FileTree() {
  const order = useProjectStore((s) => s.order);
  const active = useProjectStore((s) => s.activePath);
  const working = useProjectStore((s) => s.workingPath);
  const setActive = useProjectStore((s) => s.setActive);

  return (
    <div className="flex flex-none items-center gap-1 overflow-x-auto border-b border-slate-200/70 dark:border-slate-700/60 px-3 py-2">
      {order.length === 0 ? (
        <span className="px-1 text-xs text-slate-400 dark:text-slate-500">ยังไม่มีไฟล์</span>
      ) : (
        order.map((p) => (
          <button
            key={p}
            onClick={() => setActive(p)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 font-mono text-xs transition ${
              active === p
                ? "bg-slate-100 dark:bg-slate-800 font-medium text-slate-800 dark:text-slate-100"
                : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
            }`}
          >
            <span className="relative flex h-1.5 w-1.5">
              {p === working && (
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                  style={{ background: dotColor(p) }}
                />
              )}
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: dotColor(p) }} />
            </span>
            {p}
          </button>
        ))
      )}
    </div>
  );
}
