"use client";

import { useEffect, useState } from "react";
import {
  ChatBubbleLeftRightIcon,
  CodeBracketIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useProjectStore } from "@/store/useProjectStore";
import { AppTopBar } from "@/components/AppTopBar";
import { ReportButton } from "@/components/ReportButton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ChatPanel } from "./ChatPanel";
import { DeployButton } from "./DeployButton";
import { DeployedUrlBar } from "./DeployedUrlBar";
import { EditorPane } from "./EditorPane";
import { ProjectSwitcher, type SwitcherProject } from "./ProjectSwitcher";
import { FileTree } from "./FileTree";
import { PreviewPane } from "./PreviewPane";

const CARD =
  "flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_8px_24px_rgba(60,70,110,0.06)] dark:border-slate-800 dark:bg-slate-900";

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
}) {
  const setInitial = useProjectStore((s) => s.setInitial);
  const [hintOpen, setHintOpen] = useState(true);
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

  return (
    <main className="flex h-screen flex-col bg-[#eef2f8] text-slate-800 dark:bg-[#0b0f14] dark:text-slate-100">
      <AppTopBar
        center={<ProjectSwitcher currentId={projectId} currentName={projectName} projects={projects} />}
        right={
          <>
            <ReportButton projectId={projectId} />
            <ThemeToggle />
            <DeployButton projectId={projectId} googleConnected={googleConnected} onDeployed={setDeployUrl} />
          </>
        }
      />

      {deployUrl && <DeployedUrlBar url={deployUrl} />}

      {webHint && webHint.length > 0 && hintOpen && (
        <div className="mx-3 mb-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200">
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
        <section className={`${CARD} ${hideOnMobile("chat")}`}>
          <ChatPanel
            projectId={projectId}
            initialImages={initialImages}
            energyUsed={energyUsed}
            energyTank={energyTank}
          />
        </section>
        <section className={`${CARD} ${hideOnMobile("code")}`}>
          <FileTree />
          <div className="min-h-0 flex-1">
            <EditorPane projectId={projectId} />
          </div>
        </section>
        <section className={`${CARD} p-3 ${hideOnMobile("preview")}`}>
          <PreviewPane />
        </section>
      </div>

      {/* mobile pane switcher — floating segmented control; desktop shows all three so it's hidden */}
      <nav className="shrink-0 px-3 pb-3 lg:hidden">
        <div className="flex items-center gap-1 rounded-2xl border border-slate-200/70 bg-white/90 p-1 shadow-[0_4px_16px_rgba(60,70,110,0.10)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
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
