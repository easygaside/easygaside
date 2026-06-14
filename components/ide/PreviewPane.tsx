"use client";

import { useEffect, useMemo, useState } from "react";
import { CommandLineIcon, EyeIcon } from "@heroicons/react/24/outline";
import { useProjectStore, type FileEntry } from "@/store/useProjectStore";

/**
 * Preview = the Tier-1 SIMULATED render only (inline srcdoc iframe + console shim).
 * The real GAS web app can't be embedded inline (Google blocks framing script.googleusercontent.com
 * and it needs the owner's login), so to run it for real use the Deploy button → open the /exec link.
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

export function PreviewPane() {
  const files = useProjectStore((s) => s.files);
  const srcdoc = useMemo(() => buildSrcdoc(files), [files]);
  const [logs, setLogs] = useState<ConsoleLine[]>([]);

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

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-100 text-emerald-600">
          <EyeIcon className="h-4 w-4" />
        </span>
        พรีวิว <span className="text-[11px] font-normal text-slate-400">(จำลอง)</span>
      </div>

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
        จำลอง — ปุ่ม/ฟอร์มที่เรียก server (google.script.run) ยังกดใช้จริงไม่ได้ · กด &ldquo;Deploy เข้า
        Google&rdquo; แล้วเปิดลิงก์ /exec เพื่อใช้จริง
      </p>

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
