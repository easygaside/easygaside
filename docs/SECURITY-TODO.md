# Security TODO — จาก code review Phase 2 (2026-06-14)

รายการที่ **ยังไม่แก้** (ต้องใช้ infra/dep เพิ่ม หรือเป็น defense-in-depth) — ทำก่อนเปิดให้ user จริง

## ก่อนเปิดให้ user ภายนอก (สำคัญ)
- [~] **C-2 ownership ใน data layer (defense-in-depth):** `lib/files.ts` + `lib/messages.ts` ใช้ service-role — ปลอดภัยด้วย **single-caller invariant** (`/api/agent/[id]` เช็ค `getProject` RLS ก่อนเสมอ). ตั้งใจ defer: **ก่อนเพิ่ม call site ใหม่** ต้อง thread `userId` + เช็ค `owner_id`
- [x] **H-2 rate limiting:** ✅ concurrent-run lock ต่อ project (`egs_agent_runs` + `lib/agent-lock.ts`) + per-user daily cap (`EASYGAS_DAILY_LIMIT`, default 30) + **burst limiter** (`egs_rate_limit` + `lib/rate-limit.ts`: agent 20/นาที, deploy 10/นาที, fail-open)
- [x] **H-3 verify id_token signature:** ✅ `lib/google-oauth.ts verifyIdToken` ใช้ `jose` + Google JWKS (`oauth2/v3/certs`) verify iss/aud/exp — เรียกใน callback ก่อนเชื่อ claim ใด ๆ (เลิกใช้ decode ดิบ)
- [x] **Finding-2 concurrent-writer ใน egs_messages:** เพิ่มคอลัมน์ `seq` (identity) เรียงลำดับเสถียร + H-2 per-project lock

## hardening (Phase 8 / ทีหลัง)
- [x] **M-2:** ✅ service-role client ใช้ `SUPABASE_URL` (non-public) ก่อน แล้ว fallback `NEXT_PUBLIC_SUPABASE_URL`
- [x] **M-4:** ✅ security headers (`nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS) ใน `next.config.ts` + **CSP nonce-based แบบ Report-Only** ใน `middleware.ts` (สังเกต violation ก่อน). ⏳ ยังเหลือ: เทสต์ Monaco/preview กับ CSP แล้ว **flip เป็น enforce** (เปลี่ยนชื่อ header เป็น `Content-Security-Policy`)
- [x] **L-1:** ✅ cache `getKey()` ใน `lib/crypto.ts`
- [x] **L-2:** ✅ `lib/google-oauth.ts` log raw Google response ฝั่ง server, throw แบบ generic

## ✅ แก้แล้วใน review รอบนี้
- C-1 path allowlist (กัน traversal/ชื่อไฟล์แปลก) ใน `executeEgsTool`
- Resume bug (consecutive user msgs หลัง MAX_ITERATIONS cap) → roll back ให้จบที่ assistant turn
- project-level lint (เดิม lint แค่ไฟล์เดียว isWebApp:false) → ตรวจทั้งโปรเจกต์ feed กลับ model
- error ไม่รั่ว: SSE/agent + deploy spike คืน error code generic + log server-side (เดิมส่ง raw exception/scriptId/webAppUrl)
- SSE emit-after-close guard (`closed` flag)
- `parseCodegenOutput` regex ย้ายเข้า function (กัน lastIndex bleed) + `no-import` regex ครอบ dynamic/multiline import
- OAuth state cookie: narrow `path` เป็น `/api/auth/google` (คง `sameSite:lax` ซึ่งถูกต้องสำหรับ OAuth callback)
