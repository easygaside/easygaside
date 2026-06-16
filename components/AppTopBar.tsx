import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared chrome for the logged-in surface — the same top bar on the projects home AND the IDE
 * workspace, so moving between them feels like one app. `center` = context (a label on home, the
 * ProjectSwitcher in the workspace); `right` = context actions (connect/settings on home, deploy in
 * the workspace). The body below differs (warm grid vs 3-pane), the chrome stays consistent.
 */
export function AppTopBar({ center, right }: { center?: ReactNode; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-2.5 border-b border-slate-200/70 bg-white/70 px-4 py-2.5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
      <Link href="/projects" className="flex shrink-0 items-center gap-2" title="หน้าหลัก">
        <Image src="/icon/android-icon-192x192.png" alt="EasyGAS" width={28} height={28} className="rounded-lg" />
        <b className="hidden text-sm tracking-tight sm:block">
          Easy<span className="text-emerald-600 dark:text-emerald-400">GAS</span>
        </b>
      </Link>
      {center && (
        <>
          <span className="hidden h-5 w-px shrink-0 bg-slate-200 dark:bg-slate-700 sm:block" />
          {center}
        </>
      )}
      <span className="flex-1" />
      <div className="flex shrink-0 items-center gap-2">{right}</div>
    </header>
  );
}
