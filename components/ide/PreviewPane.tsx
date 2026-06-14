"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowTopRightOnSquareIcon,
  CloudIcon,
  CommandLineIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import { useProjectStore, type FileEntry } from "@/store/useProjectStore";

/**
 * Preview = the Tier-1 SIMULATED render only (inline srcdoc iframe + console). The real GAS
 * web app (/dev) can't be embedded inline — Google blocks framing script.googleusercontent.com
 * and it needs the owner's login — so "run live" is an explicit action that pushes to a scratch
 * script and surfaces a click-to-open link (NOT a fake preview tab, NOT window.open which is
 * popup-blocked after an await).
 */
const INCLUDE_RE = /<\?!?=?\s*include\(\s*['"]([^'"]+)['"]\s*\)\s*\?>/g;

const SHIM = `<script>
(function(){
  function ser(a){try{return typeof a==='object'?JSON.stringify(a):String(a)}catch(e){return String(a)}}
  function post(level,args){try{parent.postMessage({__egs:1,level:level,text:Array.prototype.map.call(args,ser).join(' ')},'*')}catch(e){}}
  ['log','info','warn','error'].forEach(function(l){var o=console[l];console[l]=function(){post(l,arguments);if(o)o.apply(console,arguments)}});
  window.onerror=function(m,s,line,col){post('error',[m+' ('+line+':'+col+')']);return false};
  window.addEventListener('unhandledrejection',function(ev){post('error',['Unhandled: '+((ev.reason&&ev.reason.message)||ev.reason)])});
  var noop=function(){return g};var g=new Proxy(noop,{get:function(){return noop},apply:function(){return g}});
  window.google={script:{run:g,host:{close:noop,setHeight:noop},url:{}}};
})();
</script>`;

interface ConsoleLine {
  level: string;
  text: string;
}

function findContent(files: Record<string, FileEntry>, baseName: string): string {
  const lower = baseName.toLowerCase();
  for (const [path, f] of Object.entries(files)) {
    if (path.replace(/\.html$/i, "").toLowerCase() === lower) return f.content;
  }
  return "";
}

function buildSrcdoc(files: Record<string, FileEntry>): string | null {
  const index = files["Index.html"]?.content ?? findContent(files, "index");
  if (!index) return null;
  return SHIM + index.replace(INCLUDE_RE, (_m, name) => findContent(files, String(name)));
}

export function PreviewPane({ projectId }: { projectId: string }) {
  const files = useProjectStore((s) => s.files);
  const srcdoc = useMemo(() => buildSrcdoc(files), [files]);
  const [logs, setLogs] = useState<ConsoleLine[]>([]);
  const [liveBusy, setLiveBusy] = useState(false);
  const [liveErr, setLiveErr] = useState("");
  const [liveUrl, setLiveUrl] = useState("");

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      // sandboxed iframe (no allow-same-origin) posts from opaque origin "null"
      if (e.origin !== "null") return;
      const d = e.data;
      if (d && d.__egs === 1)
        setLogs((l) => [...l.slice(-50), { level: String(d.level ?? "log"), text: String(d.text ?? "") }]);
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  useEffect(() => setLogs([]), [srcdoc]);

  async function runLive() {
    setLiveBusy(true);
    setLiveErr("");
    setLiveUrl("");
    try {
      const r = await fetch(`/api/preview/${projectId}`, { method: "POST" });
      const data = await r.json();
      if (r.ok && data.devUrl) {
        // click-to-open link (window.open after await is popup-blocked)
        setLiveUrl(data.devUrl);
      } else if (data.error === "USER_SETTINGS_DISABLED") {
        setLiveErr("ต้องเปิด Apps Script API ที่ usersettings ก่อน");
      } else {
        setLiveErr("รันจริงไม่สำเร็จ: " + (data.error ?? "unknown"));
      }
    } catch {
      setLiveErr("เชื่อมต่อล้มเหลว");
    } finally {
      setLiveBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-100 text-emerald-600">
            <EyeIcon className="h-4 w-4" />
          </span>
          พรีวิว <span className="text-[11px] font-normal text-slate-400">(จำลอง)</span>
        </span>
        <button
          onClick={runLive}
          disabled={liveBusy}
          title="push โค้ดขึ้น Google แล้วเปิดแอปจริงในแท็บใหม่"
          className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12px] font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
        >
          <CloudIcon className="h-3.5 w-3.5" />
          {liveBusy ? "กำลัง push…" : "รันจริงบน Google"}
        </button>
      </div>

      {/* run-live result */}
      {liveUrl && (
        <div className="mb-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] leading-relaxed text-emerald-800">
          <a
            href={liveUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold underline"
          >
            เปิดแอปจริงบน Google <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
          </a>
          <p className="mt-1 text-emerald-700/80">
            ครั้งแรก Google จะขอให้คุณ (เจ้าของ) อนุญาตสิทธิ์ของสคริปต์ — กด Allow ครั้งเดียว แล้วใช้ได้เลย
          </p>
        </div>
      )}
      {liveErr && (
        <div className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
          {liveErr}
        </div>
      )}

      {/* Tier-1 simulated render */}
      {srcdoc ? (
        // SECURITY: never add allow-same-origin / allow-popups-to-escape-sandbox —
        // opaque-origin isolation is required for untrusted AI-generated content
        <iframe
          title="preview"
          sandbox="allow-scripts"
          className="min-h-0 flex-1 rounded-xl border border-slate-200 bg-white"
          srcDoc={srcdoc}
        />
      ) : (
        <div className="grid min-h-0 flex-1 place-items-center rounded-xl border border-dashed border-slate-200 px-6 text-center text-xs text-slate-400">
          พรีวิวจะขึ้นเมื่อ AI สร้าง Index.html
        </div>
      )}
      <p className="mt-1 px-1 text-[10px] leading-relaxed text-slate-400">
        จำลอง — ปุ่ม/ฟอร์มที่เรียก server (google.script.run) ยังกดใช้จริงไม่ได้ · กด &ldquo;รันจริงบน
        Google&rdquo; เพื่อทดสอบจริง
      </p>

      {/* console panel */}
      <div className="mt-2 h-28 overflow-auto rounded-xl bg-slate-900 p-2 font-mono text-[10.5px] leading-relaxed">
        <div className="mb-1 flex items-center gap-1 text-slate-500">
          <CommandLineIcon className="h-3.5 w-3.5" />
          Console
        </div>
        {logs.length === 0 ? (
          <div className="text-slate-600">— ยังไม่มี log —</div>
        ) : (
          logs.map((l, i) => (
            <div
              key={i}
              className={
                l.level === "error" ? "text-red-400" : l.level === "warn" ? "text-amber-400" : "text-slate-300"
              }
            >
              {l.text}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
