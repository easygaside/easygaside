"use client";

import { type CSSProperties, type PointerEvent as ReactPointerEvent, useEffect, useState } from "react";
import Image from "next/image";
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
import { Tooltip } from "@/components/ui/Tooltip";
import { ChatPanel } from "./ChatPanel";
import { CommandPalette } from "./CommandPalette";
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
  const setPaletteOpen = useProjectStore((s) => s.setPaletteOpen);
  // the file the agent is writing right now (null when idle) — drives the mobile code-tab attention pulse
  const workingPath = useProjectStore((s) => s.workingPath);
  // editor-triggered agent actions (ทดสอบรันจริง / ซ่อมจาก issues panel) are dispatched as a store
  // command and run inside ChatPanel, streaming into the chat pane — watch it to jump there.
  const command = useProjectStore((s) => s.command);
  const [hintOpen, setHintOpen] = useState(true);
  const [mismatchOpen, setMismatchOpen] = useState(true);
  const [deployUrl, setDeployUrl] = useState<string | null>(deployedUrl ?? null);
  // mobile-only: show one pane at a time (desktop shows all three side by side)
  const [pane, setPane] = useState<"chat" | "code" | "preview">("chat");
  // pulse the mobile โค้ด tab when the AI is writing a file and the user isn't already on the code pane
  const codeBusy = !!workingPath && pane !== "code";
  // width (px) of the preview pane — dragged via the splitter between code and preview (desktop only)
  const [previewW, setPreviewW] = useState(392);
  const [resizing, setResizing] = useState(false);
  useEffect(() => {
    setInitial(initialFiles);
  }, [initialFiles, setInitial]);
  // "ทดสอบรันจริง" / fix-from-issues stream their result into the chat pane — jump there so the user
  // actually sees it, especially on mobile where only one pane is visible at a time.
  useEffect(() => {
    if (command) setPane("chat");
  }, [command]);

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

  // drag the splitter (pointer-capture so dragging OVER the preview iframe still tracks + releases)
  function startResize(e: ReactPointerEvent<HTMLDivElement>) {
    e.preventDefault();
    const el = e.currentTarget;
    const startX = e.clientX;
    const startW = previewW;
    el.setPointerCapture(e.pointerId);
    setResizing(true);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    const onMove = (ev: PointerEvent) => {
      const maxW = Math.min(760, window.innerWidth - 660);
      setPreviewW(Math.min(Math.max(startW - (ev.clientX - startX), 300), Math.max(maxW, 320)));
    };
    const end = (ev: PointerEvent) => {
      el.releasePointerCapture?.(ev.pointerId);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", end);
      el.removeEventListener("pointercancel", end);
      setResizing(false);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }

  return (
    <main className="flex h-screen flex-col bg-[#fafafa] text-slate-800 dark:bg-[#0d0f12] dark:text-slate-100">
      {/* TOP BAR */}
      <header className="flex h-[54px] flex-none items-center gap-2 border-b border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900 sm:gap-3 sm:px-4">
        <div className="flex shrink-0 items-center gap-2.5">
          <Image src="/icon/android-icon-192x192.png" alt="EasyGAS" width={26} height={26} className="rounded-[7px]" />
          <span className="hidden text-[15px] font-bold tracking-tight sm:block">
            Easy<span className="text-emerald-600 dark:text-emerald-400">GAS</span>
          </span>
        </div>
        <span className="hidden h-[18px] w-px bg-slate-200 dark:bg-slate-700 sm:block" />
        {/* project name owns the flexible space on mobile so it truncates instead of crowding out the actions */}
        <ProjectSwitcher
          currentId={projectId}
          currentName={projectName}
          projects={projects}
          className="min-w-0 flex-1 lg:flex-none"
        />
        <div className="hidden flex-1 justify-center lg:flex">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex w-[340px] items-center gap-2 rounded-[9px] border border-slate-200 bg-slate-50 px-3.5 py-[7px] text-slate-400 transition hover:border-slate-300 hover:bg-white dark:border-slate-700/70 dark:bg-slate-800/60 dark:hover:border-slate-600 dark:hover:bg-slate-800"
          >
            <MagnifyingGlassIcon className="h-3.5 w-3.5" />
            <span className="text-[12.5px]">ค้นหาไฟล์ หรือสั่งงาน…</span>
            <span className="ml-auto rounded border border-slate-200 px-1.5 font-mono text-[10px] dark:border-slate-700">⌘K</span>
          </button>
        </div>
        {/* actions cluster — shrink-0 so a long project name can never push these off-screen */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <ReportButton projectId={projectId} />
          <ThemeToggle />
          <DeployButton projectId={projectId} googleConnected={googleConnected} deployed={!!deployUrl} onDeployed={setDeployUrl} />
        </div>
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
          <Tooltip label="ผู้ช่วย AI" placement="right">
            <button onClick={() => setPane("chat")} className={RAIL("chat")}>
              <SparklesIcon className="h-[18px] w-[18px]" />
            </button>
          </Tooltip>
          <Tooltip label="โค้ด" placement="right">
            <button onClick={() => setPane("code")} className={RAIL("code")}>
              <CodeBracketIcon className="h-[18px] w-[18px]" />
            </button>
          </Tooltip>
          <Tooltip label="พรีวิว" placement="right">
            <button onClick={() => setPane("preview")} className={RAIL("preview")}>
              <EyeIcon className="h-[18px] w-[18px]" />
            </button>
          </Tooltip>
          <span className="flex-1" />
          <Tooltip label="ตั้งค่า" placement="right">
            <Link
              href="/settings"
              className="grid h-9 w-9 place-items-center rounded-[9px] text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800"
            >
              <Cog6ToothIcon className="h-[18px] w-[18px]" />
            </Link>
          </Tooltip>
        </nav>

        <div
          className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[312px_1fr_7px_var(--preview-w,392px)]"
          style={{ "--preview-w": `${previewW}px` } as CSSProperties}
        >
          <section className={`${PANEL} border-slate-200 dark:border-slate-800 lg:border-r ${hideOnMobile("chat")}`}>
            <ChatPanel projectId={projectId} initialImages={initialImages} energyUsed={energyUsed} energyTank={energyTank} />
          </section>

          <section className={`${PANEL} ${hideOnMobile("code")}`}>
            <FileTree />
            <EditorToolbar projectId={projectId} />
            <div className="min-h-0 flex-1">
              <EditorPane />
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

          {/* draggable splitter — drag to resize the preview width (desktop only) */}
          <div
            onPointerDown={startResize}
            title="ลากเพื่อปรับความกว้างของพรีวิว"
            className="group relative hidden cursor-col-resize touch-none lg:block"
          >
            <span
              className={`absolute inset-y-0 left-1/2 -translate-x-1/2 transition-all ${
                resizing
                  ? "w-[3px] bg-emerald-400 dark:bg-emerald-500"
                  : "w-px bg-slate-200 group-hover:w-[3px] group-hover:bg-emerald-400 dark:bg-slate-800 dark:group-hover:bg-emerald-500"
              }`}
            />
          </div>

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
          <button
            type="button"
            onClick={() => setPane("code")}
            className={
              codeBusy
                ? "relative flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-semibold text-emerald-600 bg-emerald-50 ring-1 ring-emerald-300 transition dark:bg-emerald-950/40 dark:text-emerald-400"
                : `relative ${TAB(pane === "code")}`
            }
          >
            <CodeBracketIcon className={`h-4 w-4 shrink-0 ${codeBusy ? "animate-pulse" : ""}`} />
            โค้ด
            {codeBusy && (
              <span className="absolute right-3 top-1 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
            )}
          </button>
          <button type="button" onClick={() => setPane("preview")} className={TAB(pane === "preview")}>
            <EyeIcon className="h-4 w-4 shrink-0" />
            พรีวิว
          </button>
        </div>
      </nav>

      <CommandPalette googleConnected={googleConnected} deployed={!!deployUrl} onJumpPane={setPane} />
    </main>
  );
}
