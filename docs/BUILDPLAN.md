# easygas — Build Plan (Greenfield Next.js 15, Approach C)

> Produced by a multi-agent research+design workflow (2026-06-13). Every verdict is research-backed.
> This is the source of truth for architecture & roadmap. See `ARCHITECTURE.md` for the original
> "Ship B, design toward C" analysis that preceded the user's decision to go greenfield-C.

## Product

"VS Code + Claude Code in the browser", specialized for **Google Apps Script + Google Workspace**:
sign in → connect your own Google account → chat with AI that writes GAS code into an in-browser editor →
live preview → one-click deploy to your own account (Apps Script REST API, no server-side clasp).

**User decisions (locked):** Greenfield Next.js 15 · external multi-user product · v0.1 supports standalone
web apps AND bound (Sheet) scripts + triggers · Tier-2 (real `/dev`) preview in MVP · Sonnet default / Opus for planning.

## A. Locked architecture decisions

| # | Question | Verdict | Why |
|---|---|---|---|
| A1 | Auth model | **Two layers**: Supabase Auth = login/identity only (`openid email`); a **separate custom Google OAuth authorization-code flow** stores an encrypted `refresh_token` in `google_connections` | Supabase does NOT persist/refresh `provider_refresh_token` (gotrue-js #131, auth-js #806). Separating lets login work before Google grant, and we control rotation with `prompt=consent` + hold `client_secret` server-side |
| A2 | Bound + trigger v0.1 | **Bound**: app creates the Sheet then binds (Recipe A) via `drive.file` only. **Trigger**: codegen an `installTriggers()` setup fn + best-effort `scripts.run` (devMode) + deep-link fallback. Simple triggers (`onOpen`/`onEdit`) need no install | The REST API has **no** trigger resource. Recipe A stays on `drive.file` (non-sensitive) → no CASA. `scripts.run` works because the script is created under our OAuth client (same GCP project by construction). Avoid "pick existing Sheet" broad scopes |
| A3 | Tier-2 in MVP | **Best-effort + robust fallback**, not a default inline promise. Probe (postMessage handshake + 3–4s timeout) → inline iframe if it renders, else **"เปิดบน Google ↗"** new-tab | `/dev` is gated by account-bound auth, no multi-login `/u/N` support, 3p-cookie blocking, and Google's login page sets `X-Frame-Options: DENY` |
| A4 | AI SDK vs direct | **Direct `@anthropic-ai/sdk` + manual agentic loop** | Need fine control of per-mutation SSE events, `egs_files` staleness checks, byte-for-byte prompt caching, and per-turn model routing |
| A5 | GCP scopes (contract) | `openid` `email` + `script.projects` + `script.deployments` + `drive.file` (add `script.scriptapp` only for the `scripts.run` trigger path). Enable: Apps Script, Drive, Sheets APIs | All **sensitive except `drive.file` (non-sensitive)** → lightweight verification, **no CASA**. NEVER add `drive`, `drive.readonly`, `gmail.*` (restricted → CASA) |
| A6 | Model routing | default codegen `claude-sonnet-4-6`; escalate plan/architect `claude-opus-4-8`; adaptive thinking; `effort:high` for plan, `medium` for codegen | Cache is model-scoped — switching invalidates it; accept one cold write on plan turns; keep the GAS rulebook byte-identical across both models |
| A7 | Model **provider** strategy | **`CodegenProvider` router หลัง interface เดียว**: planning = Claude เสมอ (A6); codegen role = pluggable — `sonnet-4.6` (**default**) \| `deepseek-v4-pro` (**candidate, ยังไม่ default**). DeepSeek เข้า codegen เท่านั้น ห้ามแตะ planning | DeepSeek ถูกกว่า ~5× (cache-**miss** $0.435/$0.87 vs Sonnet $3/$15) แต่: cache แตกง่าย (TTL ~5นาที, per-provider → split = ข้าม cache boundary ทุก plan→code), และ GAS เป็น niche (ไม่มี benchmark) อาจวน **run-and-repair เพิ่ม** จนกำไร token หาย + เผา scratch quota. **A/B gate** ที่ moat metric (first-run-green rate + repair-count/project บน GAS จริง): เลื่อนเป็น default เฉพาะเมื่ออยู่ในระยะ ~1 loop จาก Sonnet **และ** total $/green-project ต่ำกว่า (รวม Apps Script run/deploy quota). DeepSeek รองรับ tool-calling + พูดได้ทั้ง OpenAI/Anthropic format → อาจชี้ SDK เดิมไป base URL ได้ (verify tool-block ก่อน). **BYOK** → provider cost เป็นของลูกค้า → optimize "loop น้อยสุดถึง green" ไม่ใช่ token ถูกสุด |

## B. Project structure — see actual tree in the repo

Key load-bearing files (built incrementally):
- `lib/google-oauth.ts` — buildAuthUrl / exchangeCode / refreshAccessToken / revoke / decodeIdToken **(Phase 0 ✓)**
- `lib/google-connection.ts` — `getValidAccessToken(userId)` load→refresh→bearer **(Phase 0 ✓)**
- `lib/crypto.ts` — AES-256-GCM **(Phase 0 ✓)**
- `lib/gas-script-api.ts` — REST wrapper for `script.googleapis.com` **(Phase 0 ✓ for deploy pipeline)**
- `lib/manifest.ts` — appsscript.json builder **(Phase 0 ✓)**
- `lib/errors.ts` — UserSettingsDisabledError / NeedsReauthError / etc. **(Phase 0 ✓)**
- `lib/google-drive-api.ts` — `createSheet()` for bound scripts (Phase 5)
- `lib/anthropic-agent.ts` — `runAgentLoop()`, `EGS_TOOLS` (write/edit/delete/read), `executeEgsTool`, model routing (Phase 2)
- `lib/gas-codegen.ts` — PORT of KPPromptCreator `lib/gas-codegen.js` (CommonJS→ESM/TS): `buildCodegenPrompt`, `parseCodegenOutput`, `validateGasFiles`, `generateReadme` (Phase 1). Add a `bound: boolean` option (emit `onOpen`/`installTriggers`/`SpreadsheetApp.getActive()` instead of `doGet` for bound)
- `lib/preview-shim.ts` — Tier-1 srcdoc builder: `google.script.run` Proxy→postMessage + `include()` resolver (Phase 4)
- `components/ide/*` — Monaco EditorPane, ChatPanel (SSE consumer), PreviewPane (Tier-1), PreviewTier2, FileTree (Phase 3+)
- `store/useProjectStore.ts`, `store/useChatStore.ts` — Zustand: `applyFileMutation()` from server-echoed SSE (Phase 3)

## C. Schema (`egs_*` + `google_connections`)

See `supabase/migrations/`. Tables: `egs_projects`, `egs_files`, `egs_messages`, `egs_deployments`, `google_connections`.
All owner-scoped RLS. The agent loop mutates via service-role with an in-code `owner_id` guard.
Encrypted token columns are stored as base64 **text** (ciphertext/iv/tag) and read server-only.

## D. Phase 0 spike — DONE (this scaffold)

Smallest runnable proof of the critical chain, no AI/editor/preview:
`/login` → `/connect` (custom OAuth grant) → `/connect/done` → POST `/api/deploy/spike` →
`createProject → updateContent → createVersion → createDeployment` → live `/exec` URL.
Surfaces the per-user `usersettings` 403 as a recoverable step. See `README.md` for the manual test.

## E. Roadmap (Phases 0–8)

| Phase | Build | Unlocks |
|---|---|---|
| **0 ✓** | OAuth(A) + crypto + Apps Script pipeline + usersettings-403 + 1 hardcoded web app → `/exec` | critical chain proven on founder's account |
| 1 | `egs_*` baseline + RLS, `/projects` list/create, manifest builder, port `gas-codegen.ts` | data model + reuse codegen brain |
| 2 | `/api/agent/[projectId]` SSE manual loop, `EGS_TOOLS` + `executeEgsTool` (validate path + `validateGasFiles`), prompt-cache GAS rulebook, model routing, checkpoint `egs_messages` | AI writes/edits GAS, resumable |
| 3 | Monaco `EditorPane` (dynamic import), `ChatPanel` SSE consumer (optimistic `tool_call` → post-commit `file_mutation`), `FileTree`, Zustand `applyFileMutation` | "watch it type" UX |
| 4 | `preview-shim.ts` srcdoc + `google.script.run` Proxy→postMessage + `include()` resolver, `PreviewPane` (sandbox `allow-scripts`, opaque origin, NO allow-same-origin) | universal instant preview |
| 5 | `/api/deploy` PATCH-same-deployment, `/disconnect`, bound Recipe A (`createSheet` → `projects.create` with `parentId`) | external users deploy web apps + bound Sheet scripts |
| 6 | `/api/preview` push scratch script + inject `setXFrameOptionsMode(ALLOWALL)`, `PreviewTier2` probe + fallback | best-effort live run, safe degrade |
| 7 | codegen `installTriggers()` + best-effort `scripts.run` devMode (api_executable deployment) + deep-link fallback; simple-trigger detection | time-based/authed automation |
| 8 | landing/privacy on domain, Search Console domain verify, demo video, scope justifications, flip Production + submit verification; token-budget UI; Thai onboarding (unverified + usersettings walls) | external multi-user GA, past 100-user cap |

## F. env + GCP checklist
See `.env.example` + `README.md` §3. Critical: consent screen **Production** (not Testing) or refresh tokens
die in 7 days. Per-user `script.google.com/home/usersettings` wall is separate from verification.

## G. Top risks
1. **Refresh token 7-day expiry (Testing mode)** — flip to Production; treat `invalid_grant` → `needs_reauth` CTA, not a crash.
2. **usersettings-403 (every user)** — blocking onboarding step + retry; gate `authuser=` to the right `/u/N`.
3. **Accidental restricted scope → CASA** — scope list is a contract; for broader Drive use Google Picker + `drive.file`.
4. **Tier-2 blank frame** — communicate "best-effort"; probe + new-tab fallback.
5. **Plaintext tokens** — always AES-256-GCM; decrypt server-only via service-role.
6. **Vercel maxDuration cuts long Opus turns** — checkpoint `egs_messages` per iteration; `maxDuration=800` + Fluid compute.
7. **20-deployment/script cap** — always PATCH the same deployment id.
8. **Codegen breaking GAS rules** — `validateGasFiles` inside the tool loop → `is_error:true` → self-correct.

---

## H. ส่วนเสริม — 2 entry point ใหม่: เลือก Sheet เดิม + แนบรูป UI อ้างอิง

> เพิ่มจาก research+design workflow (2026-06-14). ขยาย §E roadmap (TASK-A ผูก Phase 5, TASK-B เป็น add-on หลัง Style Picker ใน §5 ของ QUALITY-MOAT) และขยาย schema `egs_projects.spec` ใน §C. หลักการเดียวที่คุมทั้งสอง: **artifact ดิบ (rows ของ Sheet / pixels ของรูป) ถูกย่อยใน server เราเองให้เป็น "bounded spec" ที่กระชับ แล้วป้อนเฉพาะ digest/spec เข้า Claude — ไม่เคยป้อน artifact ดิบเข้า loop** (กัน token บาน + กัน degrees-of-freedom หลุด).

### H.1 ภาพรวม 2 entry point ใหม่

ผู้ใช้เริ่มสร้างแอปได้ 4 ทาง — ทั้งหมด **บรรจบที่จุดเดียว: เขียน `egs_projects.spec` (jsonb) ให้ครบ แล้วเข้า quality pipeline เดิม** (Gate 0 static → Gate 1 critic → Gate 2 run-and-repair) โดยไม่แตะ loop:

| Entry point | เริ่มจาก | เติม spec ส่วนไหน |
|---|---|---|
| Guided Wizard (เดิม) | ถาม 5 ขั้น | `spec.purpose / data_model / style` |
| Template Gallery (เดิม) | project ที่รันเขียวแล้ว | pre-load spec ทั้งก้อน |
| พิมพ์เอง / Ambiguity Gate (เดิม) | prompt อิสระ | classifier → spec |
| **TASK-A: เลือกชีทของฉัน** (ใหม่) | Google Sheet ที่ผู้ใช้มีอยู่ | `spec.source_sheet` + `spec.data_model` |
| **TASK-B: แนบรูป UI** (ใหม่) | รูปหน้าจอ/mockup ที่ชอบ | `spec.style {kit, token_overrides, menu_pattern}` |

**ทั้งสองเป็น "ตัวเร่ง" (optional accelerator) ที่ pre-fill ขั้นใน wizard ไม่ใช่ขั้นใหม่:**
- TASK-A pre-fill **wizard ขั้น ② (เก็บที่ไหน + ช่องอะไร)** — ทางเลือกแทนพิมพ์คอลัมน์เอง และ flip build เป็น **bound script (Recipe A) บนไฟล์ที่เลือก**
- TASK-B pre-fill **wizard ขั้น ⑤ (หน้าตาแบบไหน = Style Picker)** — add-on เหนือการ์ด 4 kit เดิม

กฎเหล็ก wizard ยังครบ: **ทุกจอมีปุ่ม "ข้ามไป ให้ AI เลือกให้"**, ทั้งสอง flow มี default สมบูรณ์เสมอ, และ **สกัดครั้งเดียว — แก้ chip/type ทีหลังเป็น JSON patch ใน client ไม่เรียก Claude/vision/Sheets ใหม่**

```
Wizard ① ทำอะไร  ② เก็บที่ไหน+ช่อง ──[เลือกชีทของฉัน]──▶ Picker → Schema Review → spec.source_sheet + spec.data_model
                                └─[พิมพ์เอง]
       ③ ใครใช้  ④ ต้องการอะไรเพิ่ม
       ⑤ หน้าตา ──[แนบรูป]──▶ vision extract → "เราเดาว่า..." card → snap kit + spec.style
                └─[เลือก 4 kit เอง]
       ⑥ สรุป "สิ่งที่จะสร้าง" → ✨ สร้างเลย
```

### H.2 TASK-A: เลือกชีทเดิม → schema digest → spec

```
[ขั้น ② กด "📊 เลือกชีทของฉัน"]
  ▼ 1. Google Picker (scope drive.file เท่านั้น — per-file, non-sensitive, NO CASA ตาม §A5) → fileId (+title)
  ▼ 2. bind: projects.create({ parentId: fileId }) = bound script (Recipe A, §A2) — ใช้ไฟล์ที่เลือก
  ▼ 3. อ่าน Sheet ใน server ผ่าน Sheets API (spreadsheets.values.get) — ฟรี ไม่กิน Anthropic token
  │     cap: header + 50 แถวแรก (LIMIT ฝั่งเรา ไม่ใช่ทั้งชีท)
  ▼ 4. buildSheetDigest() → schema digest ~200-400 token: columns[]+type, sample 3-5 แถว, leadingZero flag
  ▼ 5. Schema Review table — ผู้ใช้ยืนยัน/แก้ type ต่อคอลัมน์ (§H.8)
  ▼ 6. เขียน spec.source_sheet + spec.data_model → เข้า pipeline เดิม
```

**กฎ token (เหตุผลที่ flow นี้ถูก):** ป้อน Claude เฉพาะ digest ไม่ป้อน rows ดิบ · cap sample ตายตัว 3-5 แถว (ชีท 10,000 แถวกับ 10 แถว digest ขนาดเท่ากัน) · Sheets read = compute เรา ($0 Anthropic, อ่านด้วย `getValidAccessToken` §B) · cache ใน `spec.data_model` แก้ chip = patch ไม่อ่านใหม่

**type inference (closed set):** `text · number · currency · date · phone · email · enum · url` — `phone`→`leadingZero:true`→บังคับ `setNumberFormat('@')`+`getDisplayValue()` (Gate 0 §3E); `enum`→ค่าไม่ซ้ำ ≤8 เก็บ `options[]`; `currency`→header match `/ยอด|ราคา|บาท|amount|price|total/i`+ตัวเลข

### H.3 TASK-B: แนบรูป UI → สกัด → เลือก/ปรับ

```
[ขั้น ⑤ ลาก/วาง/แปะ (Ctrl+V) รูป — PNG/JPG/WebP ≤8MB]
  ▼ 1. PREPROCESS (server, sharp — 0 token): .rotate() EXIF → resize longest 1024px → .png() lossless → strip meta
  ▼ 2a. PALETTE deterministic (server, node-vibrant/k-means — 0 token): ~6 สีเด่น + coverage% = hex จริงจาก pixel
  ▼ 2b. VISION CLASSIFY (Sonnet 4.6 + Structured Outputs, image block มาก่อน text):
  │      input: รูป 1024px + palette list → classify vocabulary ปิด + assign สีเข้า role + เลือก kit ใกล้สุด
  │      output: StyleProposal JSON ~150-250 token — enum ล้วน ห้าม CSS/font/hex นอก list
  ▼ 3. SNAP + CONSTRAIN (server, zod — GATE V0): palette snap เข้า hex ที่ส่งไป, accent→curated swatch ~12,
  │     radius/density/font/card→token ของ kit, menu_pattern→1 ใน 4 layout partial ที่ verify แล้ว
  ▼ 4. "เราเดาว่า..." Review Card — chip แก้ได้ + confidence ราย field (§H.8)
  ▼ 5. เขียน spec.style {kit, token_overrides, menu_pattern, source:"image"}
```

**ทำไมแยก palette ทำเอง ไม่ให้ vision เดาสี:** (1) แม่นกว่า — hex จาก vision เป็น "การบรรยาย" ไม่ใช่ sampling จริง; k-means บน buffer ได้ hex เป๊ะ reproducible (2) ถูก/deterministic — งานเดียวของ model เรื่องสีคือ **assign role** ("สีเด่นนี้คือ accent") โดยเลือกจาก list ที่เราป้อน → ประดิษฐ์ hex ใหม่ไม่ได้

**StyleProposal schema = enum ล้วน** (Structured Outputs รองรับ enum/const/required/additionalProperties:false แต่**ไม่รองรับ** min/max/pattern → คุมช่วงด้วย enum bucket): `nearest_kit{clean_form|dashboard|card_list|thai_receipt}`, `kit_fit{strong|partial|weak}`, `menu_pattern{top_tabs|side_nav|bottom_bar|none}`, `card_style{flat|bordered|elevated}`, `radius{none|sm|md|lg}`, `density{compact|normal|roomy}`, `type_vibe{readable|formal|friendly}`, `palette{mode,surface,accent,text,muted}` (hex ที่เราส่งไปเท่านั้น), `confidence{ราย field: high|medium|low}`, `is_ui`(false→ปฏิเสธ)

### H.4 การคุมให้ยืดหยุ่นแต่ไม่หลุด (moat guardrail)

> หลักการ 1 ประโยค: **รูป "ไม่เคย" ไปถึง codegen เป็นแหล่ง layout/CSS — รูปถูกบริโภคจบใน vision call แล้วออกมาเป็นแค่ "ค่าของ CSS custom property ที่มีอยู่แล้ว" บน `:root`** codegen ยังรับ `{kit, token_overrides, menu_pattern}` เหมือนที่รับจาก Style Picker วันนี้เป๊ะ

บทเรียนตลาด: ผู้ชนะ (v0 **Design Mode** แก้ token สดไม่ regen, Builder.io **Visual Copilot** map เข้า component ที่มีอยู่) บีบการสกัดเข้า token/component set ตายตัว; ที่เจ๊ง (Anima absolute-position spaghetti, raw screenshot-to-code ออก `bg-blue-500` นอกระบบ) ปล่อยให้รูปสั่ง CSS อิสระ → รูป UI ของ easygas เป็นแค่ **"ตัวเร่งเลือก kit + token ที่ดีกว่ากดการ์ด 4 ใบ"** ไม่ใช่ code generator ตัวใหม่

**WHITELIST — token ที่ override ได้ (12 key, enum/snapped ล้วน):** `palette.surface`→`--color-surface`(neutral ramp 12 ระดับ) · `palette.text`→`--color-text`(contrast ≥4.5:1 ไม่งั้น kit default) · `palette.muted` · `accent`→`--color-accent`(snap curated swatch ~12 ΔE) · `accent.fg`(auto-contrast, locked) · `radius`→enum{none:0,sm:4,md:8,lg:12} · `density`→`--space-unit`+`--control-h`{compact/normal/roomy→4/6/8px·32/40/48px} · `font.pair`→allow-list ครอบไทย{sarabun/prompt/kanit/ibmplex} · `font.scale`{s:1.0,m:1.067,l:1.125} · `card_style`→`--card-elev`+`--card-border`{flat/bordered/elevated} · `menu_pattern`→เลือก 1 ใน 4 `layout.*.html` ที่ verify แล้ว
**กฎเหล็ก: 12 key, enum/snapped scalar ล้วน — ไม่มี px/สี/font ดิบผ่านโดยไม่ snap** (model เสนอ `#1a73e8` → GATE V0 snap เป็น curated accent ใกล้สุด)

**LOCKED (รูปแตะไม่ได้):** คลาส/vocabulary component (`.btn .card .field`) — override ได้แค่ "ค่า" ของ var · โครง DOM/layout (single-page HtmlService, include(), Alpine) — เลือกได้แค่ partial ไหน · GAS reality (ไม่มี CSS/JS นอก CDN allow-list, ไม่มี build/Tailwind) · spacing/type ratio (ขยับแค่ scalar knob) · token ที่ derive จาก contrast (`accent.fg`, `text-muted` คำนวณเสมอ → รูปสีจัดมาทำให้อ่านไม่ออกไม่ได้)

**ทำไม moat ครบทุกชั้น:** codegen ยังยิงเข้า vocabulary ปิด (override = block `:root{--var:value}` ต่อจาก kit tokens → 0 คลาสใหม่) · static lint (Gate 0) ตรวจโครงสร้าง+vocabulary ที่ kit เป็นเจ้าของ — ปุ่มเปลี่ยนสียังเป็น `.btn` เดิม · run-and-repair (Gate 2) ไม่กระทบ (recolor/radius ไม่ทำให้ runtime error) → first-run-green KPI ไม่ขยับ · **GATE V0/V1 = แฝดของ Gate 0/1**

**fallback ตอน confidence ต่ำ (ไม่ประดิษฐ์):** kit confidence < threshold → default `clean_form` + บอกตรงๆ + โชว์ 4 kit ไม่ pre-certify · per-token ต่ำ → drop override คง kit default + ป้าย "AI ไม่แน่ใจ — ใช้ค่าเริ่มต้น" · `is_ui:false` → ปฏิเสธ+แนะนำ → default kit · ทุก field ที่ drop ยังเป็น chip แก้ได้ (ผู้ใช้ไม่เคยถูก block)

### H.5 token & cost

สูตร patch-based: `visual_tokens = ceil(w/28) × ceil(h/28) ≈ area/784`. caps auto-resize: **Sonnet 4.6 ≤1568px/token**, Opus 4.8 ≤2576px/4784 token (แพงกว่า). Claude ไม่อ่าน metadata (strip EXIF ฟรี)

**ต้นทุนต่อการสกัด 1 ครั้ง (downscale 1024px, รัน Sonnet 4.6 ไม่ใช่ Opus):** 1024×576 = 777 token ≈ **$0.0023** · 1024×768 = 1036 ≈ **$0.0031** · 1024×1024 = 1369 ≈ $0.0041. ถ้าไม่ downscale: iPhone 1170×2532 บน Opus = 3822 token ($0.019) → ห้ามส่งดิบ
- palette extract = **$0** (k-means ในโค้ด) · output JSON ~150-250 token · **รวม ≪ $0.01/รูป** และ **one-time** (เก็บ `spec.style` + cache ด้วย image hash → แก้ chip ทีหลัง = patch client **0 token**)
- TASK-A: Sheets read = compute เรา → **$0 Anthropic** (access token ผู้ใช้ + inference TS); codegen เห็นแค่ digest ~200-400 token

### H.6 ส่วนต่อ schema (`egs_projects.spec`)

```jsonc
{
  "purpose": "lead_tracker",
  "source_sheet": {                 // TASK-A (เมื่อ bound กับชีทที่เลือก)
    "file_id": "1AbC...", "title": "ลูกค้า-มิถุนายน", "sheet_name": "Sheet1", "bound": true
  },
  "data_model": {                   // TASK-A: digest ที่ผู้ใช้ยืนยันแล้ว
    "fields": [
      { "name": "ชื่อ", "type": "text" },
      { "name": "เบอร์โทร", "type": "phone", "leadingZero": true },   // toggle ผู้ใช้ → บังคับ @ format
      { "name": "ยอด", "type": "currency" },
      { "name": "สถานะ", "type": "enum", "options": ["ใหม่","ติดต่อ","ปิด"] }
    ],
    "sample_rows": [ /* 3-5 แถว — re-check + few-shot, ไม่เคยส่งดิบเข้า Claude */ ],
    "_inference": { "confidence": { "เบอร์โทร": "medium" }, "edited_fields": ["เบอร์โทร"] }
  },
  "style": {                        // TASK-B (และ Style Picker เดิม)
    "kit": "dashboard", "menu_pattern": "top_tabs",
    "token_overrides": {            // เฉพาะ key ใน whitelist §H.4 — post-snap แล้ว
      "accent": "#2F6FED", "card_style": "elevated", "radius": "md", "density": "roomy", "font.pair": "prompt/sarabun"
    },
    "source": "image",             // "image" | "picker" | "wizard"
    "_extraction": {               // provenance/telemetry — ไม่ feed codegen
      "image_ref": "egs-refs/<user_id>/<project_id>/<sha256>.png",
      "confidence": { "kit": "high", "accent": "medium" }, "dropped": ["palette.success"], "model": "claude-sonnet-4-6"
    }
  }
}
```
**prompt injection:** codegen รับ kit เหมือนเดิม + ต่อท้าย 1 block `:root{}` (value override บน custom property ที่มีอยู่ → 0 คลาสใหม่) — `token_overrides` เป็น post-snap แล้ว codegen เชื่อได้ไม่ต้อง re-validate

**Storage bucket รูป (privacy/opt-in):** bucket private `egs-refs` owner-scoped RLS (แพทเทิร์นเดียวกับ `payment-slips`), path `egs-refs/<user_id>/<project_id>/<sha256>.png`. **default = ลบหลังสกัดเสร็จ** ผ่าน `after()` (opt-out keep), copy: *"รูปนี้ใช้แค่ดูสไตล์ แล้วเราจะลบให้อัตโนมัติ"* + `☐ เก็บรูปไว้แก้สไตล์ทีหลัง`. รูปไม่เคยลง `egs_messages` และไม่ส่งซ้ำเข้า Claude. flywheel เก็บแค่ pattern `{kit, overrides, confidence}` anonymized opt-in

### H.7 วางใน roadmap ตรงไหน

| | TASK-A เลือกชีท | TASK-B แนบรูป UI |
|---|---|---|
| **ผูก phase** | **Phase 5** (bound Recipe A) — เพิ่ม Picker UI + `buildSheetDigest()` + Schema Review | **add-on หลัง §5 Style Picker** (build order ⑤ ใน QUALITY-MOAT §7) |
| **ของใหม่** | `components/picker/SheetPicker.tsx`, `lib/sheet-digest.ts`, Schema Review table | `lib/style-extract.ts` (vision+zod+snap+confidence gate), `lib/style-kits/overridable-tokens.ts` (12-key whitelist+snapper+curated swatch+font allow-list), split `layout.{top-tab,side-nav,bottom-bar,single}.html`, review card |
| **dependency** | Sheets API (§A5), `getValidAccessToken` (Phase 0 ✓), Recipe A (Phase 5) | sharp + node-vibrant, Structured Outputs (SDK), bucket `egs-refs` |

**MVP:** TASK-A ทั้งหมด (มาฟรีกับ Phase 5 bound, ดัน first-run-green เพราะ data_model แม่นตั้งแต่ต้น) · TASK-B: dropzone+preprocess+palette+vision+snap+review card (6 chip) + "ดูตัวอย่างสำเร็จรูป" (curated reference map ตรงเข้า `{kit,overrides}` ไม่เรียก vision — default สำหรับคนไม่มี screenshot)
**Defer:** TASK-B: `font.scale`/secondary color/palette.{success,warn,danger} (ซ่อนหลัง "⚙ ปรับแต่งเพิ่ม"), flywheel learning, retain รูป opt-in · TASK-A: หลายชีท/หลาย tab (MVP = sheet แรก)

### H.8 UI copy ภาษาไทย

**TASK-B — "เราเดาว่า..." Review Card (ขั้น ⑤)** — confidence→ป้าย+dot (high เขียว / medium เหลือง "เราเดาว่า…" / low เทา "ไม่แน่ใจ ลองเลือกเอง"):
```
┌─ จากรูปของคุณ เราจับสไตล์นี้มาให้ ──────────────────────────────┐
│ [thumbnail]  สไตล์ที่ใกล้ที่สุด:  🟢 แดชบอร์ด (Dashboard)   [เปลี่ยน ▾] │
│  เมนู         🟢 แท็บด้านบน           [แท็บบน · เมนูข้าง · ล่าง]         │
│  สีหลัก       🟡 เราเดาว่า… ●#2F6FED   [🎨 แตะเพื่อแก้]                 │
│  การ์ด        🟢 มีเงา (ลอยขึ้น)       [แบน · เส้นขอบ · มีเงา]          │
│  ความโค้งมุม  🟢 โค้งปานกลาง          [เหลี่ยม · น้อย · ปานกลาง · มาก] │
│  ความหนาแน่น 🟡 เราเดาว่า… โปร่ง      [แน่น · ปกติ · โปร่ง]            │
│  ตัวอักษร     🟢 อ่านง่าย สมัยใหม่      [อ่านง่าย · ทางการ · เป็นกันเอง]  │
│  ⚙ ปรับแต่งเพิ่ม (ขนาดมุม · น้ำหนักเงา · สีรอง)                        │
│  [ ✓ ใช้แบบนี้เลย ]            [ เริ่มใหม่ / เลือกเอง 4 แบบ ]          │
└──────────────────────────────────────────────────────────────────┘
```
dropzone: *"มีหน้าจอที่ชอบอยู่แล้วใช่ไหม? ลากรูปมาวางตรงนี้ — เราจะไม่ลอกทั้งหน้า แต่จะจับ 'อารมณ์' มาปรับให้ใช้ได้จริงบน Google"*

**TASK-A — Schema Review table (ขั้น ②)**:
```
┌─ เราเปิดชีท "ลูกค้า-มิถุนายน" แล้วเจอ 5 คอลัมน์ ──────────────────────┐
│  คอลัมน์        เราเข้าใจว่าเป็น       ตัวอย่าง          แก้ชนิด           │
│  ชื่อ            🟢 ข้อความ           สมชาย, มาลี       [ข้อความ ▾]      │
│  เบอร์โทร        🟡 เบอร์โทร ☎️         081xxx, 02xxx    [เบอร์โทร ▾] ⚠   │
│       └ ☑ คอลัมน์นี้คือเบอร์โทร (กัน 0 หน้าหาย)                            │
│  ยอด            🟢 ตัวเลข/เงิน        1,250 / 980       [ตัวเลข ▾]       │
│  สถานะ          🟡 ตัวเลือก (3 ค่า)   ใหม่/ติดต่อ/ปิด    [ตัวเลือก ▾]     │
│  [ ✓ ถูกต้อง สร้างจากชีทนี้ ]          [ เลือกชีทอื่น ]                   │
└─────────────────────────────────────────────────────────────────────┘
```
ปุ่มเข้า (ขั้น ②): `[ 📊 เลือกชีทของฉัน ]` คู่กับ `[ พิมพ์เองทีหลัง ]`; ⚠ amber เฉพาะแถว confidence ต่ำ; toggle เบอร์โทร = คันโยกหลัก → set type=`phone` + บังคับ `setNumberFormat('@')`+`getDisplayValue()` (Gate 0 §3E)

**สรุป write-back (ทั้ง 2 flow):** สกัด/อ่าน **ครั้งเดียว** → เขียน object สมบูรณ์ลง `egs_projects.spec` → แก้ chip/type = **JSON patch ใน client (0 token)** → live preview re-render จาก token ใน srcdoc shim → "✨ สร้างเลย" inject spec เป็น hard contract เข้า pipeline เดิม (codegen ไม่เคยเห็นรูป/rows ดิบ) → `checkSpecConformance(spec,files)` re-check

---

## I. การจับ console / error — 2 surface (ไม่ใช้ Chrome MCP ใน production)

> เพิ่มจาก workflow (2026-06-14). founder สับสนว่า preview จับ console.log ได้ไหม + ต้องใช้ Chrome MCP ไหม — คำตอบ: ได้/ไม่ต้อง แต่ error มี **2 surface ที่ไม่เคยทับกัน** ใช้กลไกคนละแบบ. ต่อยอด Channel 1-3 ใน QUALITY-MOAT §4.

### Surface 1 — Client-side JS (รันใน browser ผู้ใช้: HtmlService front-end, `google.script.run` callbacks)
จับด้วย **in-page shim** ใน Tier-1 srcdoc preview (`lib/preview-shim.ts`) — prepend ก่อน user HTML:
- override `console.log/info/warn/error/debug` + `window.onerror` + `window.addEventListener("unhandledrejection")` → `parent.postMessage(...)` → parent render console panel real-time
- **gotcha (สำคัญ):** `Error` object **structured-clone ไม่ผ่าน** postMessage (โยน DataCloneError) → ต้อง **flatten เป็น `{name, message, stack}`** ก่อนส่งเสมอ
- iframe = `sandbox="allow-scripts"` (ไม่งั้น shim ไม่รัน) **ห้ามใส่ `allow-same-origin`** (combo นี้ถอด sandbox ตัวเองได้); postMessage ข้าม opaque origin ได้อยู่แล้ว
- line number: shim ถูก prepend → iframe line N = editor line `N − shimLineCount` → เก็บ offset table ต่อไฟล์ (multi-file)
- **ข้อจำกัด:** srcdoc รัน static HTML/CSS/JS เท่านั้น — `google.script.run.serverFn()` **ไม่ทำงาน** (ไม่มี GAS backend) → พฤติกรรม client↔server จริงต้อง verify ที่ Gate 2

### Surface 2 — Server-side GAS (รันบน Google: `doGet`/`doPost`/ฟังก์ชัน)
`console.log` ฝั่ง server **ไม่ขึ้น browser console เด็ดขาด** → ไป **Cloud Logging (Stackdriver)**; uncaught exception → **HTTP 500 / หน้า error ของ Google** บน `/exec`·`/dev`. shim มองไม่เห็น (รันบน server). ใช้ Channel 1-3 เดิม (QUALITY-MOAT §4): **Channel 1** classify HTTP/HTML → **Channel 3** Cloud Logging `entries.list` (`resource.type="app_script_function" AND timestamp>=<start>`) ดึง error/stack จริง → **Channel 2** `scripts.run(devMode)` สำหรับฟังก์ชันเดี่ยว. ป้อน `{httpStatus, errorMessage, stack, console output}` กลับเข้า repair prompt — **ไม่มี channel ไหนแตะ browser**

### Chrome DevTools MCP / Headless browser
- **Chrome DevTools MCP = dev-time เท่านั้น** (ให้ผม/founder debug ตัว easygas) — **ห้ามฝังเป็น per-user production dependency / ห้ามใส่ verification loop**
- **Headless browser (Playwright) = Channel 4 (DEFERRED)** — ทางเดียวที่จับ **client-JS error บนหน้า `/exec` ที่ deploy จริง** (Cloud Logging มองไม่เห็นเพราะรันใน browser ผู้ใช้): load `/exec` → `page.on("pageerror")`+`page.on("console")` + screenshot
  - **MVP: ข้าม** (shim + Channel 1/2/3 ครอบคลุมพอ). **Later:** เพิ่มตอนต้องการ e2e "พิสูจน์ front-end ไม่ throw" + screenshot artifact — **pool instance, gate เฉพาะ final deploy verification** ไม่ใช่ทุก repair iteration (กัน browser farm กลายเป็น fixed cost ต่อ project)

---

## J. เพดานความสามารถ GAS + pluggable target (กล้อง/สแกนหน้า + เว็บจริง+Supabase อนาคต)

> เพิ่มจาก workflow (2026-06-14). **หลักคิด:** อย่าฝืนแก้ GAS ให้ทำสิ่งที่ sandbox ปิดตาย — ออกแบบ `DeploymentTarget` interface เดียว + capability router อ่าน `spec` แล้ว **route งานที่เกินเพดาน GAS (กล้องสด/realtime/โดเมน/SEO) ไป target ที่สอง (เว็บจริง + Supabase)** โดยรักษา property "ผลลัพธ์เป็นของลูกค้า + zero per-app hosting cost" ทั้งสอง target

### J.1 กล้องใน GAS — ปิดตายจริง + fallback ที่ใช้ได้
`getUserMedia` (กล้องสด) **ถูกบล็อกที่ชั้นเหนือ developer** — GAS เสิร์ฟใน iframe cross-origin ของ Google, Permissions-Policy ปิด `camera`/`microphone` และ iframe แม่ (ของ Google) ใส่ `allow="camera"` ไม่ได้ → ไม่มีโค้ด GAS ตัวไหนแก้ได้
- **Fallback ใช้ได้วันนี้:** `<input type="file" accept="image/*" capture="environment">` → เปิดกล้อง native ถ่าย **ภาพนิ่ง** → FileReader → base64 → `google.script.run`/`doPost` → `folder.createFile(blob)` เก็บ Drive. เหมาะกับ ถ่ายรูปแนบ/สแกนเอกสาร/ถ่ายบัตร/อ่าน QR จากภาพนิ่ง
- **ทำไม่ได้เด็ดขาด (→ web target):** วิดีโอสด, face-scan/liveness real-time, สแกน QR ต่อเนื่อง, WebRTC, per-frame processing

### J.2 ตารางเพดานความสามารถ GAS (workaround vs hard-limit)
| ความสามารถ | สถานะ | ทางออก |
|---|---|---|
| กล้อง/ไมค์สด, WebRTC | **HARD** | ภาพนิ่ง `<input capture>`; สด → web |
| WebSocket/realtime push | **HARD** | polling (กิน quota); realtime จริง → web (Supabase Realtime) |
| รันเกิน **6 นาที/execution** | **HARD** (tier 30 นาทีหายแล้ว) | chunk+continuation+trigger; งานยาว → web/queue |
| trigger 90 นาที/วัน (consumer), 6 ชม. (Workspace) · concurrency 30/user | **HARD quota** | LockService+queue; → web |
| npm/native | **WORKAROUND** (pure-JS bundle ได้) **/ HARD** (native) | bundle; native → web |
| WASM/compute หนัก (ML/CV) | เบาได้ / **HARD หนัก** | → web/GPU |
| ไฟล์ > 50MB/call | **HARD** | Drive resumable; process ใหญ่ → web |
| custom domain / SEO | **HARD** (URL ตรึง script.google.com) | → web |

### J.3 Capability Router (pure function เหนือ `spec`, ไม่เรียกโมเดล)
`routeTarget(spec) → {target, confidence, reasons[], fallbackOption?}`:
```
needs = deriveCapabilityNeeds(spec)   // จาก wizard + flags + template + free-text lexicon (ไทย/อังกฤษ)
liveCamera|realtime|npmPackages|customDomain|publicSeo  → web
workspaceData(Sheets/Drive/Gmail) | (zeroHosting & internalTool & !web-signals) → gas
default → gas (ถูกสุด, owned, ขึ้นได้เลย) + reasons[]

// camera special-case:
needs.camera & liveStreamRequired (face-scan/overlay/สแกนต่อเนื่อง) → web (offer GAS still-photo เป็น downgrade)
needs.camera & ถ่ายครั้งเดียว/แนบรูป → อยู่ GAS ผ่าน <input capture> (ไม่ route)
```
**Surface:** default = auto-pick + อธิบาย 1 บรรทัด (*"สร้างเป็นเครื่องมือบน Google Sheet ของคุณ — ฟรี ไม่มีค่าโฮสต์"* + ลิงก์เงียบ "เปลี่ยนวิธี"); ถามเฉพาะตอน hard-web + hard-GAS ชนกัน; v1 (web ยังไม่เสร็จ) camera-สด → **downgrade ซื่อสัตย์**: *"กล้องสดยังทำบน GAS ไม่ได้ — สร้างเป็นถ่ายรูปนิ่งเก็บใน Sheet ได้เลย หรือรอเวอร์ชันเว็บแอป"*
> **ค่าแม้มี target เดียว:** กัน Bucket-B specs ไม่ให้หลุดเข้า GAS codegen (ซึ่งจะ fail dynamic-run gate ทุกครั้ง ทำลาย first-run-green KPI) ตั้งแต่วันแรก

### J.4 Target ที่สอง = เว็บจริง + Supabase (deploy เข้าบัญชีลูกค้าเอง — ปรัชญาเดิม)
- **Deploy:** **GitHub repo ในบัญชีลูกค้า** (source of truth, BYO-repo ตั้งแต่แรก) + **Vercel plain OAuth** (`POST /v13/deployments` ในบัญชีลูกค้า — **ไม่ใช่ Marketplace API** ที่กลับหัว billing) / **Netlify** (static). 
- **Supabase ลูกค้า:** provision ผ่าน OAuth App `POST /v1/projects` ใน org ลูกค้า (ลูกค้าจ่ายเอง) หรือ connect-your-own (paste keys). **คมที่ต้องระวัง:** migration — ใช้ `/database/query` รัน SQL (`/database/migrations` ยัง gated allowlist) หรือขอ DB password ครั้งเดียว
- **Verify (moat ง่ายกว่า GAS):** WebContainers (preview ใน browser, **commercial license เกิน ~500 session/เดือน** → ยังไม่ build) + **Docker+Playwright** เป็น authoritative gate; mirror 3-gate เดิม
- **Unit economics:** hosting $0 + DB $0 ต่อแอป (ลูกค้าจ่าย Vercel/Supabase เอง) — **moat รอด**; delta จริง = **LLM token** (repo หลายไฟล์ > .gs เดียว) + build-compute เล็ก → ตั้งราคา web tier ให้ครอบ token สูงขึ้น

### J.5 สถาปัตยกรรม pluggable target (seam)
Core engine target-agnostic: `guided spec → codegen → 3-gate → deploy`; ทุกอย่างที่ต่างต่อ target อยู่หลัง interface เดียว:
```ts
interface DeploymentTarget {
  id: 'gas' | 'web-supabase'; capabilities: CapabilitySet; requiredScopes: AuthScope[];
  systemPrompt(spec); rulebook(); modelRoute(stage);          // codegen
  scaffold(spec); serialize(tree); manifest(spec);            // file format
  lint(tree);                                                 // gate 1
  preview(tree);                                              // GAS srcdoc/dev | web iframe/WebContainer
  push(tree,account); run(scratch,entry); captureError(res);  // gate 3 (run-and-repair)
  deploy(tree,account); deployedUrl(res);                     // final
}
type CapabilitySet = { liveCamera; stillPhoto; realtime; npmPackages; customDomain; publicSeo; workspaceData; zeroHosting; backgroundJobs }
```
- **GASAdapter (now):** liveCamera:false, stillPhoto:true, realtime:false, npm:false, workspaceData:true, zeroHosting:true; deploy = updateContent+deployments เข้า Google ลูกค้า
- **WebSupabaseAdapter (future, แค่ interface ตอนนี้):** liveCamera:true, realtime:true, npm:true, customDomain:true, zeroHosting:false; deploy = Vercel/Netlify + Supabase ลูกค้า

**Shared (core):** `egs_projects.spec`+`spec.target`, wizard/Style-Picker/Template-Gallery, token-kits, run-and-repair **loop shape** (push→run→capture→repair N≤3, first-run-green), verified-solution flywheel (key `(target, ruleId, errorSig)`), 3-gate orchestration + critic, model routing, IDE shell/auth/project-list
**Per-target (adapter):** prompt content + rulebook, file format, lint rules, 3 verb (push/run/captureError), deploy call, preview mechanism

### J.6 ใส่ตอนนี้แค่ไหน (อย่า over-engineer)
**ใส่เลย (เล็ก):** (1) นิยาม `DeploymentTarget` interface + `CapabilitySet` (2) implement **เฉพาะ GASAdapter** แล้ว route ทุก GAS path ปัจจุบันผ่าน interface (ห้ามเหลือ GAS call ตรงใน core) (3) เพิ่ม `spec.target` (default `'gas'`) + `spec.capabilityNeeds` (4) capability router เป็น pure function (5) ติด tag `target` ให้ flywheel + lint rules ตั้งแต่วันแรก (retrofit แพง)
**ยังไม่ทำ (YAGNI):** WebSupabaseAdapter จริง, WebContainer integration, Vercel/Netlify OAuth + Supabase provisioning, web rulebook/critic, generic N-target plugin registry (`Record<TargetId, DeploymentTarget>` 2 ตัว hardcode พอ), cross-target migration
**Net commitment วันนี้:** core คุย target ผ่าน `DeploymentTarget` เท่านั้น + spec พก `target`+`capabilityNeeds` + router pure function → web ค่อยเสียบเป็น **adapter registration ไม่ใช่ rewrite**

### J.7 ผลต่อ roadmap / ธุรกิจ
1. **GAS = niche moat + zero hosting (โฟกัส now)** — จุดที่ bolt/Lovable/v0 ไม่ทำ + closed run-and-repair loop (port ข้าม target ได้)
2. **Capability router + seam (now, ถูก)** — Bucket-B specs กลายเป็น **demand signal** (เก็บสถิติคนขอกล้องสด/realtime กี่ % เพื่อ justify เฟส web ด้วยข้อมูลจริง) ไม่ใช่ความล้มเหลว
3. **Web+Supabase target (later, ขับด้วย demand)** — escape hatch กล้อง (J.1) และ route needs-real-host (J.4) **เป็นประตูเดียวกัน**; classifier วันนี้ทำให้เป็น extension ไม่ใช่ rewrite

---

## K. Showcase / Community (แชร์ · fork · lineage · license · rating) — v2, แต่ hooks วันนี้

> เพิ่มจาก workflow (2026-06-14). **ไอเดียหลัก:** showcase = เครื่องยนต์ **growth + flywheel** — ทุกโปรเจกต์ที่ "แชร์ + ถูก fork + รันผ่านจริงบนบัญชีคนอื่น" = case study + หน้า SEO + ตัวอย่างคุณภาพสูงป้อน corpus codegen พร้อมกัน — **ไม่ใช่ marketplace หนัก** (ห้ามรื้อ storefront/orders/payout/seller-dashboard/review เชิงพาณิชย์ ที่ KPPromptCreator เคยลบ). **เส้นแบ่งที่ห้ามข้าม:** lineage/เครดิต/license = automatic system-enforced · fork = "deploy เข้าบัญชี Google ตัวเอง" (ไม่ live-run บน infra เรา) · rating = สัญญาณพฤติกรรม deploy-gated · เงิน = credit + DFY-LINE + featured boost

### K.1 หน้าจอ & การแชร์
- **Public showcase page (1 โปรเจกต์ = 1 หน้า indexable):** ป้าย **"✅ รันผ่านจริง"** เด่นสุด (แทน live-preview — บทเรียน Replit: อย่าพยายาม live-run GAS ของคนอื่น เพราะรันบนบัญชี+secret เจ้าของ) + screenshot + code viewer (read-only) + chips **"ฟอร์ก N · ดีพลอย N · ใช้ได้จริง N"** + lineage strip "สร้างต่อจาก @creator" + ปุ่ม **"ต่อยอดสิ่งนี้/Fork"** + **"แชร์เข้า LINE"**
- **Gallery `/showcase`:** เรียงตาม composite score + Featured (curate มือ) + filter `target`/use-case + **fork ซ่อนจาก gallery default** (กฎ CodePen กัน clutter — โผล่เฉพาะตัวต่างจากเดิมมีความหมาย)

### K.2 License (4 preset ง่ายสำหรับ non-coder — 2 แกน: ต้องเครดิตไหม + ขายต่อได้ไหม)
| Label TH | `license` id | map | forkable |
|---|---|---|---|
| ดูอย่างเดียว | `view-only` | All rights reserved | false |
| ก็อปได้ ใส่เครดิต | `cc-by` | CC-BY-4.0 (≈MIT+attr) | true |
| ก็อปได้ ใส่เครดิต ห้ามขายต่อ | `cc-by-nc` | CC-BY-NC-4.0 | true |
| ก็อปได้เลย ไม่ต้องเครดิต | `mit-noattr` | MIT/CC0 | true |

**Inheritance (clamp lattice):** `mit-noattr(0) < cc-by(1) < cc-by-nc(2) < view-only(∞)` — fork เลือกได้เท่ากันหรือเข้มกว่าพ่อ ห้ามหลวมกว่า (NC เหนียว, เครดิตเหนียว). **เครดิต = automatic** (platform render จาก `parent_id` ไม่ให้ user พิมพ์เอง — ตัด failure mode #1 ของ Thingiverse). เก็บ SPDX id ใต้ฮูด (CC ไม่แนะนำกับ software แต่ template = "สูตรอาหาร" ใช้ได้)

### K.3 Fork → deploy เข้าบัญชีตัวเอง (ไม่มี shared running instance)
```
ปุ่ม "Fork" (เฉพาะ parent.forkable && license ผ่าน) → fork_project(parent_id):
  copy: spec + ไฟล์ GAS (+oauthScopes) + screenshot
  STRIP เด็ดขาด (security+privacy):
    - PropertiesService ทุกค่า (API key/token/webhook/LINE token) → placeholder ว่าง
    - hardcoded Google IDs (openById/getFolderById/44-char Drive ID/openByUrl) → __REPLACE_ME__
      (ไม่งั้น fork อ่าน/เขียน Sheet ของเจ้าของเดิม = privacy leak!)
    - email/เบอร์/Session.getActiveUser
  INSERT egs_projects ใหม่: owner=forker, parent_id, root_id, fork_depth+1, license=clamp(parent),
    ran_green=false, first_run_green=null, deployments=[]  ← fork ต้องหา green ของตัวเอง
  → customize ผ่าน chat → deploy ด้วย Google OAuth ของ forker เอง → green → เข้า flywheel เป็น entry ใหม่
```

### K.4 Lineage / สายใย (เก็บลึก แสดงตื้น)
- **Data:** `forked_from_id` (พ่อตรง) + `root_id` (ต้นตอ) + `fork_depth` + `fork_count` (denormalized)
- **แสดง:** auto-attribution immutable "สร้างต่อจาก @creator →" (เลียน Scratch บังคับ ลบไม่ได้) + breadcrumb `ต้นฉบับ→…→นี่` + "Remixes of this" flat list + หน้า lineage ต่อ root ("ถูก fork 47 ครั้ง" = viral content)
- **บทเรียน:** Scratch ถอด full Remix Tree (คนไม่ใช้), CodePen ซ่อน fork-of-fork → เก็บ full depth แต่แสดง flat list + breadcrumb. **เขียน edge อัตโนมัติใน fork action** (manual = lineage พังทุก platform)

### K.5 Rating แบบเบา (ไม่มี star/review marketplace)
สัญญาณหลัก = **พฤติกรรมที่เก็บอยู่แล้ว:** `fork_count` (โหวตคุณภาพแรงสุด) + `deploy_count` (distinct accounts) + `ran_green`. + สัญญาณคนเบา 1 ตัว: **"ใช้ได้จริง 👍" toggle 1 แตะ — gate เฉพาะคนที่ deploy โปรเจกต์นี้จริง** (deploy-gate ใน DB = ฆ่า upvote-bot โดยโครงสร้าง ฟรี). **ข้าม** star 1-5 + free-text review (noise บน n น้อย + ต้อง moderate). แสดง 3 ตัวเลขดิบบนการ์ดแทนดาวเฉลี่ย

### K.6 Security (สำคัญสุด — โค้ดแชร์ deploy เข้าบัญชี Google คนอื่น = supply-chain attack surface)
GAS auto-infer scope จากโค้ด → **scope หา static ได้ก่อน deploy** → ป้องกันเป็นชั้น:
1. **Scope-diff warning ก่อน deploy** — การ์ดสิทธิ์ภาษาคน + flag scope เสี่ยง (gmail.send/drive full/external_request combo = ลายเซ็น exfiltration) แดง + diff เทียบพ่อ
2. **Static lint โค้ดแชร์** (publish + fork) — flag UrlFetchApp นอก allowlist, eval/Function, base64 payload, foreign IDs, obfuscation → block/quarantine
3. **ป้าย "✅ รันผ่านจริง"** เฉพาะ `ran_green` ของ easygas เอง — fork unverified จนหา green เอง (ห้าม inherit)
4. **Report → quarantine** (N reports/lint flag → auto-hide รอ admin)
5. **Review-before-deploy gate** — โชว์ scope card + lint + โค้ด + ติ๊ก "เข้าใจสิทธิ์แล้ว" ก่อน OAuth redirect
6. **Domain allowlist** สำหรับ UrlFetchApp (Google/LINE/SaaS ทั่วไป); นอก list = "⚠️ ส่งข้อมูลออกไปที่ <host>" แดง

### K.7 Flywheel + growth + LINE
- **(a) corpus = moat:** โปรเจกต์ที่ **fork แล้ว re-run green บนบัญชีคนที่สอง** = ตัวอย่างสัญญาณสูงสุด (verify โดยมนุษย์คนที่ 2) → เฉพาะ verified composite เข้า few-shot corpus (curation > openness). "แชร์ = product ดีขึ้นสำหรับทุกคน" จริงทางเทคนิค
- **(b) social proof** (gallery เครื่องมือจริงร้านไทยอื่นใช้) **(c) SEO ฟรี** (programmatic landing หลายร้อยหน้า — ถูกสุดสำหรับ solo no-ad) **(d) lead-gen DFY** (route ไป LINE GAS Builder) **(e) creator retention** (featured/fork-count = status loop)
- **Growth loop (validated โดย Lovable $0→$100M ARR 8 เดือน 0 paid):** browse (SEO/LINE) → 1-click fork → **signup wall ที่ fork/deploy** (= conversion event) → build → deploy-green → prompt แชร์กลับ → หน้าใหม่. **LINE OA = surface แชร์ + broadcast "ระบบเด่นประจำสัปดาห์"** (contest+reshare+retention ใน push เดียว)

### K.8 เงิน (เบา)
**v1-2: growth ล้วน ไม่มี $ ตรง** — monetize พฤติกรรมผ่าน rail เดิม: fork/deploy **กิน credit** (remix = build = กิน credit, ไม่ต้องสร้าง billing ใหม่) + DFY-LINE upsell. **ทีหลัง (เมื่อมี volume):** featured/boost (เงินไหลเข้าหาเรา = paid layer แรกที่ปลอดภัย) → gate fork-of-premium ใน tier จ่าย. **creator cash payout = v3** (ดึง marketplace weight กลับมา — คงแรงจูงใจด้วย status + credits ก่อน)

### K.9 v1/v2 + minimal hooks วันนี้
**public showcase = v2; แต่ lineage + capture hooks = v1 (ตอนนี้)** — ship gallery ก่อนมี core builder + run-and-repair + flywheel-capture ไม่ได้ (เปิดโปงโค้ด unvalidated + เจือจาง corpus). เก็บ data ก่อน เปิด gallery ทีหลังเมื่อมี winner verified seed
**Sequencing:** v1 = core+capture+hooks (library private) · v1.5 = lineage internal + ทดสอบ secret-strip/static-scan · v2 = public pages+fork+LINE+license+rating+featured · v3 = paid boost / payout
**Hooks ใส่ `egs_projects` ตอนนี้ (retrofit แพง):** `forked_from_id`, `root_id`, `fork_depth`, `visibility`('private'default), `license`('view-only'default), `forkable`(generated), `first_run_green`, `repair_count`, `ran_green`, `target`, `fork_count`/`deploy_count`/`view_count`/`worked_for_me_count`, `moderation_status`, `safety_scan`(jsonb). + ตารางวาง shape: `egs_worked_for_me`(deploy-gate ใน DB ผ่าน EXISTS check), `egs_reports`, `egs_scope_cache`. RLS public-read gate `visibility='public' AND moderation_status='approved'` (เขียน policy ทิ้งไว้). secret-strip + static-scan = stub เรียกตอน run-and-repair stash ลง `safety_scan` → publish gate ภายหลังแค่ flip status
→ ผลลัพธ์: showcase = **read view + publish action เดียว** เหนือ data ที่สะสมตั้งแต่ v1 ไม่ใช่ migration+backfill ตอน launch

### K.10 Showcase — โหมดแชร์ (โชว์+ติดต่อ / ฟรี-fork) + comments

> **แก้ 2026-06-14 (founder clarify):** easygas **ไม่ใช่ระบบขาย / ไม่ process เงินของ creator**. showcase = portfolio; creator ที่อยากขาย → ใส่ปุ่ม "ติดต่อ" แล้วดีลกันเอง **นอกแพลตฟอร์ม** (เหมือน Behance/Dribbble "ติดต่อจ้าง"). **ตัด credit_ledger / paid-template / subscription / payout / commission / rev-share ทิ้งทั้งหมด** (over-engineer ของรอบก่อน)

**แต่ละ public project เลือก 1 ใน 2 โหมด:**

**โหมด 1 — "โชว์อย่างเดียว ไม่แชร์โค้ด + ติดต่อเพื่อใช้งาน"** (`license='view-only'`)
- โชว์ screenshot/preview + คำอธิบาย, **ไม่เปิด code viewer / ไม่มีปุ่ม fork**
- ปุ่ม **"ติดต่อเพื่อใช้งาน"** — creator ใส่ contact เอง (LINE id/ลิงก์/เบอร์/อีเมล) → คนสนใจกดติดต่อตรง → **ดีล/ซื้อกันเอง นอกแพลตฟอร์ม**
- easygas = ที่โชว์ + lead connector เท่านั้น **ไม่แตะเงิน** (เช่นระบบอ่านสลิป+แจ้งเตือน LINE: โชว์ว่าทำได้ → "สนใจติดต่อ")

**โหมด 2 — "ฟรี + กำหนด policy + ให้ fork ต่อ"** (license = cc-by/cc-by-nc/mit §K.2)
- creator ตั้ง license/policy → เปิด **fork** (copy ลงบัญชีตัวเอง, strip secrets §K.3)
- เก็บสถิติ **fork_count + deploy_count** + **rating** (deploy-gated "ใช้ได้จริง" §K.5) + **comments**

**Comments (founder ขอ):** `egs_comments(id, project_id, user_id, body, status, created_at)` — authed user คอมเมนต์ได้ (flat ต่อโปรเจกต์ ไม่ใช่ forum), creator pin/ลบบนของตัวเองได้, report→hide. โผล่บนทั้ง 2 โหมด

**หน้าโปรไฟล์ `/@handle` = read-view:** avatar/bio/verified + portfolio (public projects) + aggregate stats (fork/deploy/rating รวม) + follow + ปุ่มติดต่อรวม (ถ้ามีโหมด 1). **ไม่มี** price/subscribe/payout/seller-dashboard

**✂️ ตัดทิ้ง (ไม่ทำ — easygas ไม่ process เงินของ creator):** credit_ledger · purchases · paid-template · subscription · payout · commission · cash-payout · rev-share. ใครจะขาย = ใส่ปุ่ม "ติดต่อ" ดีลเอง

**hooks (เบา, แทนของหนักรอบก่อน):**
```sql
creators(user_id PK, handle UNIQUE, bio, avatar_url, is_verified, contact_default null)  -- profile @handle (ไม่มี payout/credit)
egs_projects +: contact_label, contact_url (null = ไม่มีปุ่มติดต่อ; โหมด 1)
              -- visibility/license/forkable/fork_count/deploy_count/worked_for_me_count มีแล้ว §K.9
egs_comments(id, project_id, user_id, body, status default 'visible', created_at)
follows(follower_id, creator_id, created_at)   -- creator audience
-- ❌ ตัด: credit_ledger, purchases, tips, payout, price_credits
```

> **หมายเหตุ:** ถ้าอนาคตอยากให้ "creator host ระบบให้คนอื่น subscribe จริง" → ยังเป็น **web target (§J) เท่านั้น** (GAS host multi-tenant ไม่ได้: `executeAs=creator` → subscriber กินโควตา+ข้อมูลปนกัน) — แต่**ตอนนี้ไม่เกี่ยว** เพราะ "อยากขาย" = ใช้ปุ่ม "ติดต่อ" ดีลเอง

---

## L. Operations — quota model (3 ถัง) + Superadmin console

> เพิ่ม 2026-06-14. โควตาในระบบ **แยกกัน ไม่คิดรวม** ตาม "ใครเป็นเจ้าของ key/บัญชีที่ทำงาน"; superadmin console = ที่เฝ้าทั้งหมด

### L.1 Quota — 3 ถังที่ไม่ปนกัน
| # | ถัง | นับที่ใคร | ใช้ตอนไหน | ใครดูแล |
|---|---|---|---|---|
| **A** | **GAS runtime** (email 100/วัน, UrlFetch 20k/วัน, execution 6นาที, trigger 90นาที/วัน) | **บัญชี Google ของลูกค้า** | แอปที่ลูกค้า deploy **รันจริง** | ลูกค้า (โควตาเขาเอง = เราจ่าย $0) |
| **B** | **Apps Script REST API** (requests/day, /min/user) | **GCP project / OAuth client ของ easygas** | ทุก `projects.create/updateContent/deployments` ที่ "ระบบเรา" ยิง | **เรา — shared ทุกลูกค้า ต้องมอนิเตอร์+ขอเพิ่มตอนโต** |
| **C** | **Credit/token** (Anthropic + "X โปรเจกต์/เดือน") | **billing ของ easygas** | ตอน AI เขียน/แก้ (ที่คิดเงิน) | เรา (margin + kill-switch) |

**กฎ verification ห้ามกินถัง A ของลูกค้า:** run-and-repair รันบนบัญชีลูกค้า (โค้ดอ้าง Sheet ลูกค้า) → ต้อง **dry-run side effects** (ไม่ส่งเมลจริง/stub MailApp หรือส่งหาเจ้าของเท่านั้น), ใช้ **scratch Sheet ทิ้ง** (Recipe A), **loop ≤3 + cap token/โปรเจกต์** — กันเผาโควตาอีเมล/execution ของลูกค้า
**ถัง B = สิ่งที่ต้องเฝ้าตอนสเกล:** Apps Script API มี daily limit ต่อ GCP project (ของเรา) + per-user rate → มอนิเตอร์ใน superadmin, ขอ quota increase จาก Google ล่วงหน้า, per-user limit กันคนเดียวยิงจนคนอื่นใช้ไม่ได้

### L.2 Superadmin / Operator console — `/admin`, role `superadmin`
แยกจาก admin ทั่วไป; guard `requirePageRole(['superadmin'])` + RLS + audit log. 7 โซน:
1. **ภาพรวม** — KPI cards: first-run-green%, active builders, deploys วันนี้, MRR, token COGS, **API quota ถัง B %**, queue health
2. **Quality/Moat** ⭐ — first-run-green trend (by target/model), repair-count dist, gate pass rate (G0/1/2), **A/B Sonnet vs DeepSeek (cost/green-project → decision data §A7)**, capability router GAS-vs-web demand (§J), usersettings-403 funnel
3. **Operations/Quota** — **ถัง B usage vs limit + projection/alert ก่อนชน**, ถัง C spend, BullMQ queue (pending/running/failed), error log, deploy success rate, per-user API heavy-hitters
4. **การเงิน** — **คิวอนุมัติสลิป PromptPay** (งานจริงรายวัน), plan distribution, credits, revenue, margin + kill-switch status, DFY-LINE leads (§K)
5. **ผู้ใช้** — user list + **ตั้ง plan/credits ด้วยมือ** (billing MVP §MONETIZATION), Google connection status (active/needs_reauth/revoked), per-user spend, kill-switch override
6. **Moderation** (showcase v2) — report/quarantine queue, **safety_scan flags** (scope-diff/lint hard-flag §K.6), featured curation
7. **Config** — feature flags (DeepSeek rollout = PostHog), template/rulebook (corpus), UrlFetchApp domain allowlist

**หลักการ:** อย่ารื้อ analytics ที่ **PostHog ให้ฟรี** (funnel/retention/replay) — console = operator (อนุมัติสลิป/ตั้งเครดิต/เฝ้า quota+KPI/moderate) + ฝัง/ลิงก์ PostHog
**MVP:** ④ อนุมัติสลิป + ตั้ง plan/credits · ② first-run-green KPI · ③ เฝ้า quota+error · ⑤ user list
**Defer:** ⑥ moderation · ② A/B dashboard เต็ม · ⑦ featured curation
**Data:** Supabase metrics tables (`egs_runs`/`egs_metrics` — เก็บตั้งแต่ v1 ตาม flywheel-capture) + egs_projects + payments + google_connections + PostHog embed
