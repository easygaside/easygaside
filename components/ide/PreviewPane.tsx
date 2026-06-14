"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CommandLineIcon,
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import { useProjectStore, type FileEntry } from "@/store/useProjectStore";

const MOBILE_WIDTH = 390; // px — iPhone-ish viewport for the mobile preview

/**
 * Preview = the Tier-1 SIMULATED render only (inline srcdoc iframe + console shim).
 * The real GAS web app can't be embedded inline (Google blocks framing script.googleusercontent.com
 * and it needs the owner's login), so to run it for real use the Deploy button → open the /exec link.
 */
// `<?!= include('Stylesheet'); ?>` — GAS emits an optional trailing ; before ?>, so allow it.
const INCLUDE_RE = /<\?!?=?\s*include\(\s*['"]([^'"]+)['"]\s*\)\s*;?\s*\?>/g;
// any remaining GAS scriptlet (`<? … ?>`, `<?= … ?>`) — server-side templating we can't run inline.
const SCRIPTLET_RE = /<\?[\s\S]*?\?>/g;

const SHIM = `<script>
(function(){
  function ser(a){try{return typeof a==='object'?JSON.stringify(a):String(a)}catch(e){return String(a)}}
  function post(level,args){try{parent.postMessage({__egs:1,level:level,text:Array.prototype.map.call(args,ser).join(' ')},'*')}catch(e){}}
  ['log','info','warn','error'].forEach(function(l){var o=console[l];console[l]=function(){post(l,arguments);if(o)o.apply(console,arguments)}});
  window.onerror=function(m,s,line,col){post('error',[m+' ('+line+':'+col+')']);return false};
  window.addEventListener('unhandledrejection',function(ev){post('error',['Unhandled: '+((ev.reason&&ev.reason.message)||ev.reason)])});
  var noop=function(){};
  // google.script.run is stubbed in preview (no server). Log each server call so the console
  // shows activity and explains why data-loading "hangs" here — handlers never fire without deploy.
  var BUILDERS={withSuccessHandler:1,withFailureHandler:1,withUserObject:1};
  var runner=new Proxy({},{get:function(_,prop){
    return function(){
      if(BUILDERS[prop]) return runner;
      var a=Array.prototype.map.call(arguments,ser).join(', ');
      post('info',['google.script.run.'+String(prop)+'('+a+') — จำลอง: ต้อง Deploy ถึงจะดึงข้อมูลจริง']);
      return runner;
    };
  }});
  window.google={script:{run:runner,host:{close:noop,setHeight:noop},url:{}}};
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

/** Inline include()d partials (CSS/JS), resolving nested includes up to a small depth. */
function resolveIncludes(html: string, files: Record<string, FileEntry>, depth = 0): string {
  if (depth > 5) return html;
  let changed = false;
  const out = html.replace(INCLUDE_RE, (_m, name) => {
    changed = true;
    return findContent(files, String(name));
  });
  return changed ? resolveIncludes(out, files, depth + 1) : out;
}

function buildSrcdoc(files: Record<string, FileEntry>): string | null {
  const index = files["Index.html"]?.content ?? findContent(files, "index");
  if (!index) return null;
  // 1) inline included CSS/JS partials  2) drop leftover server-side scriptlets so the
  // real stylesheet renders (instead of vanishing because an include didn't resolve).
  const resolved = resolveIncludes(index, files).replace(SCRIPTLET_RE, "");
  return SHIM + resolved;
}

export function PreviewPane() {
  const files = useProjectStore((s) => s.files);
  const srcdoc = useMemo(() => buildSrcdoc(files), [files]);
  const [logs, setLogs] = useState<ConsoleLine[]>([]);
  const [view, setView] = useState<"desktop" | "mobile">("desktop");

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
      <div className="mb-2 flex items-center justify-between gap-2 text-sm font-semibold">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
            <EyeIcon className="h-4 w-4" />
          </span>
          พรีวิว <span className="text-[11px] font-normal text-slate-400 dark:text-slate-500">(จำลอง)</span>
        </div>
        {srcdoc && (
          <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5">
            <button
              onClick={() => setView("desktop")}
              title="จอปกติ"
              aria-label="มุมมองจอปกติ"
              aria-pressed={view === "desktop"}
              className={`grid h-6 w-7 place-items-center rounded-md transition ${
                view === "desktop" ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
              }`}
            >
              <ComputerDesktopIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("mobile")}
              title="มือถือ"
              aria-label="มุมมองมือถือ"
              aria-pressed={view === "mobile"}
              className={`grid h-6 w-7 place-items-center rounded-md transition ${
                view === "mobile" ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
              }`}
            >
              <DevicePhoneMobileIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {srcdoc ? (
        <div
          className={`min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700/60 ${
            view === "mobile" ? "grid place-items-start justify-center bg-slate-100 dark:bg-slate-800 p-3" : "bg-white dark:bg-slate-900"
          }`}
        >
          {/* SECURITY: never add allow-same-origin / allow-popups-to-escape-sandbox —
              opaque-origin isolation is required for untrusted AI-generated content */}
          <iframe
            title="preview"
            sandbox="allow-scripts"
            style={view === "mobile" ? { width: MOBILE_WIDTH, maxWidth: "100%" } : undefined}
            className={`bg-white ${
              view === "mobile"
                ? "h-full min-h-[560px] rounded-[1.25rem] border border-slate-300 dark:border-slate-700 shadow-lg"
                : "h-full w-full"
            }`}
            srcDoc={srcdoc}
          />
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 place-items-center rounded-xl border border-dashed border-slate-200 dark:border-slate-700/60 px-6 text-center text-xs text-slate-400 dark:text-slate-500">
          พรีวิวจะขึ้นเมื่อ AI สร้าง Index.html
        </div>
      )}

      <p className="mt-1 px-1 text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
        หน้าตา/CSS แสดงเหมือนจริง · แต่ปุ่ม/ฟอร์มที่เรียก server (google.script.run) และข้อมูลจากชีทยังจำลอง —
        กด &ldquo;Deploy เข้า Google&rdquo; แล้วเปิดลิงก์ /exec เพื่อใช้จริง
      </p>

      <div className="mt-2 h-28 overflow-auto rounded-xl bg-slate-900 p-2 font-mono text-[10.5px] leading-relaxed">
        <div className="mb-1 flex items-center gap-1 text-slate-500">
          <CommandLineIcon className="h-3.5 w-3.5" />
          Console
        </div>
        {logs.length === 0 ? (
          <div className="text-slate-600">— ยังไม่มี log — (จะโชว์ error และการเรียก server จากตัวอย่าง)</div>
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
