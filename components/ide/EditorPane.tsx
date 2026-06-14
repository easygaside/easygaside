"use client";

import dynamic from "next/dynamic";
import { useRef } from "react";
import { useProjectStore } from "@/store/useProjectStore";

const Monaco = dynamic(
  () => import("@monaco-editor/react").then((m) => m.default),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full place-items-center text-sm text-slate-400">กำลังโหลด editor…</div>
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
      <div className="grid h-full place-items-center px-6 text-center text-sm text-slate-400">
        ยังไม่มีไฟล์ — พิมพ์บอก AI ทางซ้ายให้สร้างระบบ
      </div>
    );
  }

  return (
    <Monaco
      key={activePath}
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
