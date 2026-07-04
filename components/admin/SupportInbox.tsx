"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  ArrowTopRightOnSquareIcon,
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  PaperClipIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { EmojiPicker } from "@/components/support/EmojiPicker";
import { createClient } from "@/lib/supabase/client";

/**
 * Admin live-chat inbox (AdminPanel tab). Thread list + conversation pane.
 * List updates ride the private `support:admin-lobby` topic; the open thread
 * subscribes to its own `support:{userId}` topic. All writes go through
 * /api/admin/support/* (superadmin-gated).
 */

interface ThreadRow {
  userId: string;
  email: string | null;
  lastBody: string;
  lastSender: "user" | "admin";
  lastAt: string;
  unread: number;
}

interface ChatMessage {
  id: string;
  user_id: string;
  sender: "user" | "admin";
  body: string;
  project_id: string | null;
  created_at: string;
}

interface ProjectDetail {
  id: string;
  name: string;
  createdAt: string;
  deployedUrl: string | null;
  files: string[];
}

function timeLabel(iso: string): string {
  try {
    const d = new Date(iso);
    const today = new Date().toDateString() === d.toDateString();
    return today
      ? d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

export function SupportInbox() {
  const supabase = useMemo(() => createClient(), []);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [selected, setSelected] = useState<ThreadRow | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [projectNames, setProjectNames] = useState<Record<string, string>>({});
  const [detail, setDetail] = useState<ProjectDetail | "loading" | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selected?.userId ?? null;

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

  const openProjectDetail = useCallback(async (projectId: string) => {
    setDetail("loading");
    try {
      const res = await fetch(`/api/admin/support/project?id=${projectId}`);
      if (!res.ok) throw new Error(`detail failed (${res.status})`);
      const data = (await res.json()) as { project: ProjectDetail };
      setDetail(data.project);
    } catch (e) {
      console.error("[admin/support] project detail failed:", e);
      setDetail(null);
    }
  }, []);

  const refreshThreads = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/support/threads");
      if (res.ok) {
        const data = (await res.json()) as { threads: ThreadRow[] };
        setThreads(data.threads);
      }
    } catch {
      /* transient — next lobby ping retries */
    } finally {
      setLoading(false);
    }
  }, []);

  // Thread list + lobby subscription (pings on every incoming user message).
  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    void refreshThreads();
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session || cancelled) return;
      await supabase.realtime.setAuth(session.access_token);
      channel = supabase
        .channel("support:admin-lobby", { config: { private: true } })
        .on("broadcast", { event: "new_user_message" }, () => void refreshThreads())
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase, refreshThreads]);

  // The open conversation gets its own topic (both directions arrive here).
  useEffect(() => {
    if (!selected) return;
    const channel = supabase
      .channel(`support:${selected.userId}`, { config: { private: true } })
      .on("broadcast", { event: "new_message" }, ({ payload }) => {
        const m = payload as ChatMessage;
        if (!m?.id || m.user_id !== selectedRef.current) return;
        setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
        if (m.sender === "user") {
          // viewing the thread = reading it
          fetch(`/api/admin/support/messages?userId=${m.user_id}`).catch(() => {});
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, selected]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, selected]);

  const openThread = useCallback(async (t: ThreadRow) => {
    setSelected(t);
    setMessages([]);
    try {
      // GET also marks the thread read server-side
      const res = await fetch(`/api/admin/support/messages?userId=${t.userId}`);
      if (res.ok) {
        const data = (await res.json()) as {
          messages: ChatMessage[];
          projects?: Record<string, string>;
        };
        setMessages(data.messages);
        if (data.projects) setProjectNames((prev) => ({ ...prev, ...data.projects }));
      }
      setThreads((prev) => prev.map((x) => (x.userId === t.userId ? { ...x, unread: 0 } : x)));
    } catch {
      /* leave the pane empty; realtime still streams in */
    }
  }, []);

  const send = useCallback(async () => {
    const body = input.trim();
    if (!body || sending || !selected) return;
    setSending(true);
    try {
      const res = await fetch("/api/admin/support/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selected.userId, body }),
      });
      if (!res.ok) throw new Error(`send failed (${res.status})`);
      const data = (await res.json()) as { message: ChatMessage };
      setMessages((prev) =>
        prev.some((p) => p.id === data.message.id) ? prev : [...prev, data.message],
      );
      setInput("");
      if (inputRef.current) inputRef.current.style.height = "auto";
    } catch (e) {
      console.error("[admin/support] send failed:", e);
    } finally {
      setSending(false);
    }
  }, [input, sending, selected]);

  return (
    <div className="mt-6 flex h-[calc(100vh-14rem)] min-h-[24rem] overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700/60 dark:bg-slate-900">
      {/* thread list */}
      <div
        className={`w-full shrink-0 overflow-y-auto border-slate-200 md:w-72 md:border-r dark:border-slate-800 ${
          selected ? "hidden md:block" : ""
        }`}
      >
        {loading ? (
          <p className="p-6 text-center text-xs text-slate-400">กำลังโหลด…</p>
        ) : threads.length === 0 ? (
          <p className="p-6 text-center text-xs leading-relaxed text-slate-400">
            ยังไม่มีแชทจากลูกค้า — ข้อความจากผู้ใช้แพ็กเกจเสียเงินจะเด้งขึ้นที่นี่
          </p>
        ) : (
          threads.map((t) => (
            <button
              key={t.userId}
              type="button"
              onClick={() => void openThread(t)}
              className={`block w-full border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60 ${
                selected?.userId === t.userId ? "bg-emerald-50/60 dark:bg-emerald-950/30" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                  {t.email ?? t.userId.slice(0, 8)}
                </span>
                <span className="shrink-0 text-[10px] text-slate-400">{timeLabel(t.lastAt)}</span>
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-2">
                <span className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {t.lastSender === "admin" ? "คุณ: " : ""}
                  {t.lastBody}
                </span>
                {t.unread > 0 && (
                  <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {t.unread > 9 ? "9+" : t.unread}
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      {/* conversation */}
      <div className={`min-w-0 flex-1 flex-col ${selected ? "flex" : "hidden md:flex"}`}>
        {!selected ? (
          <div className="grid flex-1 place-items-center text-slate-300 dark:text-slate-600">
            <div className="text-center">
              <ChatBubbleLeftRightIcon className="mx-auto h-10 w-10" />
              <p className="mt-2 text-xs">เลือกแชทจากรายการซ้ายมือ</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="กลับไปรายการแชท"
                className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 md:hidden dark:hover:bg-slate-800"
              >
                <ArrowLeftIcon className="h-4 w-4" />
              </button>
              <p className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
                {selected.email ?? selected.userId}
              </p>
            </div>
            <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.sender === "admin" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                      m.sender === "admin"
                        ? "rounded-br-sm bg-emerald-500 text-white"
                        : "rounded-bl-sm bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                    }`}
                  >
                    {m.body}
                    {m.project_id && (
                      <button
                        type="button"
                        onClick={() => void openProjectDetail(m.project_id!)}
                        title="ดูรายละเอียดโปรเจกต์"
                        className={`mt-1 flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition ${
                          m.sender === "admin"
                            ? "border-emerald-300/60 text-emerald-50 hover:bg-emerald-400"
                            : "border-slate-300 text-slate-500 hover:bg-slate-200 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                        }`}
                      >
                        <PaperClipIcon className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {projectNames[m.project_id] ?? "โปรเจกต์ที่แนบมา"}
                        </span>
                      </button>
                    )}
                    <div
                      className={`mt-0.5 text-right text-[10px] ${
                        m.sender === "admin" ? "text-emerald-100" : "text-slate-400"
                      }`}
                    >
                      {timeLabel(m.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-end gap-1.5 border-t border-slate-100 p-2.5 dark:border-slate-800">
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
                placeholder="ตอบลูกค้า… (Enter ส่ง · Shift+Enter ขึ้นบรรทัดใหม่)"
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
          </>
        )}
      </div>

      {/* attached-project detail modal */}
      {detail !== null && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm"
          onClick={() => setDetail(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            {detail === "loading" ? (
              <p className="py-8 text-center text-sm text-slate-400">กำลังโหลดรายละเอียด…</p>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      <PaperClipIcon className="h-4 w-4 shrink-0 text-emerald-500" />
                      <span className="truncate">{detail.name}</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      สร้างเมื่อ {new Date(detail.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
                      {" · "}
                      <span className="font-mono">{detail.id.slice(0, 8)}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetail(null)}
                    aria-label="ปิด"
                    className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                {detail.deployedUrl ? (
                  <a
                    href={detail.deployedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                  >
                    <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                    เปิดเว็บแอปที่ deploy แล้ว
                  </a>
                ) : (
                  <p className="mt-3 text-xs text-slate-400">ยังไม่เคย deploy</p>
                )}

                <p className="mt-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  ไฟล์ในโปรเจกต์ ({detail.files.length})
                </p>
                <ul className="mt-1.5 max-h-40 space-y-0.5 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-2.5 font-mono text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
                  {detail.files.map((f) => (
                    <li key={f} className="truncate">{f}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
