# CLAUDE.md

## ภาพรวมโปรเจกต์

**easygas** = "VS Code + Claude Code บนเว็บ" เฉพาะทาง **Google Apps Script (GAS) + Google Workspace** —
ผู้ใช้ล็อกอิน → เชื่อมต่อบัญชี Google ของตัวเอง → คุยกับ AI ที่เขียนโค้ด GAS ลงในเอดิเตอร์ในเว็บ →
พรีวิวสด → กดปุ่ม deploy เข้าบัญชี Google ของผู้ใช้เองอัตโนมัติ (ผ่าน Apps Script REST API — **ไม่ใช้ clasp ฝั่งเซิร์ฟเวอร์**)

เป้าหมาย: ผู้ใช้ภายนอกหลายคน (SMB/ฟรีแลนซ์/พนักงานออฟฟิศไทยที่ใช้ Sheets/Drive/Gmail แต่เขียนโค้ดไม่เป็น) —
เป็นเวอร์ชัน self-serve อัตโนมัติของบริการ "GAS Builder / สั่งสร้างระบบ" ที่ทำมือใน KPPromptCreator

Tech stack (ยืนยัน 2026-06-14): Next.js 15 (App Router, Route Handlers/SSE) + React 19 + TS / Tailwind v4 / **Monaco** (lazy, ssr:false) / **TanStack Query** (server state) + **Zustand** (live SSE-fed editor/chat) / Supabase (Postgres + RLS + Auth-identity + Storage `egs-refs`) / **@anthropic-ai/sdk** (Sonnet 4.6 codegen / Opus 4.8 plan) + **CodegenProvider router** (DeepSeek-V4-Pro = candidate, A/B-gated) / **Apps Script REST API** + custom Google OAuth (GASAdapter; web target later via `DeploymentTarget` seam) / Jobs: route handler → **BullMQ+Redis บน Railway** เมื่อโต / Telemetry: **Supabase tables** (moat KPI) + **PostHog** (funnel/flags) / Payment: PromptPay slip manual / Hosting: Railway (~$5) + Supabase free → scale

> **เอกสารหลัก:** `docs/BUILDPLAN.md` (สถาปัตยกรรม + roadmap Phase 0–8, source of truth) · `ARCHITECTURE.md` (บทวิเคราะห์ตั้งต้น "Ship B, design toward C") · `README.md` (วิธี setup + manual test Phase 0)

## คำสั่ง

```bash
npm run dev          # dev server (localhost:3000)
npm run build        # production build (ใช้ตรวจ type/compile ก่อน commit)
npm run lint
npm run keygen       # สร้าง APP_ENCRYPTION_KEY (base64 32-byte) สำหรับเข้ารหัส token
```

Env: คัดลอก `.env.example` → `.env` — ตัวที่ขาดไม่ได้: Supabase URL/anon/service-role, `GOOGLE_OAUTH_CLIENT_ID/SECRET/REDIRECT_URI`, `APP_ENCRYPTION_KEY`, `ANTHROPIC_API_KEY` (Phase 2+) รายละเอียดครบใน `README.md`

## โครงสร้างหลัก

- `app/` — หน้าเว็บ + Route Handlers: `/login` (Supabase identity), `/connect` (+`/done`, custom Google OAuth grant), `/projects/[id]` (IDE shell — Phase 3+), `/privacy`, และ `api/`:
  - `api/auth/google/{start,callback,disconnect}` — custom OAuth flow (แยกจาก Supabase Auth)
  - `api/deploy/[projectId]` (Phase 5) — pipeline create→updateContent→version→deployment (Phase 0: `api/deploy/spike`)
  - `api/agent/[projectId]` (Phase 2) — SSE streaming agentic loop
  - `api/preview/[projectId]` (Phase 6) — push scratch script → Tier-2 `/dev` URL
- `lib/` — โค้ดหลัก (stack-agnostic ใช้ต่อทุกเฟส):
  - `google-oauth.ts` — buildAuthUrl/exchangeCode/refreshAccessToken/revoke + **scope contract** (`GOOGLE_SCOPES`)
  - `google-connection.ts` — `getValidAccessToken(userId)` (load→decrypt→refresh)
  - `crypto.ts` — AES-256-GCM, `gas-script-api.ts` — REST wrapper, `manifest.ts`, `errors.ts`
  - `gas-codegen.ts` (Phase 1, port จาก KPPromptCreator) · `anthropic-agent.ts` (Phase 2) · `preview-shim.ts` (Phase 4)
  - `supabase/{server,service,client}.ts` — server(RLS) / service-role(server-only) / browser(login)
- `components/ide/*` (Phase 3+) — Monaco EditorPane, ChatPanel, PreviewPane, FileTree
- `store/*` (Phase 3) — Zustand: `applyFileMutation()` รับ mutation ที่ server echo ผ่าน SSE
- `supabase/migrations/` — `egs_projects/files/messages/deployments` + `google_connections` (RLS owner-scoped)

## กติกาสำคัญ (locked decisions — ดู `docs/BUILDPLAN.md` §A)

- **Auth 2 ชั้น**: Supabase Auth = login/identity เท่านั้น (`openid email`); **custom Google OAuth flow แยก** เก็บ encrypted refresh token ใน `google_connections` — Supabase ไม่ persist/refresh `provider_refresh_token` **ห้าม**ขอ script scopes ผ่าน Supabase provider
- **Scope contract (ห้ามเกิน)**: `openid email` + `script.projects` + `script.deployments` + `drive.file` (เพิ่ม `script.scriptapp` เฉพาะ trigger path) — ทั้งหมด sensitive ยกเว้น `drive.file` (non-sensitive) → verification เบา **ไม่โดน CASA** **ห้ามแตะ** `drive`/`drive.readonly`/`gmail.*` (restricted) เด็ดขาด
- **Token ต้องเข้ารหัสเสมอ** (AES-256-GCM ผ่าน `lib/crypto.ts`) — decrypt ฝั่ง server ผ่าน service-role เท่านั้น ไม่มี client SELECT คอลัมน์ token
- **Deploy ผ่าน REST API ตรง ไม่ใช้ clasp** — และ **PATCH deployment เดิมเสมอ ห้ามสร้างใหม่** (hard cap 20 deployments/script + URL จะเปลี่ยน)
- **manifest** ที่ push ต้องมี `webapp:{access:'ANYONE_ANONYMOUS', executeAs:'USER_DEPLOYING'}` + `timeZone:'Asia/Bangkok'` + `runtimeVersion:'V8'` (ใช้ `lib/manifest.ts`)
- **กำแพง usersettings 403**: ทุก end user ต้องเปิด Apps Script API ที่ `script.google.com/home/usersettings` เองครั้งเดียว ไม่งั้น `projects.*` 403 — เลี่ยงไม่ได้ ต้องมี onboarding (ดู `UserSettingsDisabledError` ใน `lib/errors.ts`)
- **OAuth consent screen ต้องเป็น Production ไม่ใช่ Testing** — Testing+External ทำให้ refresh token หมดอายุใน 7 วัน
- **Tier preview 2 ชั้น**: Tier 1 = `<iframe srcdoc>` + shim `google.script.run` (default, ไม่แตะ Google, sandbox `allow-scripts` ห้าม `allow-same-origin`); Tier 2 = `/dev` iframe (best-effort + probe + fallback "เปิดบน Google ↗")
- **AI**: `@anthropic-ai/sdk` ตรง + manual agentic loop (ไม่ใช้ Vercel AI SDK); model `claude-sonnet-4-6` default codegen / `claude-opus-4-8` เฉพาะ turn architect/plan; prompt-cache GAS rulebook (cache เป็น model-scoped — สลับ model = cold write 1 ครั้ง)
- **แก้โค้ดด้วย tool-use ไม่ full-regen** หลัง Turn 0 (`write_file`/`edit_file`/`delete_file`/`read_project`); server เป็นเจ้าของ `egs_files` → echo mutation ทาง SSE; `validateGasFiles` ใน loop กัน import/export/require
- **RLS**: ทุกตาราง `egs_*` owner-scoped (`owner_id = auth.uid()`); agent loop เขียนผ่าน service-role + guard `owner_id` ในโค้ด
- **ข้อความ UI ภาษาไทย, โค้ด/identifier อังกฤษ** (เหมือน kpbeautyclinic)

## สถานะ roadmap (ดู `docs/BUILDPLAN.md` §E)

- ✅ **Phase 0 — De-risk spike**: OAuth(2-ชั้น) + crypto + Apps Script pipeline + usersettings-403 + 1 hardcoded web app → `/exec` (พิสูจน์ critical chain — **ต้องเดิน manual test บนบัญชี Google จริงก่อนต่อ Phase 1**)
- ⏳ **Phase 1**: schema/CRUD + port `gas-codegen.ts`
- ⏳ **Phase 2**: agent loop (SSE + tool-use + prompt cache + model routing)
- ⏳ **Phase 3**: Monaco IDE shell + Zustand sync
- ⏳ **Phase 4**: Tier-1 preview
- ⏳ **Phase 5**: deploy + bound script (Recipe A)
- ⏳ **Phase 6**: Tier-2 `/dev` preview
- ⏳ **Phase 7**: triggers (codegen installTriggers + best-effort scripts.run)
- ⏳ **Phase 8**: OAuth verification + onboarding walls + token-budget + launch

> **อย่าเพิ่งต่อ Phase ถัดไปจน Phase ก่อนหน้า verify** — โดยเฉพาะ Phase 0 ต้องเห็น `/exec` ขึ้นจริงก่อน
