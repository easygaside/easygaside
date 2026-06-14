"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowTopRightOnSquareIcon,
  BoltIcon,
  CloudIcon,
  CommandLineIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import { useProjectStore, type FileEntry } from "@/store/useProjectStore";

/**
 * Tier-1: inline GAS includes + render Index.html in a sandboxed srcdoc iframe with a console
 * shim (captures console.* + window.onerror, posts to parent) and a no-op google.script.run.
 * Tier-2: push to a scratch script and open the live /dev URL on Google (best-effort, opens new tab).
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
  const [tier, setTier] = useState<"sim" | "live">("sim");
  const [logs, setLogs] = useState<ConsoleLine[]>([]);
  const [liveBusy, setLiveBusy] = useState(false);
  const [liveMsg, setLiveMsg] = useState("");

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
    setLiveMsg("");
    try {
      const r = await fetch(`/api/preview/${projectId}`, { method: "POST" });
      const data = await r.json();
      if (r.ok && data.devUrl) {
        window.open(data.devUrl, "_blank", "noopener");
        setLiveMsg("เปิดแอปจริงในแท็บใหม่แล้ว (ต้อง login บัญชี Google ที่เชื่อมไว้)");
      } else if (data.error === "USER_SETTINGS_DISABLED") {
        setLiveMsg("ต้องเปิด Apps Script API ที่ usersettings ก่อน");
      } else {
        setLiveMsg("รันจริงไม่สำเร็จ: " + (data.error ?? " unknown"));
      }
    } catch {
      setLiveMsg("เชื่อมต่อล้มเหลว");
    } finally {
      setLiveBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-100 text-emerald-600">
            <EyeIcon className="h-4 w-4" />
          </span>
          พรีวิว
        </span>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5 text-[11px]">
          <button
            onClick={() => setTier("sim")}
            className={`rounded-md px-2.5 py-1 ${tier === "sim" ? "bg-white font-semibold text-emerald-600 shadow-sm" : "text-slate-500"}`}
          >
            <span className="flex items-center gap-1">
              <BoltIcon className="h-3.5 w-3.5" />
              จำลอง
            </span>
          </button>
          <button
            onClick={() => setTier("live")}
            className={`rounded-md px-2.5 py-1 ${tier === "live" ? "bg-white font-semibold text-emerald-600 shadow-sm" : "text-slate-500"}`}
          >
            <span className="flex items-center gap-1">
              <CloudIcon className="h-3.5 w-3.5" />
              รันจริง
            </span>
          </button>
        </div>
      </div>

      {tier === "sim" ? (
        <>
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
        </>
      ) : (
        <div className="grid min-h-0 flex-1 place-items-center rounded-xl border border-dashed border-slate-200 p-6 text-center">
          <div className="flex flex-col items-center gap-3">
            <p className="text-xs text-slate-500">
              push ขึ้น Google แล้วเปิดแอปจริงในแท็บใหม่
              <br />
              (ต้อง login บัญชี Google ที่เชื่อมไว้)
            </p>
            <button
              onClick={runLive}
              disabled={liveBusy}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {liveBusy ? (
                "กำลัง push…"
              ) : (
                <>
                  <CloudIcon className="h-4 w-4" />
                  รันจริงบน Google
                  <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                </>
              )}
            </button>
            {liveMsg && <p className="text-xs text-slate-500">{liveMsg}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
