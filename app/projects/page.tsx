import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircleIcon, FolderIcon, InboxIcon, RocketLaunchIcon } from "@heroicons/react/24/outline";
import { CreateProjectBar } from "@/components/projects/CreateProjectBar";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { getConnectionStatus } from "@/lib/google-connection";
import { getCurrentUserId, getDeployedMap, listProjects } from "@/lib/projects";

export const metadata = { title: "โปรเจกต์ของฉัน — easygas" };

export default async function ProjectsPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const [projects, conn, deployed] = await Promise.all([
    listProjects(),
    getConnectionStatus(userId),
    getDeployedMap(),
  ]);
  const deployedCount = projects.filter((p) => deployed[p.id]).length;

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#eef3fb] to-[#e6ecf7] px-6 py-10 text-slate-800 dark:from-[#0b0f14] dark:to-[#0d1117] dark:text-slate-100">
      {/* atmosphere */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-200/30 blur-3xl dark:bg-emerald-500/10" />
      <div className="pointer-events-none absolute right-0 top-28 h-72 w-72 rounded-full bg-violet-200/30 blur-3xl dark:bg-violet-500/10" />

      <div className="relative mx-auto max-w-5xl">
        <header className="mb-7">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
            <div className="min-w-0">
              <h1 className="text-3xl font-bold tracking-tight">โปรเจกต์ของฉัน</h1>
              <p className="mt-1.5 max-w-lg text-sm text-slate-500 dark:text-slate-400">
                พิมพ์คุยกับ AI แล้วได้เครื่องมือ Google Apps Script จริง — deploy เข้าบัญชี Google ของคุณ
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ThemeToggle className="h-9 w-9 rounded-full border border-slate-200 bg-white/70 dark:border-slate-700/60 dark:bg-slate-900/50" />
              {conn.connected && conn.status === "active" ? (
                <Link
                  href="/connect"
                  className="flex h-9 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-4 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/70"
                  title="จัดการการเชื่อมต่อ Google"
                >
                  <CheckCircleIcon className="h-4 w-4" />
                  Google เชื่อมแล้ว
                </Link>
              ) : (
                <Link
                  href="/connect"
                  className={`flex h-9 items-center rounded-full border px-4 text-sm font-medium shadow-sm transition ${
                    conn.status === "needs_reauth"
                      ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-300"
                      : "border-slate-300 bg-white text-slate-600 hover:border-emerald-400 hover:text-emerald-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-emerald-500"
                  }`}
                >
                  {conn.status === "needs_reauth" ? "เชื่อมต่อ Google ใหม่" : "เชื่อมต่อ Google"}
                </Link>
              )}
            </div>
          </div>

          {projects.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-medium">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-slate-600 dark:border-slate-700/60 dark:bg-slate-900/50 dark:text-slate-300">
                <FolderIcon className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                {projects.length} โปรเจกต์
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                <RocketLaunchIcon className="h-3.5 w-3.5" />
                {deployedCount} deploy แล้ว
              </span>
            </div>
          )}
        </header>

        <div className="mb-8">
          <CreateProjectBar existingNames={projects.map((p) => p.name)} />
        </div>

        {projects.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white/50 p-14 text-center text-slate-400 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-500">
            <div className="flex justify-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-slate-300 shadow-sm dark:bg-slate-800 dark:text-slate-600">
                <InboxIcon className="h-7 w-7" />
              </span>
            </div>
            <p className="mt-3 text-sm">ยังไม่มีโปรเจกต์ — พิมพ์ด้านบนหรือกดตัวอย่างเพื่อเริ่มสร้างเลย</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} deployUrl={deployed[p.id]} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
