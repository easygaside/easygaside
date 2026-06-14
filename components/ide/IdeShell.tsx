"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeftIcon, ExclamationTriangleIcon, XMarkIcon } from "@heroicons/react/24/outline";
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
  initialImages,
  webHint,
  googleConnected = true,
}: {
  projectId: string;
  projectName: string;
  initialFiles: { path: string; content: string }[];
  initialImages?: { url: string }[];
  webHint?: string[];
  googleConnected?: boolean;
}) {
  const setInitial = useProjectStore((s) => s.setInitial);
  const [hintOpen, setHintOpen] = useState(true);
  useEffect(() => {
    setInitial(initialFiles);
  }, [initialFiles, setInitial]);

  return (
    <main className="flex h-screen flex-col bg-[#eef2f8] text-slate-800">
      <div className="flex items-center gap-2.5 border-b border-slate-200/70 bg-white/70 px-4 py-2.5 backdrop-blur">
        <span className="flex shrink-0 items-center gap-2">
          <Image
            src="/icon/android-icon-192x192.png"
            alt="EasyGAS IDE"
            width={28}
            height={28}
            className="rounded-lg"
          />
          <b className="text-sm tracking-tight">
            EasyGAS <span className="text-emerald-600">IDE</span>
          </b>
        </span>
        <span className="h-5 w-px shrink-0 bg-slate-200" />
        <Link
          href="/projects"
          title="กลับไปหน้าโปรเจกต์"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <ArrowLeftIcon className="h-4 w-4" />
        </Link>
        <b className="truncate text-sm font-semibold text-slate-700">{projectName}</b>
        <span className="flex-1" />
        <DeployButton projectId={projectId} googleConnected={googleConnected} />
      </div>

      {webHint && webHint.length > 0 && hintOpen && (
        <div className="mx-3 mb-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-800">
          <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
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
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-3 px-3 pb-3 lg:grid-cols-[320px_1.3fr_1fr]">
        <section className={CARD}>
          <ChatPanel projectId={projectId} initialImages={initialImages} />
        </section>
        <section className={CARD}>
          <FileTree />
          <div className="min-h-0 flex-1">
            <EditorPane projectId={projectId} />
          </div>
        </section>
        <section className={`${CARD} p-3`}>
          <PreviewPane />
        </section>
      </div>
    </main>
  );
}
