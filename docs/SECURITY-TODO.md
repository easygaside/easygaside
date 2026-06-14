# Security TODO — จาก code review Phase 2 (2026-06-14)

รายการที่ **ยังไม่แก้** (ต้องใช้ infra/dep เพิ่ม หรือเป็น defense-in-depth) — ทำก่อนเปิดให้ user จริง

## ก่อนเปิดให้ user ภายนอก (สำคัญ)
- [ ] **C-2 ownership ใน data layer (defense-in-depth):** `lib/files.ts` + `lib/messages.ts` ใช้ service-role ไม่มี ownership check ในฟังก์ชันเอง — ตอนนี้ปลอดภัยเพราะ **caller เดียว** (`/api/agent/[id]`) เช็ค `getProject` (RLS) ก่อนเสมอ. **ก่อนเพิ่ม call site ใหม่** → thread `userId` เข้าไป + เช็ค `owner_id` ใน query
- [ ] **H-2 rate limiting:** `/api/agent/[id]` + `/api/deploy/*` ไม่มี rate limit → 1 user ยิงรัวเผา Anthropic quota (ถึง 8 iters × 8k tokens/req). เพิ่ม per-user limit (Upstash/Supabase counter) + **lock กัน concurrent agent run ต่อ project** (flag/advisory lock)
- [ ] **H-3 verify id_token signature:** `lib/google-oauth.ts decodeIdToken` decode เฉย ๆ ไม่ verify ลายเซ็น (ความเสี่ยงต่ำเพราะ token มาจาก Google ตรงผ่าน TLS) → ใช้ `jose` + JWKS (`oauth2/v3/certs`) verify iss/aud/exp ก่อน production
- [ ] **Finding-2 concurrent-writer ใน egs_messages:** `appendMessages` ใช้ insert ไม่มี guard → 2 req พร้อมกันบน project เดียวอาจ insert ซ้ำ. เพิ่มคอลัมน์ `sequence` + unique `(project_id, sequence)`

## hardening (Phase 8 / ทีหลัง)
- [ ] **M-2:** service-role client ใช้ `NEXT_PUBLIC_SUPABASE_URL` → เพิ่ม `SUPABASE_URL` (ไม่ public) ใช้ฝั่ง server
- [ ] **M-4:** security headers ใน `next.config.ts` — CSP (nonce-based), HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`
- [ ] **L-1:** cache `getKey()` ใน `lib/crypto.ts` (ตอนนี้ parse ทุกครั้ง) + บังคับ format base64 อย่างเดียว (กันสับสน hex/base64)
- [ ] **L-2:** `lib/google-oauth.ts` token-exchange error อย่าใส่ raw Google response ใน Error message

## ✅ แก้แล้วใน review รอบนี้
- C-1 path allowlist (กัน traversal/ชื่อไฟล์แปลก) ใน `executeEgsTool`
- Resume bug (consecutive user msgs หลัง MAX_ITERATIONS cap) → roll back ให้จบที่ assistant turn
- project-level lint (เดิม lint แค่ไฟล์เดียว isWebApp:false) → ตรวจทั้งโปรเจกต์ feed กลับ model
- error ไม่รั่ว: SSE/agent + deploy spike คืน error code generic + log server-side (เดิมส่ง raw exception/scriptId/webAppUrl)
- SSE emit-after-close guard (`closed` flag)
- `parseCodegenOutput` regex ย้ายเข้า function (กัน lastIndex bleed) + `no-import` regex ครอบ dynamic/multiline import
- OAuth state cookie: narrow `path` เป็น `/api/auth/google` (คง `sameSite:lax` ซึ่งถูกต้องสำหรับ OAuth callback)
