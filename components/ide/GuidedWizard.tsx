"use client";

import { useState } from "react";
import { ArrowLeftIcon, SparklesIcon, XMarkIcon } from "@heroicons/react/24/outline";

/**
 * Guided Wizard (QUALITY-MOAT §5) — 5 tap-card steps that compose a structured request, then hand
 * off to the normal chat flow (which does spec-first → confirm → generate). Every step can be
 * skipped ("ให้ AI เลือกให้"). Step 5 is the Style Picker.
 */

interface WizardProps {
  open: boolean;
  onClose: () => void;
  onComplete: (message: string) => void;
}

const STEPS = ["ใช้ทำอะไร", "เก็บข้อมูลอะไร", "ใครใช้", "ต้องการอะไรเพิ่ม", "หน้าตาแบบไหน"];
const PURPOSES = ["ฟอร์มเก็บข้อมูล", "ระบบจอง / นัดหมาย", "ส่งอีเมล / แจ้งเตือน", "แดชบอร์ด / รายงาน"];
const AUDIENCES = ["ทีมงานภายใน", "ลูกค้า / บุคคลทั่วไป", "ต้องล็อกอิน Google"];
const EXTRAS = ["ส่งอีเมลยืนยัน", "สร้าง PDF", "บันทึกไฟล์ลง Drive", "ตั้งเวลา / แจ้งเตือนอัตโนมัติ"];
const STYLES = ["ฟอร์มสะอาด", "แดชบอร์ด", "รายการการ์ด", "ใบเสร็จ / เอกสารไทย"];

function CardGroup({
  options,
  value,
  onChange,
  multi,
  values,
  onToggle,
}: {
  options: string[];
  value?: string;
  onChange?: (v: string) => void;
  multi?: boolean;
  values?: string[];
  onToggle?: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((o) => {
        const active = multi ? values?.includes(o) : value === o;
        return (
          <button
            key={o}
            type="button"
            onClick={() => (multi ? onToggle?.(o) : onChange?.(o === value ? "" : o))}
            className={`rounded-xl border px-3 py-3 text-left text-[13px] transition ${
              active
                ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 font-medium text-emerald-700 dark:text-emerald-300"
                : "border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700"
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

export function GuidedWizard({ open, onClose, onComplete }: WizardProps) {
  const [step, setStep] = useState(0);
  const [purpose, setPurpose] = useState("");
  const [fields, setFields] = useState("");
  const [audience, setAudience] = useState("");
  const [extras, setExtras] = useState<string[]>([]);
  const [style, setStyle] = useState("");

  if (!open) return null;

  function reset() {
    setStep(0);
    setPurpose("");
    setFields("");
    setAudience("");
    setExtras([]);
    setStyle("");
  }
  function close() {
    reset();
    onClose();
  }
  function finish() {
    const lines = ["สร้างระบบ Google Apps Script ตามนี้:"];
    if (purpose) lines.push(`- ประเภท: ${purpose}`);
    if (fields.trim()) lines.push(`- ข้อมูลที่เก็บ: ${fields.trim()}`);
    if (audience) lines.push(`- ผู้ใช้: ${audience}`);
    if (extras.length) lines.push(`- ฟีเจอร์เพิ่ม: ${extras.join(", ")}`);
    if (style) lines.push(`- สไตล์หน้าตา: ${style}`);
    lines.push("ช่วยสรุปเป็น spec ให้ยืนยันก่อนได้เลย");
    const msg = lines.join("\n");
    reset();
    onComplete(msg);
  }

  const last = step === STEPS.length - 1;
  const next = () => (last ? finish() : setStep((s) => s + 1));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-2">
          <SparklesIcon className="h-5 w-5 text-emerald-500" />
          <b className="text-sm">ตัวช่วยสร้างระบบ</b>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            ขั้น {step + 1}/{STEPS.length}
          </span>
          <span className="flex-1" />
          <button onClick={close} className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200" aria-label="ปิด">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 flex gap-1">
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-emerald-400" : "bg-slate-200 dark:bg-slate-700"}`} />
          ))}
        </div>

        <h3 className="mb-3 text-lg font-bold">{STEPS[step]}</h3>

        {step === 0 && <CardGroup options={PURPOSES} value={purpose} onChange={setPurpose} />}
        {step === 1 && (
          <div>
            <input
              value={fields}
              onChange={(e) => setFields(e.target.value)}
              placeholder="เช่น ชื่อ, เบอร์โทร, วันที่, จำนวน"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700/60 dark:bg-slate-900 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-300"
            />
            <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">พิมพ์ช่องข้อมูลคั่นด้วยจุลภาค (หรือกดข้ามให้ AI เลือก)</p>
          </div>
        )}
        {step === 2 && <CardGroup options={AUDIENCES} value={audience} onChange={setAudience} />}
        {step === 3 && <CardGroup options={EXTRAS} multi values={extras} onToggle={(x) => setExtras((e) => (e.includes(x) ? e.filter((v) => v !== x) : [...e, x]))} />}
        {step === 4 && <CardGroup options={STYLES} value={style} onChange={setStyle} />}

        <div className="mt-6 flex items-center gap-2">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm text-slate-500 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              ย้อน
            </button>
          )}
          <span className="flex-1" />
          <button onClick={next} className="rounded-xl px-3 py-2 text-sm text-slate-400 dark:text-slate-500 transition hover:text-slate-600 dark:hover:text-slate-300">
            ข้ามไป ให้ AI เลือกให้
          </button>
          <button
            onClick={next}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400"
          >
            {last ? (
              <>
                <SparklesIcon className="h-4 w-4" />
                สร้างเลย
              </>
            ) : (
              "ถัดไป"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
