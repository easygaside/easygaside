# easygas — HOSTING-PRICING: รายได้จากการโฮสต์ (stream ที่ 2)

> สรุปจากการคุยเรื่องกลยุทธ์ 2026-06-15. เอกสารนี้ว่าด้วย **เหตุผล/เศรษฐศาสตร์ฝั่งโฮสต์** — **ราคา/tier รวมเป็นแพ็กเกจเดียว (build × hosting) ที่ [[MONETIZATION.md]] §3 แล้ว** (เลิกแยก 2 ladder)
> เกี่ยวข้อง: [[MONETIZATION.md]] §3 (แพ็กเกจรวม = source of truth ราคา) · [[WEB-TARGET.md]] §6 (สถาปัตยกรรม hosting) · [[COST-MODEL.md]] (ต้นทุน data backend)
> **อัตราอ้างอิง ~34 THB/USD · ตัวเลขราคา cloud "verify ก่อนเดิมพันเงิน"**

---

## 0. TL;DR

- **รายได้มี 2 ก้อนแยกกัน** — อย่าปนกัน:
  - **🔧 AI credit (ตอน build)** = รายได้**หลัก** · **ทุกคน**จ่าย ไม่ว่าจะ deploy ที่ไหน · รายละเอียดใน [[MONETIZATION.md]]
  - **🌐 ค่าโฮสต์รายเดือน** = รายได้**รอง/เสริม** · จ่ายเฉพาะกลุ่มที่ **GAS ทำให้ไม่ได้** · เอกสารนี้
- **คนที่ใช้ GAS web app + Sheet ปกติ = Google โฮสต์ฟรี ไม่จ่ายค่าโฮสต์เรา — และนี่คือเรื่องที่ตั้งใจ** ปล่อยฟรีคือสิ่งที่ทำให้คนติด/บอกต่อ
- **ค่าโฮสต์เก็บเฉพาะกลุ่ม "โตเกิน GAS"**: กล้อง 📷 / หน้าร้าน public + โดเมนตัวเอง + SEO / scale ชนเพดาน GAS — กลุ่มนี้ willingness-to-pay สูงเพราะมันคือธุรกิจจริง
- **subdomain + โฮสต์ฟรี = ฟรีตลอดไป** (ผูก Sheet → ต้นทุนเรา ≈฿0) · เก็บเงินที่ **"ความเป็นทางการ"** (โดเมนเอง + เอา badge ออก + ใช้เชิงพาณิชย์ + always-on) ไม่ใช่ที่ usage
- **กฎเหล็ก:** managed tier ใช้ Supabase **pooled shared project เดียว + RLS** เท่านั้น — ห้ามแยก project ต่อราย (จะ ~฿340/ราย > ฿149 = ขาดทุนทุกบิล)

---

## 1. ทำไม GAS user ไม่จ่ายค่าโฮสต์ (และทำไมโอเค)

GAS web app + Sheet = **Google โฮสต์ให้ฟรี** (`script.google.com/.../exec`), data อยู่บัญชี Google ลูกค้า → ต้นทุนเรา ฿0, ค่าใช้จ่ายลูกค้า ฿0 ครอบเคสส่วนใหญ่: tool ภายใน, ฟอร์ม, จองคิว, log, dashboard อ่านอย่างเดียว

→ คนกลุ่มนี้ **ไม่ต้องจ่ายค่าโฮสต์ และควรปล่อยฟรี** เพราะเขายังจ่าย **AI credit ตอน build** อยู่ดี (รายได้หลัก) GAS ฟรีคือ "ปากทางฟรีที่ดูดคนเข้ามา"

## 2. ใครจ่ายค่าโฮสต์ — กลุ่ม "โตเกิน GAS"

GAS มีเพดานเชิงโครงสร้างที่แก้จากในไม่ได้ (ดู [[WEB-TARGET.md]] §1):

1. **กล้อง 📷** — `getUserMedia()` โดนบล็อกถาวรใน GAS iframe → ถ่ายรูปของส่ง/สแกนบัตร·QR/รูปสินค้า **ต้องโฮสต์เรา ไม่มีทางอื่น** (กลุ่มใหญ่สำหรับ SMB ไทย)
2. **หน้าร้าน public** — อยากได้ `ร้านฉัน.com` แทน URL `script.google.com/macros/s/AKfy.../exec` ที่น่าเกลียด, อยากให้ค้นเจอ (SEO), เอา badge ออก = ดูเป็นมืออาชีพ
3. **scale ชนเพดาน** — 429 (Sheets API 60 req/นาที), 30 concurrent execution ([[COST-MODEL.md]] §2) → ต้องหนีไป Supabase/โฮสต์เรา
4. realtime / npm / auth ต่อแถว — งาน modern ที่ GAS ทำไม่ได้

`capability router` ([[WEB-TARGET.md]] §5) ตรวจสัญญาณพวกนี้แล้ว route: ต้องกล้อง/realtime/โดเมน → web target (จ่าย), ไม่ต้อง → GAS (ฟรี)

---

## 3. ตารางแพ็กเกจ → รวมกับ build แล้ว

**ตารางราคา/tier ย้ายไปรวมเป็นแพ็กเกจเดียว (build × hosting) ที่ [[MONETIZATION.md]] §3 แล้ว** (เคาะ 2026-06-15 — เลิกแยก 2 ladder). hosting capability ต่อ tier:

- **Free** → GAS ฟรี + `ชื่อ.easygas.app` 1, มี badge, ห้ามเชิงพาณิชย์, Sheet
- **Lite ฿149** → โดเมนตัวเอง 1, เอา badge ออก, ใช้เชิงพาณิชย์ได้, always-on, Sheet
- **Starter ฿299** → + Supabase pooled (กล้อง/realtime)
- **Pro ฿990** → โดเมนตัวเอง 5, BYO-Supabase, password/coming-soon page, priority

เอกสารนี้เก็บเฉพาะ **เหตุผล/เศรษฐศาสตร์ฝั่ง hosting** (§1–2 ใครจ่าย, §4 cost, §5 retention, §6 ToS, §7 guardrails) — ราคาเป็น source of truth เดียวที่ MONETIZATION §3

## 4. ต้นทุนเรา vs รายได้ (ทำไมกำไร)

| Tier | ต้นทุน data ต่อราย/เดือน | ราคาขาย | margin |
|---|---|---|---|
| ฟรี | **฿0** (Sheet บน Google ลูกค้า) | ฿0 | เครื่องมือโต |
| Starter | ฿0 (Sheet) หรือ **฿5–25** (Supabase pooled) | ฿149 | สูงมาก — 1 ราย จ่ายค่า Supabase ของ ~6 ราย |
| Business | ฿5–25 (Supabase pooled) | ฿390 | สูงมาก |
| Pro | **฿0** (ลูกค้าจ่าย Supabase เอง) | ฿990 | สูงสุด |

- ชั้น hosting (Cloudflare) เป็นต้นทุน**แชร์**ทั้งระบบ ~$5–25/mo (egress $0, custom domain 100 แรกฟรี) — ไม่ใช่ต่อราย
- **map data backend:** ฟรี=Sheet · Starter=Sheet→pooled Supabase ถ้าต้องกล้อง · Business=pooled Supabase · Pro=BYO-Supabase ([[COST-MODEL.md]] §5.3)
- **กฎเหล็ก margin:** managed tier (Starter/Business) = **pooled shared Supabase + RLS เท่านั้น** ห้ามมี code path สร้าง project ต่อ tenant สำหรับ tier ต่ำกว่า Pro

## 5. ทำให้ "อยู่ยาว" + กระตุ้นอัปเกรด

**retention:** เว็บฟรีอยู่ตลอด (`ชื่อ.easygas.app`) + data ใน Sheet ของเขาเอง → ไม่มีเหตุผลให้ทิ้ง · พอธุรกิจจริงพึ่งเว็บนี้ = switching cost สูง

**ตัวกระตุ้นอัปเกรด (emotional ไม่ใช่กำแพง usage — แบบ Vercel Hobby):**
1. เห็น badge "สร้างด้วย EasyGAS" บนเว็บธุรกิจ → อยากเอาออก
2. อยากใช้ `ร้านฉัน.com` → ดูมืออาชีพ
3. จะรับเงิน/ขายจริง → ToS บังคับต้องอัปเกรด (§6)

**Annual prepay:** ดันจ่ายรายปี (PromptPay ทีเดียว) — SMB ไทยชอบจ่ายปีละครั้งมากกว่าตัดบัตรรายเดือน + ตัด churn/บัตรเด้ง

**ห้าม double-bill:** publish/ขึ้นเว็บ = **0 credit** (credit ไว้ build เท่านั้น) — ไม่งั้นเก็บทั้ง credit ทั้งค่าโฮสต์ตอน "ขึ้นเว็บ" = บล็อกการ convert

## 6. ToS: ฟรี = ห้ามเชิงพาณิชย์ (ร่างไทย)

> **การใช้งานแผนฟรี (Free)**
> แผนฟรีมีไว้สำหรับการทดลอง เรียนรู้ และใช้งานส่วนตัวที่ไม่แสวงหากำไรเท่านั้น เว็บไซต์/แอปบนแผนฟรี **ห้าม** ใช้เพื่อ: ขายสินค้าหรือบริการ, รับชำระเงิน, แสดงโฆษณา, หรือกิจกรรมเชิงพาณิชย์อื่นใด หากต้องการใช้เชิงพาณิชย์ ต้องอัปเกรดเป็นแผน Starter ขึ้นไป
>
> เว็บบนแผนฟรีจะแสดงป้าย "สร้างด้วย EasyGAS" และอาจถูกพักการทำงานหากไม่มีการเข้าชมเกิน 30 วัน (กู้คืนได้ 1 คลิก) เราขอสงวนสิทธิ์ระงับเว็บที่ละเมิดข้อกำหนดนี้

**ความจริงเรื่องบังคับใช้:** ตรวจ "เชิงพาณิชย์" 100% ไม่ได้ — มันเป็น **คันโยกทางจิตใจ + บังคับเป็นจุดๆ** (มีคนรายงาน, เจอปุ่มจ่ายเงินชัดๆ, traffic สูงผิดปกติ) ตัวดึง upgrade จริงคือ badge + โดเมน ไม่ใช่การไล่จับ

## 7. การ์ดกันรั่ว (เปิดวันแรก — [[WEB-TARGET.md]] §7)

- subdomain ฟรีอยู่บน **apex แยก** (`*.easygas-sites.app`) → phishing โดน Safe Browsing แบนไม่ลามโดเมนลูกค้าจ่ายเงิน
- **auto-sleep** แอปฟรีไม่มีคนเข้า 30 วัน (กดคืนได้) + bandwidth cap แบบ **soft** (เตือน ไม่ตัด)
- สแกนเนื้อหา + verify เบอร์/LINE ก่อนเว็บฟรีขึ้น public
- free = **Sheet เท่านั้น** (กล้อง/Supabase ที่มีต้นทุนจริง = ต้องจ่าย)
- `service_role` Supabase ห้ามขึ้น browser (Edge Function เท่านั้น) + default-deny RLS ทุกตาราง = security gate ก่อนแอป web ขึ้น

---

## 8. ค้าง / ขั้นต่อไป

- **AI credit ตอน build (รายได้หลัก)** — refine ใน [[MONETIZATION.md]] (จะคุยต่อ): ฟรีเท่าไหร่, เก็บยังไงให้คนไทยจ่าย, เติม/cap/BYOK
- ยังไม่ build hosting จริง — รอเคาะ Phase A (static-web adapter) ก่อน ([[WEB-TARGET.md]] §5)
- ตัวเลขราคา cloud/Supabase re-verify ก่อนประกาศราคาจริง
