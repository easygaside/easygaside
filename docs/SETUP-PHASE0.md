# Phase 0 — คู่มือ setup เพื่อพิสูจน์ chain (ละเอียด ภาษาไทย)

> เป้าหมาย: รัน spike แล้วเห็น URL `/exec` ขึ้นจริงบนบัญชี Google ของคุณ = พิสูจน์ว่ากลไก
> `OAuth → encrypted token → Apps Script REST API → deploy → live URL` ทำงาน (critical path ของทั้งโปรเจกต์)
> ใช้เงิน **฿0** (Supabase free + Google ฟรี + ค่า token Anthropic ยังไม่แตะใน Phase 0)

---

## ① Supabase (ชั้นข้อมูล) — ~5 นาที

1. ไป [supabase.com](https://supabase.com) → **New project** (free tier) → ตั้งชื่อ `easygas`, ตั้งรหัส DB, เลือก region **Southeast Asia (Singapore)**
2. รอ ~2 นาทีให้ project พร้อม
3. ไปที่ **Project Settings → API** คัดลอก 3 ค่า:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key (กดเผย) → `SUPABASE_SERVICE_ROLE_KEY` *(เก็บลับ! ห้ามขึ้น client)*
4. ไปที่ **SQL Editor** → New query → เปิดไฟล์ `supabase/migrations/20260613000000_baseline.sql` คัดลอกทั้งไฟล์มาวาง → **Run** → จากนั้นทำซ้ำกับ `20260613000100_google_connections.sql`
5. **(สำหรับ spike)** ไปที่ **Authentication → Providers → Email** → ปิด **"Confirm email"** (จะได้ login ทันทีหลังสมัคร ไม่ต้องยืนยันเมล)

---

## ② Google Cloud (GCP) — ~10 นาที ⚠️ ขั้นนี้สำคัญสุด

> ⚠️ **กฎเหล็ก: OAuth consent screen ต้องตั้งเป็น "Production" ไม่ใช่ "Testing"**
> เพราะ Testing + External ทำให้ refresh token **หมดอายุใน 7 วัน** → พังเรื่อง "push ได้ตลอด"

1. ไป [console.cloud.google.com](https://console.cloud.google.com) → สร้าง project ใหม่ ชื่อ `easygas-dev`
2. **เปิด API** (APIs & Services → Library → ค้นแล้วกด Enable ทีละตัว):
   - **Apps Script API**
   - **Google Drive API**
   - **Google Sheets API**
3. **OAuth consent screen** (APIs & Services → OAuth consent screen):
   - User type: **External** → Create
   - กรอก app name `easygas`, support email, developer email
   - **Scopes** → Add → ใส่ scope เหล่านี้ (sensitive แต่ไม่โดน CASA):
     - `.../auth/script.projects`
     - `.../auth/script.deployments`
     - `.../auth/drive.file`
     - `openid`, `.../auth/userinfo.email`
   - **สำคัญ:** หลังสร้างเสร็จ กด **PUBLISH APP** → เลือก **Production** (ยืนยัน) — ไม่ต้องรอ verification ก็ใช้ได้ถึง 100 คน
4. **Credentials → Create Credentials → OAuth client ID:**
   - Application type: **Web application**
   - ชื่อ: `easygas-web`
   - **Authorized redirect URIs** → Add → ใส่ให้ตรงเป๊ะ:
     ```
     http://localhost:3000/api/auth/google/callback
     ```
   - Create → คัดลอก **Client ID** → `GOOGLE_OAUTH_CLIENT_ID`, **Client secret** → `GOOGLE_OAUTH_CLIENT_SECRET`

---

## ③ Encryption key + .env — ~2 นาที

```bash
npm install          # ครั้งแรกเท่านั้น
npm run keygen       # พิมพ์ key base64 32-byte ออกมา → ใส่ APP_ENCRYPTION_KEY
cp .env.example .env # แล้วเปิด .env กรอกทุกค่า
```

`.env` ที่ต้องครบ:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
APP_ENCRYPTION_KEY=...        # จาก npm run keygen
```

---

## ④ รัน + ทดสอบ (manual test) — PASS คืออะไร

```bash
npm run dev
```

1. เปิด `http://localhost:3000/login` → สมัคร/ล็อกอิน (อีเมล+รหัส)
2. ไป `/connect` → กด **"เชื่อมต่อ Google"** → หน้า consent ขึ้น "Google hasn't verified this app" →
   กด **Advanced → Go to easygas (unsafe)** → ยอมรับ scopes (`script.projects`, `script.deployments`, `drive.file`)
3. กลับมา `/connect/done` → กด **"🚀 Deploy ตัวอย่าง"**
4. **ถ้าเจอ "ต้องเปิด Apps Script API ก่อน"** → กดลิงก์ไป
   [script.google.com/home/usersettings](https://script.google.com/home/usersettings) → เปิด toggle
   **Google Apps Script API = On** → กลับมากด **"ลองอีกครั้ง"**
   *(กำแพงนี้ end user ทุกคนต้องเปิดเองครั้งเดียว — เลี่ยงไม่ได้ ของจริงเราจะมี onboarding)*
5. ✅ **PASS เมื่อ:** ได้ลิงก์ `/exec` → กดเปิดในแท็บใหม่ → เห็น **"easygas works 🎉"**

### เช็คว่าถูกจริง
- Supabase → Table editor → `google_connections` → `refresh_token_enc` ต้องเป็น **base64 มั่ว ๆ ไม่ใช่ token ดิบ** (เข้ารหัสแล้ว)
- `egs_deployments` มี row + `exec_url`
- ลอง deploy ซ้ำอีกครั้ง → ต้องสำเร็จ **โดยไม่ต้อง re-consent** (พิสูจน์ refresh token ทำงาน)
  - ถ้าเจอ `NEEDS_REAUTH`/`invalid_grant` → consent screen ยังเป็น **Testing** อยู่ → กลับไปข้อ ②.3 เปลี่ยนเป็น Production

---

## ปัญหาที่เจอบ่อย
| อาการ | สาเหตุ / แก้ |
|---|---|
| `redirect_uri_mismatch` | redirect URI ใน GCP ไม่ตรงกับ `.env` เป๊ะ (ต้องมี `http://` + ไม่มี `/` ท้าย) |
| `USER_SETTINGS_DISABLED` (403) | ยังไม่เปิด Apps Script API ที่ usersettings → ข้อ ④.4 |
| `NEEDS_REAUTH` ตอน deploy ซ้ำ | consent screen เป็น Testing → token หมดใน 7 วัน → เปลี่ยนเป็น Production |
| iframe `/exec` ขาว | ปกติ — เปิดในแท็บใหม่ (Tier-2 preview เป็น fast-follow) |
| `APP_ENCRYPTION_KEY must decode to 32 bytes` | รัน `npm run keygen` ใหม่ แล้ว copy ให้ครบ |

พอ chain นี้เขียว = **พิสูจน์แล้วว่า premise ทั้งโปรเจกต์เป็นไปได้** → ลุย Phase 1-2 ต่อได้เต็มที่
