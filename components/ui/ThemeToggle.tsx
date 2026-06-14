"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "@heroicons/react/24/outline";

/**
 * Toggles the `.dark` class on <html> and persists the choice. The initial class is set by the
 * no-flash script in app/layout.tsx; this only mirrors + flips it. Default theme is light.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* ignore storage errors */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="สลับโหมดมืด/สว่าง"
      title={dark ? "โหมดสว่าง" : "โหมดมืด"}
      className={`grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-200/70 dark:text-slate-400 dark:hover:bg-slate-700/60 ${className}`}
    >
      {dark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
    </button>
  );
}
