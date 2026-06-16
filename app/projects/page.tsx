import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircleIcon, Cog6ToothIcon, ExclamationTriangleIcon, FolderIcon, InboxIcon, RocketLaunchIcon, Squares2X2Icon } from "@heroicons/react/24/outline";
import { AppTopBar } from "@/components/AppTopBar";
import { CreateProjectBar } from "@/components/projects/CreateProjectBar";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ReportButton } from "@/components/ReportButton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { getAccessGate } from "@/lib/beta";
import { getConnectionStatus } from "@/lib/google-connection";
import { getCurrentUser, getDeployedMap, listProjects } from "@/lib/projects";

export const metadata = { title: "โปรเจกต์ของฉัน — EasyGAS" };

export default async function ProjectsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const userId = user.id;
  const gate = await getAccessGate(userId, user.email);
  if (!gate.allowed) redirect("/waitlist");

  const [projects, conn, deployed] = await Promise.all([
    listProjects(),
    getConnectionStatus(userId),
    getDeployedMap(),
  ]);
  const deployedCount = projects.filter((p) => deployed[p.id]).length;
  const accountMismatch =
    conn.connected &&
    conn.status === "active" &&
    !!conn.email &&
    !!user.email &&
    conn.email.toLowerCase() !== user.email.toLowerCase();

  const googlePill =
    conn.connected && conn.status === "active" ? (
      <Link
        href="/connect"
        title="จัดการการเชื่อมต่อ Google"
        className="flex h-9 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/70"
      >
        <CheckCircleIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Google เชื่อมแล้ว</span>
      </Link>
    ) : (
      <Link
        href="/connect"
        className={`flex h-9 items-center rounded-full border px-3 text-sm font-medium shadow-sm transition ${
          conn.status === "needs_reauth"
            ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-300"
            : "border-slate-300 bg-white text-slate-600 hover:border-emerald-400 hover:text-emerald-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-emerald-500"
        }`}
      >
        {conn.status === "needs_reauth" ? "เชื่อม Google ใหม่" : "เชื่อมต่อ Google"}
      </Link>
    );

  return (
    <main className="relative min-h-screen overflow-x-clip bg-gradient-to-b from-[#eef3fb] to-[#e6ecf7] text-slate-800 dark:from-[#0b0f14] dark:to-[#0d1117] dark:text-slate-100">
      {/* atmosphere */}
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-emerald-200/30 blur-3xl dark:bg-emerald-500/10" />
      <div className="pointer-events-none absolute right-0 top-44 h-72 w-72 rounded-full bg-violet-200/30 blur-3xl dark:bg-violet-500/10" />

      <AppTopBar
        center={<span className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">โปรเจกต์ของฉัน</span>}
        right={
          <>
            <Link
              href="/styleshopping"
              title="เลือกสไตล์/หาไอเดีย"
              className="flex h-9 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/70"
            >
              <Squares2X2Icon className="h-4 w-4" />
              <span className="hidden sm:inline">หาไอเดีย</span>
            </Link>
            <ReportButton />
            <Link
              href="/settings"
              title="ตั้งค่า / โควตา / API key"
              className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white/70 text-slate-500 transition hover:text-emerald-600 dark:border-slate-700/60 dark:bg-slate-900/50 dark:text-slate-400 dark:hover:text-emerald-400"
            >
              <Cog6ToothIcon className="h-4 w-4" />
            </Link>
            <ThemeToggle className="h-9 w-9 rounded-full border border-slate-200 bg-white/70 dark:border-slate-700/60 dark:bg-slate-900/50" />
            {googlePill}
          </>
        }
      />

      {accountMismatch && (
        <div className="relative mx-auto mt-3 max-w-5xl px-6">
          <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
            <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              เข้าสู่ระบบเป็น <b>{user.email}</b> แต่ deploy ไปบัญชี <b>{conn.email}</b> —{" "}
              <Link href="/connect" className="font-medium underline underline-offset-2">
                จัดการการเชื่อมต่อ
              </Link>
            </span>
          </div>
        </div>
      )}

      <div className="relative mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">อยากสร้างอะไรดีวันนี้? 👋</h1>
          <p className="mt-1.5 max-w-xl text-sm text-slate-500 dark:text-slate-400">
            พิมพ์บอก AI ว่าอยากได้ระบบอะไร แล้วได้เครื่องมือ Google Apps Script จริง — หรือเริ่มจาก{" "}
            <Link href="/styleshopping" className="font-medium text-emerald-600 underline dark:text-emerald-400">
              เลือกสไตล์
            </Link>{" "}
            ก็ได้
          </p>
        </div>

        <CreateProjectBar existingNames={projects.map((p) => p.name)} />

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

        <div className="mt-6">
          {projects.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white/50 p-14 text-center text-slate-400 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-500">
              <div className="flex justify-center">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-slate-300 shadow-sm dark:bg-slate-800 dark:text-slate-600">
                  <InboxIcon className="h-7 w-7" />
                </span>
              </div>
              <p className="mt-3 text-sm">ยังไม่มีโปรเจกต์ — พิมพ์ด้านบน หรือเริ่มจากการเลือกสไตล์</p>
              <Link
                href="/styleshopping"
                className="mt-4 inline-flex items-center gap-1.5 rounded-2xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(16,185,129,0.35)] transition hover:bg-emerald-400"
              >
                <Squares2X2Icon className="h-4 w-4" />
                หาไอเดีย / เลือกสไตล์
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => (
                <ProjectCard key={p.id} project={p} deployUrl={deployed[p.id]} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
