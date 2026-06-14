"use client";

import dynamic from "next/dynamic";
import { useRef } from "react";
import { CodeBracketIcon } from "@heroicons/react/24/outline";
import { useProjectStore } from "@/store/useProjectStore";

const Monaco = dynamic(
  () => import("@monaco-editor/react").then((m) => m.default),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full place-items-center text-sm text-slate-400 dark:text-slate-500">กำลังโหลด editor…</div>
    ),
  },
);

function langOf(path: string): string {
  if (path.endsWith(".gs")) return "javascript";
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".json")) return "json";
  return "plaintext";
}

export function EditorPane({ projectId }: { projectId: string }) {
  const activePath = useProjectStore((s) => s.activePath);
  const files = useProjectStore((s) => s.files);
  const update = useProjectStore((s) => s.updateActiveContent);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onChange(v: string | undefined) {
    const content = v ?? "";
    update(content);
    if (!activePath) return;
    const path = activePath;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      // autosave user edits to egs_files (AI writes already persist server-side)
      fetch(`/api/files/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, content }),
      }).catch(() => {});
    }, 800);
  }

  if (!activePath) {
    return (
      <div className="grid h-full place-items-center px-8 text-center">
        <div className="max-w-xs">
          <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_10px_30px_rgba(16,185,129,0.3)]">
            <CodeBracketIcon className="h-7 w-7" />
          </span>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">โค้ดจะขึ้นที่นี่</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
            พิมพ์บอก AI ทางซ้ายว่าอยากได้ระบบอะไร — โค้ด Google Apps Script จะถูกสร้างและแสดงที่นี่ พร้อมพรีวิวสดทางขวา
          </p>
        </div>
      </div>
    );
  }

  return (
    <Monaco
      // `path` makes Monaco keep one model per file and switch between them — NOT a full remount
      // (which `key=` forced, disposing the editor mid-async → noisy "Canceled" errors).
      path={activePath}
      height="100%"
      theme="vs-dark"
      language={langOf(activePath)}
      value={files[activePath]?.content ?? ""}
      onChange={onChange}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        padding: { top: 12 },
        tabSize: 2,
      }}
    />
  );
}
