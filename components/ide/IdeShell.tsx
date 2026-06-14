"use client";

import { useEffect } from "react";
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
}: {
  projectId: string;
  projectName: string;
  initialFiles: { path: string; content: string }[];
}) {
  const setInitial = useProjectStore((s) => s.setInitial);
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
