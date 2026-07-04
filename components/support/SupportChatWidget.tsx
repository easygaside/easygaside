"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatBubbleLeftRightIcon, PaperAirplaneIcon, PaperClipIcon, XMarkIcon } from "@heroicons/react/24/outline";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { EmojiPicker } from "./EmojiPicker";

/**
 * Floating live-chat widget (paid users only — rendered conditionally by the
 * server page, and the API re-checks the plan). History via /api/support/messages;
 * live delivery via Realtime Broadcast on the PRIVATE topic `support:{userId}`
 * (broadcast by a DB trigger, authorized by RLS on realtime.messages).
 */

interface ChatMessage {
  id: string;
  sender: "user" | "admin";
  body: string;
  project_id?: string | null;
  read_at?: string | null;
  created_at: string;
}

interface SupportChatWidgetProps {
  userId: string;
  /** Set inside the IDE so the message can carry which project it came from. */
  projectId?: string;
  /** Current project's name — shown on the attach chip + on attached bubbles. */
  projectName?: string;
  /** Plan display name (e.g. "Lite") — shown in the header as the perk's origin. */
  planLabel?: string;
}

function timeLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function SupportChatWidget({ userId, projectId, projectName, planLabel }: SupportChatWidgetProps) {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [attachProject, setAttachProject] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const openRef = useRef(false);
  openRef.current = open;

  // Grow the composer with its content (capped by max-h) so Shift+Enter lines stay visible.
  const autoGrow = useCallback(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 96)}px`;
  }, []);

  const insertEmoji = useCallback(
    (emoji: string) => {
      const ta = inputRef.current;
      const start = ta?.selectionStart ?? input.length;
      const end = ta?.selectionEnd ?? input.length;
      setInput(input.slice(0, start) + emoji + input.slice(end));
      requestAnimationFrame(() => {
        if (!ta) return;
        ta.focus();
        const pos = start + emoji.length;
        ta.setSelectionRange(pos, pos);
        autoGrow();
      });
    },
    [input, autoGrow],
  );

  const markRead = useCallback(() => {
    setUnread(0);
    fetch("/api/support/read", { method: "POST" }).catch(() => {});
  }, []);

  // Load history once + subscribe to the private thread topic.
  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/support/messages");
        if (res.ok) {
          const data = (await res.json()) as { messages: ChatMessage[] };
          if (cancelled) return;
          setMessages(data.messages);
          setUnread(data.messages.filter((m) => m.sender === "admin" && !m.read_at).length);
        }
      } catch {
        /* history is best-effort; live messages still arrive below */
      } finally {
        if (!cancelled) setLoaded(true);
      }

      // Private channels need the user's access token on the realtime connection.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session || cancelled) return;
      await supabase.realtime.setAuth(session.access_token);

      channel = supabase
        .channel(`support:${userId}`, { config: { private: true } })
        .on("broadcast", { event: "new_message" }, ({ payload }) => {
          const m = payload as ChatMessage;
          if (!m?.id) return;
          setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
          if (m.sender === "admin") {
            if (openRef.current) markRead();
            else setUnread((n) => n + 1);
          }
        })
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase, userId, markRead]);

  // Autoscroll to the newest message whenever the panel is open.
  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [open, messages]);

  const toggleOpen = useCallback(() => {
    setOpen((was) => {
      if (!was) markRead();
      return !was;
    });
  }, [markRead]);

  const send = useCallback(async () => {
    const body = input.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/support/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, projectId: attachProject ? projectId ?? null : null }),
      });
      if (!res.ok) throw new Error(`send failed (${res.status})`);
      const data = (await res.json()) as { message: ChatMessage };
      setMessages((prev) =>
        prev.some((p) => p.id === data.message.id) ? prev : [...prev, data.message],
      );
      setInput("");
      if (inputRef.current) inputRef.current.style.height = "auto";
    } catch (e) {
      console.error("[support] send failed:", e);
    } finally {
      setSending(false);
    }
  }, [input, sending, projectId, attachProject]);

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-5 z-40 flex h-[28rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 bg-emerald-500 px-4 py-3 dark:border-slate-800">
            <div>
              <p className="text-sm font-semibold text-white">แชทกับทีมงาน EasyGAS</p>
              <p className="text-[11px] text-emerald-50">
                {planLabel ? `สิทธิพิเศษแพ็กเกจ ${planLabel}` : "สิทธิพิเศษแพ็กเกจเสียเงิน"} — ตอบไวในเวลาทำการ
              </p>
            </div>
            <button
              type="button"
              onClick={toggleOpen}
              aria-label="ปิดหน้าต่างแชท"
              className="rounded-full p-1 text-emerald-100 transition hover:bg-emerald-400 hover:text-white"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
            {!loaded ? (
              <p className="pt-8 text-center text-xs text-slate-400">กำลังโหลด…</p>
            ) : messages.length === 0 ? (
              <p className="px-4 pt-8 text-center text-xs leading-relaxed text-slate-400">
                มีคำถามหรือติดตรงไหน พิมพ์มาได้เลย ทีมงานเห็นข้อความทันที
              </p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                      m.sender === "user"
                        ? "rounded-br-sm bg-emerald-500 text-white"
                        : "rounded-bl-sm bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                    }`}
                  >
                    {m.body}
                    {m.project_id && (
                      <div
                        className={`mt-1 flex items-center gap-1 text-[10px] ${
                          m.sender === "user" ? "text-emerald-100" : "text-slate-400"
                        }`}
                      >
                        <PaperClipIcon className="h-3 w-3 shrink-0" />
                        {m.project_id === projectId && projectName ? projectName : "แนบโปรเจกต์"}
                      </div>
                    )}
                    <div
                      className={`mt-0.5 text-right text-[10px] ${
                        m.sender === "user" ? "text-emerald-100" : "text-slate-400"
                      }`}
                    >
                      {timeLabel(m.created_at)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-slate-100 p-2.5 dark:border-slate-800">
            {projectId && projectName && (
              <button
                type="button"
                onClick={() => setAttachProject((v) => !v)}
                aria-pressed={attachProject}
                title={attachProject ? "กดเพื่อไม่แนบโปรเจกต์" : "กดเพื่อแนบโปรเจกต์ไปกับข้อความ"}
                className={`mb-2 inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                  attachProject
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "border-slate-200 bg-slate-50 text-slate-400 line-through dark:border-slate-700 dark:bg-slate-800"
                }`}
              >
                <PaperClipIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">แนบโปรเจกต์: {projectName}</span>
              </button>
            )}
            <div className="flex items-end gap-1.5">
              <EmojiPicker onPick={insertEmoji} />
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  autoGrow();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={1}
                placeholder="พิมพ์ข้อความ… (Enter ส่ง · Shift+Enter ขึ้นบรรทัดใหม่)"
                className="max-h-24 flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={sending || !input.trim()}
                aria-label="ส่งข้อความ"
                className="rounded-xl bg-emerald-500 p-2.5 text-white transition hover:bg-emerald-400 disabled:opacity-40"
              >
                <PaperAirplaneIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={toggleOpen}
        aria-label={open ? "ปิดแชทสด" : "เปิดแชทสดกับทีมงาน"}
        className="fixed bottom-6 right-5 z-40 rounded-full bg-emerald-500 p-3.5 text-white shadow-lg transition hover:bg-emerald-400 hover:shadow-xl"
      >
        <ChatBubbleLeftRightIcon className="h-6 w-6" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
    </>
  );
}
