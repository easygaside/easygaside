"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, CheckIcon, PlusIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { newProjectReturnId } from "@/app/projects/actions";
import type { StyleCategory, StyleItem } from "@/lib/style-catalog";

function buildPrompt(purpose: string, items: StyleItem[]): string {
  const head = purpose.trim() ? `สร้าง${purpose.trim()}` : "สร้างเครื่องมือตามที่อธิบาย";
  if (items.length === 0) return head;
  const lines = items.map((i) => `- ${i.promptSnippet}`).join("\n");
  return `${head}\n\nโดยใช้สไตล์และองค์ประกอบเหล่านี้:\n${lines}`;
}

export function StyleShopping({
  catalog,
  categories,
  loggedIn,
}: {
  catalog: StyleItem[];
  categories: StyleCategory[];
  loggedIn: boolean;
}) {
  const router = useRouter();
  const [activeCat, setActiveCat] = useState<string>(categories[0]?.id ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const [purpose, setPurpose] = useState("");
  const [prompt, setPrompt] = useState("");
  const [dirty, setDirty] = useState(false); // user manually edited the prompt
  const [creating, setCreating] = useState(false);

  const selectedItems = useMemo(
    () => selected.map((id) => catalog.find((c) => c.id === id)).filter((x): x is StyleItem => !!x),
    [selected, catalog],
  );

  // keep the prompt in sync with picks/purpose until the user edits it by hand
  useEffect(() => {
    if (!dirty) setPrompt(buildPrompt(purpose, selectedItems));
  }, [purpose, selectedItems, dirty]);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const shown = catalog.filter((c) => c.category === activeCat);
  const activeHint = categories.find((c) => c.id === activeCat)?.hint;

  async function create() {
    if (!prompt.trim() || creating) return;
    if (!loggedIn) {
      router.push("/login");
      return;
    }
    setCreating(true);
    try {
      const name = (purpose.trim() || "เครื่องมือจาก Style Lab").slice(0, 70);
      const id = await newProjectReturnId(name);
      sessionStorage.setItem("egs:kickoff", prompt.trim());
      router.push(`/projects/${id}`);
    } catch {
      setCreating(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#eef2f8] text-slate-800 dark:bg-[#0b0f14] dark:text-slate-100">
      <header className="border-b border-slate-200/70 bg-white/70 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <Link
            href={loggedIn ? "/projects" : "/"}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-base font-bold leading-tight">เลือกสไตล์ให้เว็บคุณ</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              เดินเลือกองค์ประกอบ กดดูตัวอย่างได้ → รวมเป็นคำสั่งแล้วเริ่มสร้างโปรเจกต์
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-5 lg:grid-cols-[1fr_360px]">
        {/* left: categories + cards */}
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition ${
                  activeCat === c.id
                    ? "bg-emerald-500 text-white shadow-[0_4px_12px_rgba(16,185,129,0.3)]"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700"
                }`}
              >
                {c.title}
              </button>
            ))}
          </div>
          {activeHint && (
            <p className="mb-3 text-[13px] text-slate-500 dark:text-slate-400">{activeHint}</p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {shown.map((item) => {
              const on = selected.includes(item.id);
              return (
                <div
                  key={item.id}
                  className={`flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition dark:bg-slate-900 ${
                    on
                      ? "border-emerald-400 ring-2 ring-emerald-400/40"
                      : "border-slate-200/70 dark:border-slate-800"
                  }`}
                >
                  <iframe
                    title={item.title}
                    sandbox="allow-scripts"
                    srcDoc={item.previewHtml}
                    className="h-44 w-full border-b border-slate-100 bg-white dark:border-slate-800"
                  />
                  <div className="flex flex-1 flex-col gap-1.5 p-3">
                    <div className="font-semibold">{item.title}</div>
                    <p className="flex-1 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
                      {item.when}
                    </p>
                    <button
                      onClick={() => toggle(item.id)}
                      className={`mt-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-[13px] font-semibold transition ${
                        on
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
                      }`}
                    >
                      {on ? <CheckIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
                      {on ? "เลือกแล้ว" : "ใช้แบบนี้"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* right: cart + prompt */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 font-semibold">
              <SparklesIcon className="h-5 w-5 text-emerald-500" />
              ตะกร้าสไตล์ ({selected.length})
            </div>

            <label htmlFor="egs-purpose" className="mt-3 block text-[13px] font-medium text-slate-600 dark:text-slate-300">
              อยากได้ระบบอะไร?
            </label>
            <input
              id="egs-purpose"
              name="purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="เช่น ระบบจองคิวร้านตัดผม"
              className="mt-1 w-full rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-300 dark:bg-slate-800 dark:ring-slate-700"
            />

            <div className="mt-3 flex items-center justify-between">
              <label htmlFor="egs-prompt" className="text-[13px] font-medium text-slate-600 dark:text-slate-300">
                คำสั่งที่จะส่งให้ AI (แก้ได้)
              </label>
              {dirty && (
                <button
                  onClick={() => setDirty(false)}
                  className="text-[11px] text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  ↺ สร้างใหม่จากที่เลือก
                </button>
              )}
            </div>
            <textarea
              id="egs-prompt"
              name="prompt"
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                setDirty(true);
              }}
              rows={7}
              className="mt-1 w-full resize-none rounded-xl bg-slate-50 px-3 py-2.5 text-[13px] leading-relaxed outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-300 dark:bg-slate-800 dark:ring-slate-700"
            />

            <button
              onClick={create}
              disabled={!prompt.trim() || creating}
              className="mt-3 w-full rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(16,185,129,0.35)] transition hover:bg-emerald-400 disabled:opacity-50"
            >
              {creating ? "กำลังสร้าง…" : loggedIn ? "สร้างโปรเจกต์ด้วยสไตล์นี้ →" : "เข้าสู่ระบบเพื่อเริ่มสร้าง"}
            </button>
            {!loggedIn && (
              <p className="mt-2 text-center text-[11px] text-slate-400">เลือกดูได้เลย — เข้าสู่ระบบตอนจะสร้างจริง</p>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
