# easygas — QUALITY-MOAT: ทำให้ผลลัพธ์ "ใช้งานได้จริง" ไม่ใช่แค่ "AI เขียนโค้ดให้"

> จาก research workflow (2026-06-13). ตอบโจทย์ founder: ทำให้โค้ด *ทำงานได้จริง* + re-check best practices +
> ต่างจากแชต AI ทั่วไป (= จุดขาย) + ให้ผู้ใช้เลือก UI/เมนู

## สถานะ implement (2026-06-14)
- ✅ **Gate 0 — STATIC** `validateGasFiles` (`lib/gas-codegen.ts`) คืน `is_error` ในลูป tool-use → AI ซ่อมในเทิร์นเดิม (v1 regex; AST `lib/gas-lint.ts` ยังไม่ทำ)
- ✅ **Gate 1 — RULEBOOK CRITIC** `lib/critic.ts#reviewProject` (LLM-as-judge, sonnet 1 call) + auto-repair 1 รอบใน `lib/anthropic-agent.ts#runCriticGate` → emit ผ่าน `text`/`lint` (ไม่แตะ client)
- ⏳ **Gate 2 — DYNAMIC run-and-repair** (THE moat, §4) — ยังไม่ทำ (ต่อจาก scratch /dev ที่ `lib/deploy.ts#pushScratch` มีแล้ว)
- 🪝 **RAG** — seam `lib/retrieval.ts#retrieveContext` วางแล้ว (คืนค่าว่าง) — แผนเต็มใน [[RAG-DESIGN.md]]

## 1. moat ใน 1 ประโยค
ChatGPT/Claude และ builder ทั่วไป (bolt/v0/Lovable) **"เดา"** โค้ด GAS แล้วโยน text ให้ผู้ใช้ไป copy-paste/แก้ error/deploy เอง — **easygas เป็นเครื่องมือเดียวที่เขียน GAS ภายใต้ rulebook เฉพาะทาง → รันจริงบน Apps Script → จับ runtime error จริง → ซ่อมในลูปปิด → deploy เข้า Google ผู้ใช้คลิกเดียว แล้วเรียนรู้จากทุกงานที่รันผ่าน**

moat ไม่ใช่ "เราใช้ Claude" (ลอกได้ใน 1 สัปดาห์) — moat คือ **closed verification loop + คลังโซลูชัน GAS ที่พิสูจน์แล้วว่ารันได้จริง** ที่ลอกไม่ได้โดยโครงสร้าง: bolt/v0/Lovable รันบน Node/WebContainer ซึ่ง **รัน .gs ไม่ได้เลย**; chat AI ไม่มี project/token ของผู้ใช้ — มันได้แค่เดา

## 2. สถาปัตยกรรมชั้นคุณภาพ (เรียงถูก/เร็วก่อน → แพง/ช้าสุดท้าย)
```
ผู้ใช้เลือกใน Guided Wizard / Template Gallery (§5)
   ▼ [เก็บ KEY SPEC]  egs_projects.spec (jsonb) ← spec ที่ไว้ re-check output
   ▼ [CODEGEN] Claude + tool-use, prompt = rulebook(cached) + spec contract + style-kit + few-shot(verified corpus)
   ╔══ ด่านตรวจในลูป tool-use ══╗
   ▼ GATE 0 — STATIC ~0ms (upgrade validateGasFiles): scope-lock / web-app struct / manifest-scope-match /
   │          leading-zero / date-TH + spec-conformance → FAIL = tool_result is_error:true → model ซ่อมในเทิร์นเดิม
   ▼ GATE 1 — RULEBOOK CRITIC (Claude ถูก 1 call, LLM-as-judge): จับสิ่งที่ static ไม่เห็น (LockService, try/catch,
   │          quota) → {pass, violations[]} — เป็น pre-filter best-practice เท่านั้น ไม่ใช่คำตัดสิน "รันได้"
   ▼ GATE 2 — DYNAMIC รันจริง = moat: push scratch → web app fetch /dev / function scripts.run(devMode) →
   │          จับ error จริง → feed กลับ (สรุปแล้ว) → ซ่อม วน N≤3
   ╚════════════════════════════╝
   ▼ [SHOW USER] ป้าย "✓ ทดสอบรันจริงผ่าน" + ปุ่ม deploy เข้า Google ผู้ใช้
```
ทั้ง 3 gate เป็น `tool_result` ในลูป tool-use เดิม. Gate 2 feed **error สรุปแล้ว** ไม่ใช่ log ดิบ (กัน context pollution). **bound ลูปซ่อม N=2-3** (งานวิจัย arXiv 2503.12374: agent วนไม่จำกัดจะ "ซ่อมโดยลบสิ่งที่ fail ทิ้ง") — ครบ cap → surface error จริงต่อผู้ใช้อย่างซื่อสัตย์ ไม่ ship งาน fail เงียบ

## 3. STATIC checks ที่ทำได้ทันที (lib/gas-lint.ts)
**Implement: hybrid AST + regex** — parser `acorn`+`acorn-walk` (`{ecmaVersion:2020, sourceType:"script"}` → import/export กลายเป็น parse error = สัญญาณว่าไม่ใช่ GAS, จับใน <5ms ไม่เสีย API). `.html` strip `<?!= include() ?>` แล้วดึง `<script>` มา parse แยก

- **A. Scope-lock (error):** `no-fetch` `no-node-fs` `no-modules` `no-process-env` `no-timers` `no-frameworks`
- **B. Web-app struct (error/warn, multi-file):** `require-doget` `doget-returns-htmloutput` `require-xframe-allowall` (สำคัญต่อ preview) `dopost-guard-json` `html-include-pattern` `no-clientside-fetch`(→google.script.run)
- **C. Manifest↔services match (error, ที่ linter ทั่วไปทำไม่ได้):** map service→scope (SpreadsheetApp→spreadsheets, MailApp→gmail.send, DriveApp→drive.file...) diff กับ `oauthScopes`. missing=error+suggest scope เป๊ะ, over-permission=warn (สำคัญต่อ OAuth verification)
- **D. Date (warn/error):** `no-toisostring`(→Utilities.formatDate Asia/Bangkok) `no-moment-dayjs` `require-timezone-manifest`
- **E. Leading-zero (warn heuristic):** ชื่อ match `/phone|tel|เบอร์|โทร|mobile|idcard/i` setValue ไม่มี `setNumberFormat('@')` → warn

Output: `lintGasFiles(files,{isWebApp,isBound}) → {errors, warnings}`, `LintIssue={fileId,line,ruleId,message(ไทย),fix?}`. ใน `executeEgsTool` หลัง write/edit: `errors.length>0` → `is_error:true`; warning = gutter annotation

## 4. DYNAMIC run-and-repair (จุดที่ลอกยากสุด) — lib/gas-verify-run.ts
**ทำได้เพราะ** scratch script อยู่ใต้ OAuth client + standard GCP project เดียวของ easygas → ปลดล็อก scripts.run + อ่าน Cloud Logging ได้

**3 ช่องจับ runtime failure:**
1. **Web HTTP probe (PRIMARY web app, ถูกสุด):** fetch `/dev` → classify ("Script function not found", 500+error page, wrong return type, 200=ผ่าน). *ไม่มี stack/line → คู่กับ Channel 3*
2. **scripts.run (PRIMARY function, ช่องเดียวคืน error sync):** deploy api_executable → `scripts.run({function,devMode:true})` → fail = HTTP 200 + `{error:{details:[{errorType,errorMessage,scriptStackTraceElements:[{function,lineNumber}]}]}}` = **ทองคำ** ได้ type+message+line เป๊ะ
3. **Cloud Logging `entries.list`** (`resource.type="app_script_function" AND severity>=ERROR`, ต้องมี `logging.read`+standard project): eventually-consistent → **poll สั้น 4 ครั้ง ~6-8s** key `timestamp>=run_start`
> กับดัก: `processes.listScriptProcesses` คืนแค่ status (RUNNING/FAILED/TIMED_OUT) **ไม่มี error/stack** → ใช้แค่ดูว่า fail ไหม แล้วดึงข้อความที่ Channel 3

**ลูปปิด:** lint → push(updateContent) → deploy/PATCH(id เดิม กัน cap 20) → run → detect+extract → feed tool_result(is_error) "RUNTIME ERROR ใน Code.gs:42 — TypeError... Stack: doGet→loadData" → repair → GOTO lint. cap N=3-4, ครบ → surface error สุดท้าย

**scope รัน** (`script.scriptapp`, `script.processes`, `logging.read` + union) = additive → อยู่บน **internal scratch identity ของ easygas เอง** ไม่ใช่ grant ผู้ใช้ → scope contract ลูกค้ายังลีน (verify ได้). **MVP = Channel 1+3 (web app)** ไม่ต้องเพิ่ม `script.scriptapp`; Channel 2 ทีหลังสำหรับ pure function

## 5. Guided UX — ถาม/ให้เลือก
**Ambiguity Gate (classifier ถูกก่อนเข้า loop) 3 เลน:** GENERATE NOW (ชัดแล้ว แต่ยัง emit spec) / QUICK CONFIRM (1 จอ) / GUIDED WIZARD (default non-coder). **Hard cap ≤5 คำถาม, 1 decision/จอ, ทุกจอมีปุ่ม "ข้ามไป ให้ AI เลือกให้"**

**Wizard 5 ขั้น (แตะการ์ด):** ① ใช้ทำอะไร (ฟอร์ม/จอง/ส่งเมล/แดชบอร์ด/ใบเสร็จ→drives template) ② เก็บที่ไหน+ช่องอะไร (chip มี type-tag: `☎️ เบอร์โทร` = auto-flip กฎ `@`+getDisplayValue) ③ ใครใช้ (ทีม/ลูกค้า/ล็อกอิน→drives scope) ④ ต้องการอะไรเพิ่ม (เมล/PDF/Drive/trigger→drives scope+helper) ⑤ หน้าตาแบบไหน→Style Picker → จบด้วยการ์ด "สรุปสิ่งที่จะสร้าง" + "✨ สร้างเลย"

**KEY SPEC (`egs_projects.spec` jsonb) ทำ 3 หน้าที่:** (a) constrain codegen (inject เป็น hard contract) (b) ขับ re-check `checkSpecConformance(spec,files)` (ครบทุก field? phone ได้ `@`? มี handler ต่อ output?) (c) seed runner (`outputs:["confirmation_email"]` บอกรันฟังก์ชันไหน)

**Style Picker — 4 ทิศชัด (ไม่ใช่ "เลือกสีอะไรก็ได้"):** `clean_form` ฟอร์มสะอาด / `dashboard` แดชบอร์ด / `card_list` รายการการ์ด / `thai_receipt` ใบเสร็จไทย + sub เมนู (แท็บบน/เมนูข้าง/หน้าเดียว→Alpine view-switcher)
**map → fixed design-token CSS:** `lib/style-kits/{kit}/` มี `tokens.css.html` (custom props), `layout.html`, `components.md` (คลาสที่ใช้ได้), `alpine-init.html`. prompt: **"ใช้ได้เฉพาะคลาส/token ที่ระบุ ห้ามสร้างคลาสใหม่/ใส่สีตรงๆ"** → on-brand + deterministic + token น้อย

**Template Gallery (เริ่มจาก project ที่รันเขียวแล้ว):** MVP 3 ตัว — 📅 จองคิว (bound+เมล+trigger), 📋 ฟอร์ม+PDF (public+leading-zero), 📧 ส่งเมลจาก Sheet (quota+LockService). เลือก = pre-load spec → ข้าม wizard → สั่งแก้ต่อ

**ทำไมลด error+token:** spec + token vocab + verified seed บีบ degrees of freedom ของ model จาก "ออกแบบ+architect+code" เหลือ "เติม data/logic ลงโครงที่รู้แล้ว"

## 6. Flywheel ข้อมูล
ทุก generation ที่ **รันเขียว+deploy จริง** = โซลูชัน GAS ติด label "พิสูจน์แล้ว" — chat AI ทิ้งสัญญาณนี้เพราะไม่มี ground-truth oracle
```
spec → Generate (rulebook + few-shot จาก verified corpus) → Static gate → Execute จริง
  error → Repair (stack จริง) + log failure mode → เขียว → Deploy → Capture {spec,files,ran_green,edits_to_fix}
  → Compound: (1) run ดี → curated template (2) failure ซ้ำ → rulebook entry ใหม่ (3) index → few-shot รอบถัดไป
```
**moat ทบต้น:** corpus โตได้เพราะ easygas **รันจริง**; ลูกค้าทุกคนทำให้สินค้าดีขึ้นวัดได้สำหรับคนถัดไป; คู่แข่ง bootstrap ไม่ได้ถ้าไม่มี real-execution oracle. **KPI ติดผนัง: "first-run-green rate"** (% ที่รันผ่านโดยไม่ต้องซ่อม) ควรไต่ขึ้น monotonic. Privacy: เก็บแค่ pattern/spec + snippet anonymized, opt-in

## 7. MVP vs ทีหลัง (impact-per-effort, solo founder)
**ลำดับ build:** ① Gate 0 `lintGasFiles` คืน is_error (ถูก/yield สูงสุด ship ก่อน) ② **Tier-S real-execution repair = Channel 1+3 (THE moat)** ③ golden-snippet RAG + cached rulebook/few-shot (ดัน first-pass) ④ Gate 1 rubric-critic ⑤ Guided UX (Ambiguity Gate + wizard + spec + Style Picker + style-kits + 3 template + spec-conformance re-check)

**Defer:** Channel 2 scripts.run (pure function) · user-editable brand color · community template · spec→assertion เต็ม — แต่ **ออกแบบ field `outputs`/pass-criteria ใน spec ไว้ตั้งแต่ตอนนี้**
**ข้ามเลย (overkill):** constrained-decoding GAS body · repo-graph RAG · RL/fine-tune · multi-agent judge panel · ไล่ bit-determinism (execution loop ทำให้ไม่สำคัญ — verify behavior ไม่ใช่ string)

## 8. Positioning (วิธีพูดขาย)
**vs bolt/v0/Lovable:** *"เขาสร้างเว็บไซต์ — easygas สร้างระบบอัตโนมัติที่รันธุรกิจคุณใน Google Sheets/Drive/Gmail/LINE แล้วพิสูจน์ให้เห็นว่ารันได้ก่อนคุณจะไว้ใจ"* — ครอง niche Google Workspace + Thai-SMB ที่เขาตามไม่ได้
**Headline:** *"ไม่ใช่แค่ AI เขียนโค้ดให้ — เรารันจริงให้ดูก่อนว่าใช้งานได้"* — นำด้วยป้าย **"✓ ทดสอบแล้วใช้งานได้จริง"** ไม่ใช่ "powered by Claude". Show ไม่ใช่ claim (เห็นรันบน Apps Script จริง + live /exec URL ในบัญชีตัวเอง). โปร่งใสตอนซ่อม ("พบ error → แก้แล้ว → รันผ่าน"). ปักหมุดความเจ็บ: *"เคยให้ ChatGPT เขียน GAS แล้วก๊อปไปวางแล้ว error / deploy ไม่เป็น?"*
**ซื่อสัตย์:** รับประกัน **"verify ว่ารันเขียวบน Apps Script + deploy ขึ้น live URL"** ไม่ใช่ "render ใน inline preview" (preview /dev เป็น best-effort)

## ไฟล์ที่เกี่ยวข้อง
rulebook `F:\KPPromptCreator\gas_mode_proposal.md` · validator ที่จะ extend `F:\KPPromptCreator\KPPromptCreator\lib\gas-codegen.js` (L75-131) · `docs/BUILDPLAN.md` (Gate 0 = G8 Phase 2, Channel-run = Phase 6/7) · `lib/gas-script-api.ts` · `lib/google-connection.ts` · **โค้ดใหม่:** `lib/gas-lint.ts`, `lib/gas-verify-run.ts`, `egs_projects.spec` jsonb, `lib/style-kits/{clean-form,dashboard,card-list,thai-receipt}/`, `checkSpecConformance(spec,files)`
