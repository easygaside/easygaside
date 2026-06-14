"use client";

import { useEffect, useRef, useState } from "react";
import { ChatBubbleLeftRightIcon, PaperAirplaneIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { useProjectStore } from "@/store/useProjectStore";

// mirror of lib/anthropic-agent AgentEvent (defined locally to avoid pulling server-only code)
type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "tool_call"; name: string; input: unknown }
  | { type: "file_mutation"; op: "write" | "edit" | "delete"; path: string; content?: string }
  | { type: "lint"; messages: string[] }
  | { type: "done" }
  | { type: "error"; message: string };

interface ChatMsg {
  role: "user" | "assistant";
  text: string;
}

const TOOL_LABEL: Record<string, string> = {
  write_file: "กำลังเขียนไฟล์",
  edit_file: "กำลังแก้ไฟล์",
  delete_file: "กำลังลบไฟล์",
  read_project: "กำลังอ่านโปรเจกต์",
};

export function ChatPanel({ projectId }: { projectId: string }) {
  const applyMutation = useProjectStore((s) => s.applyMutation);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo(0, bodyRef.current.scrollHeight);
  }, [messages, status]);

  function appendAssistant(t: string) {
    setMessages((m) => {
      const c = [...m];
      const last = c[c.length - 1];
      if (last?.role === "assistant") c[c.length - 1] = { role: "assistant", text: last.text + t };
      return c;
    });
  }

  async function send() {
    const msg = input.trim();
    if (!msg || busy) return;
    setInput("");
    setBusy(true);
    setStatus("");
    setMessages((m) => [...m, { role: "user", text: msg }, { role: "assistant", text: "" }]);

    try {
      const res = await fetch(`/api/agent/${projectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const frames = buf.split("\n\n");
        buf = frames.pop() ?? "";
        for (const frame of frames) {
          const line = frame.trim();
          if (!line.startsWith("data:")) continue;
          let ev: AgentEvent;
          try {
            ev = JSON.parse(line.slice(5).trim());
          } catch {
            continue;
          }
          if (ev.type === "text") appendAssistant(ev.delta);
          else if (ev.type === "tool_call") setStatus(`${TOOL_LABEL[ev.name] ?? ev.name}…`);
          else if (ev.type === "file_mutation")
            applyMutation({ op: ev.op, path: ev.path, content: ev.content });
          else if (ev.type === "lint") setStatus(ev.messages.join(" · "));
          else if (ev.type === "error") appendAssistant(`\n\n[ผิดพลาด: ${ev.message}]`);
          else if (ev.type === "done") setStatus("");
        }
      }
    } catch {
      appendAssistant("\n\n[เชื่อมต่อล้มเหลว — ลองใหม่อีกครั้ง]");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-3 text-sm font-semibold">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-violet-100 text-violet-600">
          <ChatBubbleLeftRightIcon className="h-4 w-4" />
        </span>
        แชตกับ AI
      </div>

      <div ref={bodyRef} className="flex-1 space-y-3 overflow-auto px-3 pb-2">
        {messages.length === 0 && (
          <div className="px-1 pt-8 text-center text-sm text-slate-400">
            พิมพ์บอกสิ่งที่อยากได้ เช่น<br />
            <span className="text-slate-500">&ldquo;ระบบจองคิว บันทึกลง Sheet ส่งอีเมลยืนยัน&rdquo;</span>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className="flex flex-col gap-1">
            <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">
              {m.role === "user" ? (
                "คุณ"
              ) : (
                <>
                  <SparklesIcon className="h-3 w-3" />
                  easygas AI
                </>
              )}
            </span>
            <div
              className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                m.role === "user"
                  ? "self-start bg-slate-100 text-slate-700"
                  : "bg-emerald-50 text-slate-700"
              }`}
            >
              {m.text || (busy && i === messages.length - 1 ? "…" : "")}
            </div>
          </div>
        ))}
        {status && <div className="px-1 text-xs text-emerald-600">{status}</div>}
      </div>

      <div className="border-t border-slate-200/70 p-3">
        <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
            placeholder="พิมพ์บอก AI…"
            disabled={busy}
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-slate-400 disabled:opacity-60"
          />
          <button
            onClick={send}
            disabled={busy}
            className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500 text-white disabled:opacity-50"
          >
            <PaperAirplaneIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
