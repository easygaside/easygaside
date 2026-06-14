"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  PhotoIcon,
  SparklesIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useProjectStore } from "@/store/useProjectStore";
import { compressImage, type CompressedImage } from "@/lib/client/image-compress";
import { GuidedWizard } from "./GuidedWizard";

const MAX_IMAGES = 4;

interface ProjectSpec {
  title: string;
  summary: string;
  features: string[];
  dataModel?: string[];
  storage?: string;
  outputs?: string[];
}

// mirror of lib/anthropic-agent AgentEvent (defined locally to avoid pulling server-only code)
type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "tool_call"; name: string; input: unknown }
  | { type: "file_mutation"; op: "write" | "edit" | "delete"; path: string; content?: string }
  | { type: "lint"; messages: string[] }
  | { type: "spec"; spec: ProjectSpec }
  | { type: "done" }
  | { type: "error"; message: string };

interface ChatMsg {
  role: "user" | "assistant";
  text: string;
  images?: string[]; // data: URLs for local preview
}

const TOOL_LABEL: Record<string, string> = {
  write_file: "กำลังเขียนไฟล์",
  edit_file: "กำลังแก้ไฟล์",
  delete_file: "กำลังลบไฟล์",
  read_project: "กำลังอ่านโปรเจกต์",
};

const SUGGESTIONS = [
  "ฟอร์มจองคิว บันทึกลง Sheet ส่งอีเมลยืนยัน",
  "ระบบเช็คสต๊อกสินค้า ตัด/เพิ่มสต๊อก",
  "ส่งอีเมลอัตโนมัติจากรายชื่อใน Google Sheet",
  "แดชบอร์ดสรุปยอดขายรายวัน",
];

export function ChatPanel({ projectId }: { projectId: string }) {
  const applyMutation = useProjectStore((s) => s.applyMutation);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [pendingSpec, setPendingSpec] = useState<ProjectSpec | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [images, setImages] = useState<CompressedImage[]>([]);
  const [attaching, setAttaching] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo(0, bodyRef.current.scrollHeight);
  }, [messages, status, images]);

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow re-picking the same file
    if (picked.length === 0) return;
    const slots = MAX_IMAGES - images.length;
    if (slots <= 0) return;
    setAttaching(true);
    try {
      const next: CompressedImage[] = [];
      for (const file of picked.slice(0, slots)) {
        if (!file.type.startsWith("image/")) continue;
        try {
          next.push(await compressImage(file));
        } catch {
          /* skip an unreadable image */
        }
      }
      if (next.length) setImages((cur) => [...cur, ...next].slice(0, MAX_IMAGES));
    } finally {
      setAttaching(false);
    }
  }

  function appendAssistant(t: string) {
    setMessages((m) => {
      const c = [...m];
      const last = c[c.length - 1];
      if (last?.role === "assistant") c[c.length - 1] = { role: "assistant", text: last.text + t };
      return c;
    });
  }

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    // staged images attach only to a composer send (no explicit text arg from chips/spec/wizard)
    const attached = text === undefined ? images : [];
    if ((!msg && attached.length === 0) || busy) return;
    if (text === undefined) {
      setInput("");
      setImages([]);
    }
    setBusy(true);
    setStatus("");
    setPendingSpec(null);
    setMessages((m) => [
      ...m,
      { role: "user", text: msg, images: attached.map((a) => a.dataUrl) },
      { role: "assistant", text: "" },
    ]);

    try {
      const res = await fetch(`/api/agent/${projectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          images: attached.map((a) => ({ dataBase64: a.dataBase64, mediaType: a.mediaType })),
        }),
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
          else if (ev.type === "spec") setPendingSpec(ev.spec);
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
      <div className="flex items-center gap-2 px-4 pt-3 text-sm font-semibold">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-violet-100 text-violet-600">
          <ChatBubbleLeftRightIcon className="h-4 w-4" />
        </span>
        AI Assistant
      </div>
      <div className="flex flex-wrap gap-1.5 px-3 py-2">
        <button
          onClick={() => send("อธิบายว่าโค้ดในโปรเจกต์นี้ทำงานยังไง แบบสรุปสั้น ๆ เป็นข้อ ๆ")}
          disabled={busy}
          className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] text-slate-500 transition hover:border-emerald-300 hover:text-emerald-600 disabled:opacity-50"
        >
          อธิบายโค้ด
        </button>
        <button
          onClick={() =>
            send("ตรวจโค้ดทั้งหมดหาบั๊กและจุดที่ไม่ตรง best practice ของ Google Apps Script แล้วแก้ให้เรียบร้อย")
          }
          disabled={busy}
          className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] text-slate-500 transition hover:border-emerald-300 hover:text-emerald-600 disabled:opacity-50"
        >
          ตรวจ &amp; แก้บั๊ก
        </button>
      </div>

      <div ref={bodyRef} className="flex-1 space-y-3 overflow-auto px-3 pb-2">
        {messages.length === 0 && (
          <div className="px-1 pt-6">
            <p className="text-center text-[13px] text-slate-400">
              พิมพ์บอกสิ่งที่อยากได้ หรือเริ่มจากตัวอย่าง
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  disabled={busy}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-[12px] text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50/50 disabled:opacity-50"
                >
                  <SparklesIcon className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  {s}
                </button>
              ))}
            </div>
            <button
              onClick={() => setWizardOpen(true)}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50/50 px-3 py-2.5 text-[12px] font-medium text-emerald-700 transition hover:bg-emerald-50"
            >
              <SparklesIcon className="h-3.5 w-3.5" />
              ใช้ตัวช่วยแบบเลือก (ไกด์ทีละขั้น)
            </button>
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
              className={`rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                m.role === "user"
                  ? "self-start bg-slate-100 text-slate-700"
                  : "bg-emerald-50 text-slate-700"
              }`}
            >
              {m.images && m.images.length > 0 && (
                <div className="mb-1.5 flex flex-wrap gap-1.5">
                  {m.images.map((src, j) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={j}
                      src={src}
                      alt="รูปแนบ"
                      className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
                    />
                  ))}
                </div>
              )}
              <span className="whitespace-pre-wrap">
                {m.text || (busy && i === messages.length - 1 ? "…" : "")}
              </span>
            </div>
          </div>
        ))}

        {pendingSpec && (
          <div className="rounded-2xl border border-emerald-200 bg-white p-3.5 shadow-sm">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700">
              <SparklesIcon className="h-4 w-4" />
              สรุปสิ่งที่จะสร้าง
            </div>
            <p className="mt-1.5 text-[13px] font-semibold text-slate-800">{pendingSpec.title}</p>
            {pendingSpec.summary && <p className="text-[12px] text-slate-500">{pendingSpec.summary}</p>}
            {pendingSpec.features.length > 0 && (
              <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[12px] text-slate-600">
                {pendingSpec.features.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            )}
            {pendingSpec.dataModel && pendingSpec.dataModel.length > 0 && (
              <p className="mt-2 text-[11px] text-slate-500">ข้อมูล: {pendingSpec.dataModel.join(" · ")}</p>
            )}
            {pendingSpec.storage && (
              <p className="text-[11px] text-slate-500">เก็บที่: {pendingSpec.storage}</p>
            )}
            {pendingSpec.outputs && pendingSpec.outputs.length > 0 && (
              <p className="text-[11px] text-slate-500">ผลลัพธ์: {pendingSpec.outputs.join(" · ")}</p>
            )}
            <button
              onClick={() => send("ยืนยัน สร้างเลยตาม spec ที่สรุปไว้")}
              disabled={busy}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2 text-[13px] font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
            >
              <SparklesIcon className="h-4 w-4" />
              สร้างเลย
            </button>
            <p className="mt-1.5 text-center text-[11px] text-slate-400">หรือพิมพ์บอกสิ่งที่อยากแก้</p>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200/70 p-3">
        {/* live status — what the AI is doing right now */}
        {busy && (
          <div className="mb-2 flex items-center gap-2 px-1 text-xs font-medium text-emerald-600">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            {status || "AI กำลังคิด…"}
          </div>
        )}

        {/* staged image attachments (≤4) */}
        {(images.length > 0 || attaching) && (
          <div className="mb-2 flex flex-wrap gap-2 px-1">
            {images.map((img, i) => (
              <div key={i} className="group relative h-14 w-14">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.dataUrl}
                  alt="รูปแนบ"
                  className="h-14 w-14 rounded-lg border border-slate-200 object-cover"
                />
                <button
                  onClick={() => setImages((cur) => cur.filter((_, j) => j !== i))}
                  aria-label="เอารูปออก"
                  className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-slate-700 text-white shadow transition hover:bg-red-500"
                >
                  <XMarkIcon className="h-3 w-3" />
                </button>
              </div>
            ))}
            {attaching && (
              <div className="grid h-14 w-14 place-items-center rounded-lg border border-dashed border-slate-300 text-slate-400">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
              </div>
            )}
          </div>
        )}

        <div className="flex items-end gap-2 rounded-2xl bg-slate-50 px-2.5 py-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            onChange={onPickFiles}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy || images.length >= MAX_IMAGES}
            title={images.length >= MAX_IMAGES ? `แนบได้สูงสุด ${MAX_IMAGES} รูป` : "แนบรูปอ้างอิง"}
            aria-label="แนบรูป"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-200 hover:text-slate-600 disabled:opacity-40"
          >
            <PhotoIcon className="h-5 w-5" />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="บอกสิ่งที่อยากให้ AI สร้างหรือแก้… แนบรูปอ้างอิงได้&#10;Enter = ส่ง · Shift+Enter = ขึ้นบรรทัดใหม่"
            disabled={busy}
            rows={3}
            className="min-h-[72px] flex-1 resize-none bg-transparent text-[13px] leading-relaxed outline-none placeholder:text-slate-400 disabled:opacity-60"
          />
          <button
            onClick={() => send()}
            disabled={busy || (!input.trim() && images.length === 0)}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-500 text-white disabled:opacity-50"
            aria-label="ส่ง"
          >
            <PaperAirplaneIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <GuidedWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onComplete={(msg) => {
          setWizardOpen(false);
          send(msg);
        }}
      />
    </div>
  );
}
