# easygas — ข้อเสนอสถาปัตยกรรม (จาก multi-agent research workflow, 2026-06-13)

> "VS Code + Claude Code บนเว็บ" เฉพาะทาง Google Apps Script — ผู้ใช้ล็อกอิน Google account ตัวเอง →
> คุยกับ AI → AI เขียนโค้ดในเอดิเตอร์ → พรีวิวสด → กดปุ่ม deploy เข้าบัญชี Google ผู้ใช้อัตโนมัติ

## คำตอบสั้น: "Ship B, design toward C"

สร้าง easygas เป็น **หน้าใหม่บนเว็บ KPPromptCreator เดิม** (Vanilla JS + Vercel + Supabase) เพื่อไปถึง
loop ที่ขายได้เร็วที่สุด แต่ยืมแนวคิดหลัก 2 อย่างจาก Approach C (Next.js greenfield) มาใส่ตั้งแต่วันแรก
— server-applied mutation echo ผ่าน SSE + tool-use edit loop — เพื่อให้ migrate ไป Next.js 15 ภายหลังไม่เจ็บ
ตัด Approach A (fork bolt.diy) ทิ้ง เพราะ WebContainers รัน GAS server code ไม่ได้

**คะแนนกรรมการ: B 39 > C 36 > A 31**

Insight ที่ verify จากโค้ดจริง: "สมอง" ที่ reuse ได้คือแค่ 3 ฟังก์ชัน framework-agnostic (~130 บรรทัดใน
`lib/gas-codegen.js`) ส่วนงานยากจริง 60% (Google OAuth grant, เข้ารหัส token, Apps Script REST push/deploy,
กำแพง usersettings 403) **ยังไม่มีในรีโปเลย** และต้องเขียนใหม่เท่ากันทั้ง 3 approach → การแข่งจึงเหลือแค่
"ต้นทุนของ shell" ซึ่ง B ถึง loop เดียวกันด้วยพื้นผิวใหม่น้อยสุด

---

## สถาปัตยกรรม

### Stack
- **Frontend:** Vanilla JS static site บน Vercel — เพิ่ม `public/easygas.html` + ES modules `public/easygas/*.js` ไม่ต้องมี bundler
- **Editor:** Monaco ผ่าน ESM CDN (`monaco-editor@0.52/+esm`) + GAS completion provider
- **Backend:** Vercel serverless `api/easygas/*.js` (Node 18+)
- **DB/Auth:** Supabase Postgres + RLS; session ใช้ JWT เดิม (`lib/auth.js`) — ไม่สร้าง login ใหม่
- **AI:** Anthropic Messages API ผ่าน fetch (ขยาย `callClaudeAPI` ให้รองรับ system + messages[] + streaming + tool-use)
- **Google:** *ใหม่* — Apps Script REST API (`https://script.googleapis.com/v1`) เรียกฝั่ง server ด้วย OAuth token ผู้ใช้ ไม่ใช้ clasp binary

### Component map
```
 BROWSER  (easygas.html — Vanilla JS ES modules)
 ┌────────────────────────────────────────────────────────────────────┐
 │  ChatPanel.js        EditorPane.js (Monaco)      PreviewPane.js      │
 │  - stream AI turns   - file tabs + tree          - Tier1 <iframe     │
 │  - render diffs      - dirty tracking              srcdoc> + shim    │
 │       │                    │                     - Tier2 <iframe /dev>│
 │       └─────────┬──────────┴───────────┬───────────────┘            │
 │           ProjectStore.js (single source of truth, pub/sub)          │
 │           Map<filename,{content,dirty,model}> + messages[] + meta    │
 └──────────────────────────│──────────────────────────────────────────┘
        HTTPS (Bearer = app JWT จาก lib/auth.js)
 ┌──────────────────────────▼──────────────────────────────────────────┐
 │  VERCEL SERVERLESS  /api/easygas/*                                    │
 │  chat.js (SSE)         ── Anthropic: system+history+tool-use          │
 │  project.js            ── CRUD projects/files/messages (supabaseAdmin)│
 │  oauth/google-start.js · oauth/google-callback.js  (auth-code flow)   │  *ใหม่
 │  deploy.js             ── lib/gas-script-api.js (REST-direct)         │  *ใหม่
 │  preview-resolve.js    ── Tier1 server-fn mock/interpret              │
 │       │ reuse: lib/gas-codegen.js · lib/auth.js · lib/supabase.js     │
 └───────┬───────────────────────────────────────┬──────────────────────┘
         ▼                                         ▼
  SUPABASE (Postgres+RLS)            GOOGLE  script.googleapis.com  (user token)
  egs_projects/files/messages/        projects.create/updateContent/versions
  deployments + customer_oauth_tokens .deployments  + script.google.com/.../dev
         ▲                                  (Tier2 iframe)
  ANTHROPIC api.anthropic.com (server-side, key ไม่หลุดออก Vercel)
```

**หลักการสำคัญ:** server เป็นเจ้าของ "ความจริง" ของไฟล์ (`egs_files`) — agent mutate ฝั่ง server แล้ว
echo การเปลี่ยนแปลงแต่ละครั้งกลับมาทาง SSE (`{type:'file.write', name, content}`) ให้ client reducer
อัปเดต ProjectStore → Monaco อ่านใหม่ → file tree re-render ทิศทางเดียว ไม่มี drift

### Data model (`egs_*` ใหม่)
```sql
egs_projects (id, user_id, name,
  script_id,            -- Apps Script project (ใน Drive ผู้ใช้)
  deployment_id,        -- deployment ที่ PATCH ทับตลอด ห้ามสร้างใหม่ (cap 20/script)
  web_app_exec_url,     -- /exec (published)
  web_app_dev_url,      -- /dev (Tier2 preview)
  github_repo, manifest_scopes[],
  status check(draft|previewing|deployed|archived))

egs_files (id, project_id, name, content, updated_at, UNIQUE(project_id, name))
egs_messages (id, project_id, role check(user|assistant), content jsonb, changed_files text[], created_at)
egs_deployments (id, project_id, kind check(preview_head|published), version_number, web_app_url, files_snapshot jsonb, result jsonb)
```
RLS owner-scoped; เขียนผ่าน `supabaseAdmin`. **OAuth token: reuse `customer_oauth_tokens` แต่บังคับเข้ารหัส AES-256-GCM** (ปัจจุบันเก็บ plaintext — regression ที่ต้องปิด)

### AI editing loop (hybrid)
- **Turn 0 (สร้าง) = full regen:** `buildCodegenPrompt()` ย้ายเข้า `system` param + `cache_control: ephemeral` → Claude คืน `=== FILE ===` ทั้งชุด → `parseCodegenOutput()` → `validateGasFiles()` เป็น lint gate → insert
- **Turn N (แก้) = tool-use:** `write_file(name,content)` / `edit_file(name,old_str,new_str)` / `delete_file(name)` / `read_project()` → apply ฝั่ง server → echo SSE → re-validate → tool_result เข้า loop จน `stop_reason ≠ tool_use` → diff ด้วย Monaco DiffEditor (review-before-push)

---

## 3 ส่วนยากที่สุด & วิธีแก้

### (a) Live preview — 2 ชั้น
GAS รันในเบราว์เซอร์ไม่ได้ (เป็น service ฝั่ง Google) ดังนั้น:
- **Tier 1 "จำลอง" (default, <50ms, ไม่เรียก Google):** resolve `<?!= include('CSS') ?>` → inline + inject shim `google.script.run` (Proxy ดัก server fn → postMessage หา parent) → `<iframe srcdoc>`. Resolve server call แบบไล่ระดับ: mocks JSON (instant) → (post-MVP) รัน `.gs` ใน Web Worker stub `SpreadsheetApp`/`Utilities` ที่จำลอง bug leading-zeros + timezone Asia/Bangkok ← จุดที่ easygas ชนะ. **ความปลอดภัย:** origin แยก + `sandbox="allow-scripts"` (ห้าม `allow-same-origin`) + postMessage lock origin สองทาง
- **Tier 2 "รันบน Google จริง" (on demand, 2-4s, แม่น 100%):** scratch script 1 อัน/ผู้ใช้ → auto-inject `setXFrameOptionsMode(ALLOWALL)` ใน doGet → `updateContent` (PUT HEAD ไม่ต้อง version/deploy) → iframe `…/macros/s/{SCRIPT_ID}/dev`. **ข้อจำกัด:** `/dev` เปิดได้เฉพาะเจ้าของที่ login Google นั้น → scratch ต้องสร้างด้วย token ผู้ใช้; frame พัง → overlay "เปิดในแท็บใหม่"

### (b) Auto-deploy ไม่ใช้ server-side clasp — REST ตรง
clasp เป็นแค่ wrapper ของ REST API นี้ สร้าง `lib/gas-script-api.js`:
```
toApiFiles(files):  Code.gs→{name:'Code',type:'SERVER_JS'}  Index.html→{name:'Index',type:'HTML'}
                    appsscript.json→{name:'appsscript',type:'JSON'}
ครั้งแรก:  POST /projects {title}                              → scriptId  (ไม่มี parentId = standalone)
           PUT  /projects/{scriptId}/content {files:[...]}     (ส่ง full set เสมอ)
           POST /projects/{scriptId}/versions {description}    → versionNumber
           POST /projects/{scriptId}/deployments {versionNumber, manifestFileName:'appsscript'}
              → entryPoints[].webApp.url + deploymentId
ถัดไป:     PUT content → POST version →
           PATCH /projects/{scriptId}/deployments/{deploymentId} {deploymentConfig:{...versionNumber:ใหม่}}
```
**กฎ critical:** (1) PATCH ทับ deployment เดิมเสมอ ห้ามสร้างใหม่ (cap 20/script + URL เปลี่ยน); (2) manifest ต้องมี `webapp:{access:'ANYONE_ANONYMOUS', executeAs:'USER_DEPLOYING'}` + `timeZone:'Asia/Bangkok'` + `runtimeVersion:'V8'`. Tier 2 preview ใช้แค่ step `updateContent`→`/dev` = plumbing เดียวกับ deploy

### (c) Google OAuth scopes + verification
**2 ชั้น auth แยกกัน:** login easygas = JWT เดิม; Google grant = auth-code flow ใหม่แยก (ปุ่ม "เชื่อมต่อ Google Apps Script")

| Scope | ใช้ทำ |
|---|---|
| `script.projects` | create + updateContent (push, Tier-2) |
| `script.deployments` | versions + deployments (publish) |
| `openid`/`userinfo.email`/`userinfo.profile` | ระบุตัวผู้ใช้ |
| `drive.file` | optional, scope Drive แคบสุด |

ขอ `access_type=offline&prompt=consent` (ได้ refresh token) + เข้ารหัส AES-256-GCM. **ห้ามขอ full `drive`** — scope runtime ของ tool ที่สร้าง อยู่ใน `appsscript.json` ของ tool เอง consent แยกโดยผู้เปิดแอป.
**verification:** `script.projects`+`script.deployments` = sensitive → unverified app จำกัด 100 ผู้ใช้ → ship unverified ไปก่อน, verify ตอนใกล้ชน cap. Developer-side: เปิด `script.googleapis.com` ใน GCP project ของคุณ

---

## ของเดิม reuse ได้จาก KPPromptCreator

**ยกมา verbatim ("สมอง"):** `lib/gas-codegen.js` → `buildCodegenPrompt()` (L8, ย้ายเข้า system + cache), `parseCodegenOutput()` (L75, regex `/^={3,}\s*(.+?)\s*={3,}\s*$/gm` verify แล้ว), `validateGasFiles()` (L103) · `lib/auth.js` (HS256 JWT + scrypt) · `lib/supabase.js` (supabaseAdmin)

**reference (อ่านแล้วเขียนใหม่):** `api/gas-codegen/generate.js` (shape `callClaudeAPI`) · `lib/gas-zip-builder.js` (ลำดับ clasp = spec ของ REST + เก็บ ZIP installer เป็น escape hatch) · `migrations/20260525_03_add_gas_builder_tables.sql` (`customer_oauth_tokens` reuse + เพิ่มเข้ารหัส)

**rulebook (เสริม prompt + seed autocomplete):** `~/.claude/skills/gas-best-practices/` · `F:/KPPromptCreator/gas_mode_proposal.md`

**ต้องสร้างใหม่ทั้งหมด:** Google OAuth grant + token refresh, เข้ารหัส AES-GCM, `lib/gas-script-api.js`, multi-turn chat (system+cache+tool-use+SSE), conversation persistence, file-tree/Monaco sync, preview 2 tier

---

## MVP v0.1
1. หน้า easygas + login JWT เดิม
2. ปุ่ม "เชื่อมต่อ Google Apps Script" (OAuth grant + เก็บ token เข้ารหัส) + onboarding กำแพง usersettings 403
3. ChatPanel multi-turn (Turn 0 full-regen + Turn N tool-use) streaming SSE
4. Monaco + file tabs/tree + dirty tracking + autosave + diff view
5. Tier 1 instant preview (srcdoc + shim + static mocks)
6. Deploy REST-direct → โชว์ URL `/exec` สด + ปุ่ม "เปิดแอปของฉัน"
7. Persistence รอด reload

**Defer:** Tier 1b Worker interpreter · Tier 2 `/dev` preview · GitHub mirror · OAuth verification · multi-project dashboard · bound scripts · GAS autocomplete

---

## Roadmap
- **Phase 0 — De-risking spike (ทำก่อนเขียน UI):** สคริปต์เล็ก OAuth code-exchange → encrypted token → `script.googleapis.com` create/updateContent/version/deployment → URL `/exec` สดบนบัญชีคุณเอง + ดัก usersettings 403 → พิสูจน์ว่า premise เป็นไปได้
- **Phase 1** — schema `egs_*` + RLS + project CRUD
- **Phase 2** — multi-turn chat (system+cache, tool-use, SSE, reuse parse/validate)
- **Phase 3** — Monaco IDE shell (file tree/tabs, ProjectStore pub/sub, diff)
- **Phase 4** — Tier 1 preview
- **Phase 5** — Deploy button → MVP ครบ
- **Phase 6** — Tier 2 true preview
- **Phase 7** — fidelity (Worker interpreter) + GitHub mirror + ZIP fallback
- **Phase 8** — migrate to Next.js 15 (C) + OAuth verification (deploy engine/encryption/brain/preview port ตรง ไม่เสียเปล่า)

---

## ความเสี่ยง
1. **usersettings 403 (#1):** ทุก user ต้องเปิด Apps Script API ที่ `script.google.com/home/usersettings` ก่อน ไม่งั้น 403 ทั้งหมด เลี่ยงไม่ได้ → walkthrough ไทย + GIF + ปุ่ม "ลองอีกครั้ง" + เก็บ flag + ZIP installer เป็นทางออก
2. **Tier 2 `/dev` เปราะ** (owner-only, multi-login, จอ login Google ตั้ง X-Frame deny) → Tier 1 เป็น default, overlay "เปิดแท็บใหม่"
3. **Plaintext token รั่ว** → block MVP ที่ port AES-GCM ของ kpbeautyclinic
4. **iframe sandbox escape** → origin แยก, ห้าม allow-scripts+allow-same-origin พร้อมกัน, postMessage lock origin
5. **State drift / max_tokens truncation** → server mutation echo SSE + tool-use edit (ไม่ full-regen หลัง Turn 0) + snapshot undo
6. **Quotas:** cap 20 deployments/script → PATCH ทับ; Vercel timeout (Hobby 10s/Pro 60s) → SSE stream + Pro tier; token อายุ 1 ชม. → refresh ก่อน batch

---

## คำถามตัดสินใจก่อนเริ่ม
1. easygas อยู่ใต้ KPPromptCreator เดิม หรือแยกโดเมน/รีโป?
2. target user — ใช้เอง/ทีม หรือลูกค้าภายนอกหลายคน? (กระทบความเร่งด่วน verification + 100-user cap)
3. ขอบเขต GAS v0.1 — standalone web app อย่างเดียว หรือรวม bound script (Sheet/trigger)?
4. โมเดล AI + งบ token — Sonnet default + Opus เฉพาะ turn architect?
5. Tier 2 preview เป็น MVP หรือ fast-follow?

**บรรทัดล่างสุด:** Phase 0 spike คือสิ่งเดียวที่ควรทำก่อน — พิสูจน์ chain `OAuth → encrypted token → REST create/push/deploy → /exec URL สด` บนบัญชีคุณเอง มันคือ critical path จริง เหมือนกันทุก approach และยังไม่มีโค้ดในรีโป
