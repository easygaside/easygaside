import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserId, listProjects } from "@/lib/projects";
import { newProjectAction } from "./actions";

export const metadata = { title: "โปรเจกต์ของฉัน — easygas" };

const KIND_LABEL: Record<string, string> = { webapp: "เว็บแอป", bound: "ผูก Sheet" };

export default async function ProjectsPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const projects = await listProjects();

  return (
    <main className="min-h-screen bg-[#eef2f8] px-6 py-10 text-slate-800">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">โปรเจกต์ของฉัน</h1>
            <p className="mt-1 text-sm text-slate-500">
              สร้างเครื่องมือ Google Apps Script ด้วยการคุยกับ AI
            </p>
          </div>
          <Link
            href="/connect"
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-emerald-400 hover:text-emerald-600"
          >
            เชื่อมต่อ Google
          </Link>
        </header>

        {/* new project */}
        <form
          action={newProjectAction}
          className="mb-8 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_8px_24px_rgba(60,70,110,0.06)]"
        >
          <span className="text-lg">✨</span>
          <input
            name="name"
            placeholder="อยากสร้างอะไร? เช่น ระบบจองคิวร้านตัดผม…"
            className="min-w-[220px] flex-1 rounded-xl bg-slate-50 px-4 py-2.5 text-sm outline-none ring-emerald-300 focus:ring-2"
          />
          <button
            type="submit"
            className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(16,185,129,0.3)] transition hover:bg-emerald-400"
          >
            สร้างโปรเจกต์ →
          </button>
        </form>

        {/* list */}
        {projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/50 p-12 text-center text-slate-400">
            <div className="text-3xl">📭</div>
            <p className="mt-2 text-sm">ยังไม่มีโปรเจกต์ — พิมพ์ด้านบนเพื่อเริ่มสร้างเลย</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="group rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_8px_24px_rgba(60,70,110,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(60,70,110,0.1)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-snug text-slate-800 group-hover:text-emerald-600">
                    {p.name}
                  </h3>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                    {KIND_LABEL[p.kind] ?? p.kind}
                  </span>
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  แก้ไขล่าสุด{" "}
                  {new Date(p.updated_at).toLocaleDateString("th-TH", {
                    day: "numeric",
                    month: "short",
                  })}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
