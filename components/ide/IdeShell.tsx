"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useProjectStore } from "@/store/useProjectStore";
import { ChatPanel } from "./ChatPanel";
import { DeployButton } from "./DeployButton";
import { EditorPane } from "./EditorPane";
import { FileTree } from "./FileTree";
import { PreviewPane } from "./PreviewPane";

const CARD =
  "flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_8px_24px_rgba(60,70,110,0.06)]";

export function IdeShell({
  projectId,
  projectName,
  initialFiles,
  webHint,
}: {
  projectId: string;
  projectName: string;
  initialFiles: { path: string; content: string }[];
  webHint?: string[];
}) {
  const setInitial = useProjectStore((s) => s.setInitial);
  const [hintOpen, setHintOpen] = useState(true);
  useEffect(() => {
    setInitial(initialFiles);
  }, [initialFiles, setInitial]);

  return (
    <main className="flex h-screen flex-col bg-[#eef2f8] text-slate-800">
      <div className="flex items-center gap-3 px-4 py-3">
        <Link href="/projects" className="text-sm text-slate-500 hover:text-slate-800">
          ← โปรเจกต์
        </Link>
        <span className="text-slate-300">/</span>
        <b className="text-sm">{projectName}</b>
        <span className="flex-1" />
        <DeployButton projectId={projectId} />
      </div>

      {webHint && webHint.length > 0 && hintOpen && (
        <div className="mx-3 mb-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-800">
          <span className="mt-0.5">⚠</span>
          <div className="flex-1">
            งานนี้ดูเหมือนต้องใช้ฟีเจอร์ที่ Google Apps Script ทำไม่ได้:{" "}
            <b>{webHint.join(" · ")}</b>
            <br />
            ตอนนี้สร้างเป็น GAS ให้ก่อน — ส่วนนั้นจะยังไม่ทำงานจนกว่า web target (Cloudflare + Supabase) จะเปิด
          </div>
          <button
            onClick={() => setHintOpen(false)}
            className="shrink-0 text-amber-500 hover:text-amber-700"
            aria-label="ปิด"
          >
            ✕
          </button>
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-3 px-3 pb-3 lg:grid-cols-[320px_1.3fr_1fr]">
        <section className={CARD}>
          <ChatPanel projectId={projectId} />
        </section>
        <section className={CARD}>
          <FileTree />
          <div className="min-h-0 flex-1">
            <EditorPane projectId={projectId} />
          </div>
        </section>
        <section className={`${CARD} p-3`}>
          <PreviewPane projectId={projectId} />
        </section>
      </div>
    </main>
  );
}
