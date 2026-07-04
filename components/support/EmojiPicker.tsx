"use client";

import { useEffect, useRef, useState } from "react";
import { FaceSmileIcon } from "@heroicons/react/24/outline";

/**
 * Tiny dependency-free emoji picker for the support chat composers (user widget
 * + admin inbox). A curated grid keeps the bundle small and works offline —
 * no external picker library (CSP blocks CDNs anyway).
 */

const EMOJI = [
  "😀", "😄", "😂", "🤣", "😊", "😍", "🥰", "😅",
  "😉", "🤔", "😢", "😭", "😡", "😱", "😴", "🥳",
  "🙏", "👍", "👎", "👌", "✌️", "💪", "👏", "🤝",
  "❤️", "💚", "🔥", "✨", "🎉", "🚀", "💡", "⭐",
  "✅", "❌", "⚠️", "📌", "📎", "⏰", "💰", "🐛",
];

interface EmojiPickerProps {
  onPick: (emoji: string) => void;
}

export function EmojiPicker({ onPick }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on any outside click/tap.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      {open && (
        <div className="absolute bottom-11 right-0 z-10 grid w-56 grid-cols-8 gap-0.5 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800">
          {EMOJI.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                onPick(e);
                setOpen(false);
              }}
              className="rounded-md p-0.5 text-lg leading-none transition hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              {e}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="แทรกอิโมจิ"
        aria-expanded={open}
        className="rounded-xl p-2.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
      >
        <FaceSmileIcon className="h-5 w-5" />
      </button>
    </div>
  );
}
