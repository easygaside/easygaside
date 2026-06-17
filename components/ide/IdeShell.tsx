"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChatBubbleLeftRightIcon,
  CodeBracketIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useProjectStore } from "@/store/useProjectStore";
import { ReportButton } from "@/components/ReportButton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ChatPanel } from "./ChatPanel";
import { DeployButton } from "./DeployButton";
import { DeployedUrlBar } from "./DeployedUrlBar";
import { EditorPane } from "./EditorPane";
import { EditorToolbar } from "./EditorToolbar";
import { IssuesPanel } from "./IssuesPanel";
import { ProjectSwitcher, type SwitcherProject } from "./ProjectSwitcher";
import { FileTree } from "./FileTree";
import { PreviewPane } from "./PreviewPane";

// flush panel (no floating card) — borders come from the grid container, matching the IDE mockup
const PANEL = "flex min-h-0 flex-col overflow-hidden bg-white dark:bg-slate-900";

export function IdeShell({
  projectId,
  projectName,
  initialFiles,
  initialImages,
  webHint,
  googleConnected = true,
  energyUsed = 0,
  energyTank,
  deployedUrl,
  projects = [],
  accountMismatch = null,
}: {
  projectId: string;
  projectName: string;
  initialFiles: { path: string; content: string }[];
  initialImages?: { url: string }[];
  webHint?: string[];
  googleConnected?: boolean;
  energyUsed?: number;
  energyTank?: number;
  deployedUrl?: string | null;
  projects?: SwitcherProject[];
  accountMismatch?: { login: string; connected: string } | null;
}) {
  const setInitial = useProjectStore((s) => s.setInitial);
  const activePath = useProjectStore((s) => s.activePath);
  const [hintOpen, setHintOpen] = useState(true);
  const [mismatchOpen, setMismatchOpen] = useState(true);
  const [deployUrl, setDeployUrl] = useState<string | null>(deployedUrl ?? null);
  // mobile-only: show one pane at a time (desktop shows all three side by side)
  const [pane, setPane] = useState<"chat" | "code" | "preview">("chat");
  useEffect(() => {
    setInitial(initialFiles);
  }, [initialFiles, setInitial]);

  const hideOnMobile = (p: "chat" | "code" | "preview") => (pane === p ? "" : "max-lg:hidden");
  const TAB = (active: boolean) =>
    `flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] transition ${
      active
        ? "bg-gradient-to-br from-emerald-500 to-emerald-600 font-semibold text-white shadow-[0_4px_12px_rgba(16,185,129,0.35)]"
        : "font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/60"
    }`;

  // activity-rail icon button (jumps a pane on mobile; a quiet visual anchor on desktop)
  const RAIL = (p: "chat" | "code" | "preview") =>
    `grid h-9 w-9 place-items-center rounded-[9px] transition ${
      pane === p
        ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
        : "text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800"
    }`;

  return (
    <main className="flex h-screen flex-col bg-[#fafafa] text-slate-800 dark:bg-[#0d0f12] dark:text-slate-100">
      {/* TOP BAR */}
      <header className="flex h-[54px] flex-none items-center gap-3 border-b border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900 sm:px-4">
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="grid h-[26px] w-[26px] place-items-center rounded-[7px] bg-emerald-600 text-sm font-bold text-white">
            G
          </span>
          <span className="hidden text-[15px] font-bold tracking-tight sm:block">EasyGAS</span>
        </div>
        <span className="hidden h-[18px] w-px bg-slate-200 dark:bg-slate-700 sm:block" />
        <ProjectSwitcher currentId={projectId} currentName={projectName} projects={projects} />
        <div className="hidden flex-1 justify-center lg:flex">
          <div className="flex w-[340px] items-center gap-2 rounded-[9px] border border-slate-200 bg-slate-50 px-3.5 py-[7px] text-slate-400 dark:border-slate-700/70 dark:bg-slate-800/60">
            <MagnifyingGlassIcon className="h-3.5 w-3.5" />
            <span className="text-[12.5px]">ค้นหาไฟล์ หรือสั่งงาน…</span>
            <span className="ml-auto rounded border border-slate-200 px-1.5 font-mono text-[10px] dark:border-slate-700">⌘K</span>
          </div>
        </div>
        <span className="flex-1 lg:hidden" />
        <ReportButton projectId={projectId} />
        <ThemeToggle />
        <DeployButton projectId={projectId} googleConnected={googleConnected} onDeployed={setDeployUrl} />
      </header>

      {/* STATUS STRIP — live /exec URL + actions (flush, full-width) */}
      {deployUrl && <DeployedUrlBar url={deployUrl} projectId={projectId} />}

      {webHint && webHint.length > 0 && hintOpen && (
        <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-[12px] leading-relaxed text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200">
          <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            งานนี้ดูเหมือนต้องใช้ฟีเจอร์ที่ Google Apps Script ทำไม่ได้: <b>{webHint.join(" · ")}</b>
            <br />
            ตอนนี้สร้างเป็น GAS ให้ก่อน — ส่วนนั้นจะยังไม่ทำงานจนกว่า web target (Cloudflare + Supabase) จะเปิด
          </div>
          <button onClick={() => setHintOpen(false)} className="shrink-0 text-amber-500 hover:text-amber-700" aria-label="ปิด">
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {accountMismatch && mismatchOpen && (
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-[12px] text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200">
          <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            deploy เข้าบัญชี <b>{accountMismatch.connected}</b> (ไม่ใช่ {accountMismatch.login} ที่ล็อกอิน)
          </span>
          <button onClick={() => setMismatchOpen(false)} className="shrink-0 text-amber-500 transition hover:text-amber-700" aria-label="ปิด">
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* BODY: activity rail + flush 3-pane */}
      <div className="flex min-h-0 flex-1">
        <nav className="hidden w-[52px] flex-none flex-col items-center gap-1.5 border-r border-slate-200 bg-slate-50/70 py-3 lg:flex dark:border-slate-800 dark:bg-slate-950/40">
          <button onClick={() => setPane("chat")} title="ผู้ช่วย AI" className={RAIL("chat")}>
            <SparklesIcon className="h-[18px] w-[18px]" />
          </button>
          <button onClick={() => setPane("code")} title="โค้ด" className={RAIL("code")}>
            <CodeBracketIcon className="h-[18px] w-[18px]" />
          </button>
          <button onClick={() => setPane("preview")} title="พรีวิว" className={RAIL("preview")}>
            <EyeIcon className="h-[18px] w-[18px]" />
          </button>
          <span className="flex-1" />
          <Link
            href="/settings"
            title="ตั้งค่า"
            className="grid h-9 w-9 place-items-center rounded-[9px] text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800"
          >
            <Cog6ToothIcon className="h-[18px] w-[18px]" />
          </Link>
        </nav>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[312px_1fr_392px]">
          <section className={`${PANEL} border-slate-200 dark:border-slate-800 lg:border-r ${hideOnMobile("chat")}`}>
            <ChatPanel projectId={projectId} initialImages={initialImages} energyUsed={energyUsed} energyTank={energyTank} />
          </section>

          <section className={`${PANEL} border-slate-200 dark:border-slate-800 lg:border-r ${hideOnMobile("code")}`}>
            <FileTree />
            <EditorToolbar projectId={projectId} />
            <div className="min-h-0 flex-1">
              <EditorPane projectId={projectId} />
            </div>
            <IssuesPanel />
            {/* editor status bar */}
            <div className="flex h-[30px] flex-none items-center gap-4 border-t border-slate-200 bg-slate-50 px-4 text-[11.5px] text-slate-500 dark:border-slate-800 dark:bg-slate-900/60">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> ออนไลน์
              </span>
              <span className="flex-1" />
              {activePath && <span className="truncate font-mono">{activePath}</span>}
              <span>UTF-8</span>
              <span>V8</span>
            </div>
          </section>

          <section className={`${PANEL} p-3 ${hideOnMobile("preview")}`}>
            <PreviewPane />
          </section>
        </div>
      </div>

      {/* mobile pane switcher — desktop shows all three so it's hidden */}
      <nav className="shrink-0 border-t border-slate-200 bg-white px-3 py-2 lg:hidden dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setPane("chat")} className={TAB(pane === "chat")}>
            <ChatBubbleLeftRightIcon className="h-4 w-4 shrink-0" />
            แชต
          </button>
          <button type="button" onClick={() => setPane("code")} className={TAB(pane === "code")}>
            <CodeBracketIcon className="h-4 w-4 shrink-0" />
            โค้ด
          </button>
          <button type="button" onClick={() => setPane("preview")} className={TAB(pane === "preview")}>
            <EyeIcon className="h-4 w-4 shrink-0" />
            พรีวิว
          </button>
        </div>
      </nav>
    </main>
  );
}
