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
  const setActive = useProjectStore((s) => s.setActive);

  return (
    <div className="flex flex-none items-center gap-1 overflow-x-auto border-b border-slate-200/70 px-3 py-2">
      {order.length === 0 ? (
        <span className="px-1 text-xs text-slate-400">ยังไม่มีไฟล์</span>
      ) : (
        order.map((p) => (
          <button
            key={p}
            onClick={() => setActive(p)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 font-mono text-xs transition ${
              active === p
                ? "bg-slate-100 font-medium text-slate-800"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: dotColor(p) }} />
            {p}
          </button>
        ))
      )}
    </div>
  );
}
