"use client";

import { useState } from "react";
import { ArrowTopRightOnSquareIcon, CheckIcon, ClipboardIcon, RocketLaunchIcon } from "@heroicons/react/24/outline";

/** Persistent bar showing the project's live /exec URL + open/copy. The URL is stable across
 *  re-deploys (deploy PATCHes the same deployment), so it's safe to share once. */
export function DeployedUrlBar({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the open link still works */
    }
  }

  return (
    <div className="mx-3 mt-2 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[13px] dark:border-emerald-800/50 dark:bg-emerald-950/30">
      <RocketLaunchIcon className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <span className="font-medium text-emerald-700 dark:text-emerald-300">แอปของคุณออนไลน์แล้ว</span>
      <span className="min-w-0 flex-1" />
      <button
        onClick={copy}
        className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
      >
        {copied ? <CheckIcon className="h-3.5 w-3.5" /> : <ClipboardIcon className="h-3.5 w-3.5" />}
        {copied ? "คัดลอกแล้ว" : "คัดลอก"}
      </button>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-emerald-400"
      >
        เปิด <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
