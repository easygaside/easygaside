"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowPathIcon,
  BeakerIcon,
  BoltIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  FolderIcon,
  MagnifyingGlassIcon,
  RocketLaunchIcon,
  Squares2X2Icon,
  SwatchIcon,
} from "@heroicons/react/24/outline";
import { useProjectStore } from "@/store/useProjectStore";

type Group = "ไฟล์" | "คำสั่ง" | "ไปที่";
type Pane = "chat" | "code" | "preview";

interface Cmd {
  id: string;
  label: string;
  hint?: string;
  group: Group;
  icon: typeof RocketLaunchIcon;
  run: () => void;
}

/** flip the .dark class the same way ThemeToggle does (kept in sync with localStorage) */
function toggleTheme() {
  const next = !document.documentElement.classList.contains("dark");
  document.documentElement.classList.toggle("dark", next);
  try {
    localStorage.setItem("theme", next ? "dark" : "light");
  } catch {
    /* ignore storage errors */
  }
}

/**
 * ⌘K / Ctrl+K command palette. Files + the main IDE actions in one searchable list.
 * It owns no business logic: file jumps go through the store, and the component-owned actions
 * (deploy / re-check / open /dev / re-deploy) are dispatched via `requestAction` and run by their
 * real owners — so a command only appears when its owner is actually available (files exist,
 * deployed, Google connected). Keyboard: ↑/↓ to move, Enter to run, Esc to close.
 */
export function CommandPalette({
  googleConnected,
  deployed,
  onJumpPane,
}: {
  googleConnected: boolean;
  deployed: boolean;
  onJumpPane?: (pane: Pane) => void;
}) {
  const router = useRouter();
  const open = useProjectStore((s) => s.paletteOpen);
  const setOpen = useProjectStore((s) => s.setPaletteOpen);
  const order = useProjectStore((s) => s.order);
  const setActive = useProjectStore((s) => s.setActive);
  const runAgent = useProjectStore((s) => s.runAgent);
  const requestAction = useProjectStore((s) => s.requestAction);

  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // global ⌘K / Ctrl+K toggles the palette — but let Monaco keep its own Ctrl+K chord while editing
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        const el = document.activeElement as HTMLElement | null;
        if (el?.closest?.(".monaco-editor")) return;
        e.preventDefault();
        setOpen(!useProjectStore.getState().paletteOpen);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  // fresh query + focus every time it opens
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSel(0);
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  const hasFiles = order.length > 0;

  const commands = useMemo<Cmd[]>(() => {
    const list: Cmd[] = [];
    for (const p of order) {
      list.push({
        id: `file:${p}`,
        label: p,
        group: "ไฟล์",
        icon: DocumentTextIcon,
        run: () => {
          setActive(p);
          onJumpPane?.("code");
        },
      });
    }
    if (hasFiles) {
      list.push({
        id: "deploy",
        label: "Deploy เข้า Google",
        hint: "อัปโหลดขึ้นบัญชี Google ของคุณ",
        group: "คำสั่ง",
        icon: RocketLaunchIcon,
        run: () => (googleConnected ? requestAction("deploy") : router.push("/connect")),
      });
      list.push({
        id: "recheck",
        label: "ให้ AI ตรวจซ้ำ",
        hint: "ตรวจโค้ดเทียบกับกฎของระบบ",
        group: "คำสั่ง",
        icon: ArrowPathIcon,
        run: () => requestAction("recheck"),
      });
      list.push({
        id: "verify",
        label: "ทดสอบรันจริง",
        hint: "เปิดแอปจริงแล้วซ่อมให้ถ้าเจอปัญหา",
        group: "คำสั่ง",
        icon: BeakerIcon,
        run: () => {
          runAgent("verify");
          onJumpPane?.("chat");
        },
      });
    }
    if (deployed) {
      list.push({
        id: "openDev",
        label: "เปิด /dev (โค้ดล่าสุด)",
        hint: "ดูเวอร์ชันล่าสุดโดยไม่ต้อง deploy",
        group: "คำสั่ง",
        icon: BoltIcon,
        run: () => requestAction("openDev"),
      });
      list.push({
        id: "redeploy",
        label: "deploy ใหม่ (ลิงก์เดิม)",
        hint: "อัปเดตเวอร์ชันทับลิงก์ /exec เดิม",
        group: "คำสั่ง",
        icon: ArrowPathIcon,
        run: () => requestAction("redeploy"),
      });
    }
    list.push({
      id: "theme",
      label: "สลับธีม สว่าง / มืด",
      group: "ไปที่",
      icon: SwatchIcon,
      run: toggleTheme,
    });
    list.push({
      id: "settings",
      label: "ตั้งค่า",
      group: "ไปที่",
      icon: Cog6ToothIcon,
      run: () => router.push("/settings"),
    });
    list.push({
      id: "projects",
      label: "โปรเจกต์ทั้งหมด / สร้างใหม่",
      group: "ไปที่",
      icon: FolderIcon,
      run: () => router.push("/projects"),
    });
    list.push({
      id: "ideas",
      label: "หาไอเดีย / เลือกสไตล์",
      group: "ไปที่",
      icon: Squares2X2Icon,
      run: () => router.push("/styleshopping"),
    });
    return list;
  }, [order, hasFiles, deployed, googleConnected, setActive, runAgent, requestAction, router, onJumpPane]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.hint?.toLowerCase().includes(q),
    );
  }, [commands, query]);

  // keep selection in range as the filter narrows, and scroll it into view
  useEffect(() => setSel((s) => Math.min(s, Math.max(filtered.length - 1, 0))), [filtered.length]);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  if (!open) return null;

  function close() {
    setOpen(false);
  }

  function runCmd(c: Cmd | undefined) {
    if (!c) return;
    close();
    c.run();
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runCmd(filtered[sel]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-900/40 px-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={close}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_24px_60px_rgba(40,50,90,0.28)] dark:border-slate-700/70 dark:bg-slate-900"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 dark:border-slate-800">
          <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSel(0);
            }}
            onKeyDown={onInputKey}
            placeholder="ค้นหาไฟล์ หรือสั่งงาน…"
            className="flex-1 bg-transparent py-3.5 text-[14px] text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          <span className="rounded border border-slate-200 px-1.5 font-mono text-[10px] text-slate-400 dark:border-slate-700 dark:text-slate-500">
            esc
          </span>
        </div>

        <div className="max-h-[52vh] overflow-auto py-1.5">
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-slate-400 dark:text-slate-500">
              ไม่พบรายการที่ตรงกับ &ldquo;{query}&rdquo;
            </p>
          ) : (
            filtered.map((c, i) => {
              const Icon = c.icon;
              const isActive = i === sel;
              const showHeader = i === 0 || filtered[i - 1].group !== c.group;
              return (
                <div key={c.id}>
                  {showHeader && (
                    <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      {c.group}
                    </p>
                  )}
                  <button
                    ref={isActive ? activeRef : null}
                    onMouseEnter={() => setSel(i)}
                    onClick={() => runCmd(c)}
                    className={`flex w-full items-center gap-3 px-4 py-2 text-left transition ${
                      isActive
                        ? "bg-emerald-50 dark:bg-emerald-950/40"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        isActive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"
                      }`}
                    />
                    <span
                      className={`min-w-0 flex-1 truncate text-[13.5px] ${
                        c.group === "ไฟล์" ? "font-mono" : "font-medium"
                      } ${isActive ? "text-emerald-800 dark:text-emerald-200" : "text-slate-700 dark:text-slate-200"}`}
                    >
                      {c.label}
                    </span>
                    {c.hint && (
                      <span className="hidden shrink-0 truncate text-[11px] text-slate-400 dark:text-slate-500 sm:block">
                        {c.hint}
                      </span>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-slate-100 px-4 py-2 text-[10.5px] text-slate-400 dark:border-slate-800 dark:text-slate-500">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-slate-200 px-1 font-mono dark:border-slate-700">↑</kbd>
            <kbd className="rounded border border-slate-200 px-1 font-mono dark:border-slate-700">↓</kbd>
            เลื่อน
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-slate-200 px-1 font-mono dark:border-slate-700">↵</kbd>
            เลือก
          </span>
          <span className="ml-auto flex items-center gap-1">
            <kbd className="rounded border border-slate-200 px-1 font-mono dark:border-slate-700">⌘K</kbd>
            เปิด/ปิด
          </span>
        </div>
      </div>
    </div>
  );
}
