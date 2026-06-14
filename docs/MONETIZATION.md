# easygas — โมเดลหาเงิน (จาก research workflow, 2026-06-13)

> วิจัยราคาคู่แข่งปี 2026 (bolt.new/Lovable/v0/Replit/Copilot) + คำนวณ unit economics จากราคา Anthropic จริง + ตลาดไทย

## 1. คำตอบสั้น
**Subscription รายเดือนที่ผูก "เครดิต AI" ในแต่ละแพ็ก + ขายเครดิตเติม (top-up) ผ่าน PromptPay + เปิด BYOK (เอา Anthropic key ตัวเองมาใส่) สำหรับ power user** — ไม่ใช่ flat unlimited (เจ๊งถ้าคนใช้หนัก) และไม่ใช่ pure credits เปล่าๆ (ลูกค้าไทยกลัว "กดทีไรเสียเงิน")

เหตุผล: (1) ต้นทุนจริง = Anthropic token ต่อทุก turn → ต้องมี cap เสมอ (2) SMB ไทยชอบบิลรายเดือนคาดเดาได้ (FlowAccount ฿199/299 = anchor) (3) BYOK เปลี่ยน worst-case loss เป็นกำไรล้วน ตลาดทั้งหมด (Lovable/v0/Copilot) คอนเวิร์จมาโมเดลนี้

## 2. Unit economics (ต่อโปรเจกต์ = สร้าง GAS tool 1 ตัว ~10-11 turn, Sonnet 4.6)
| สถานการณ์ | ต้นทุน |
|---|---|
| ไม่มี caching | ~$2.0 (฿72) |
| caching จริง (มีช่วง cache หมดอายุ) | $1.2-1.6 (฿43-58) |
| + Opus วางแผน one-shot | +$0.13 (฿5) |
| รันทั้ง loop บน Opus (**ห้าม**) | $3-4 (฿108-145) |

ต้นทุน blended ~**฿55/โปรเจกต์** เมื่อทำ: prompt caching (`ttl:"1h"` บน rulebook 15K token ลด input ~50%) + routing (Opus เฉพาะ plan one-shot, Sonnet รัน loop — cache ข้ามโมเดลไม่ได้)

**กฎเหล็ก:** ตั้งราคาให้ revenue ≥ COGS × margin ที่ **เพดาน cap** ไม่ใช่ค่าเฉลี่ย; markup เป้าหมาย 2-3× (margin ≥ 60%)

## 3. แพ็กเกจราคา (THB) — "1 เครดิต = 1 โปรเจกต์/แก้ใหญ่ 1 รอบ" (ซ่อน token math)
| Tier | ราคา/เดือน | รวม | cap |
|---|---|---|---|
| **Free** | ฿0 | 3 โปรเจกต์, Sonnet, watermark, **ไม่มี auto-deploy** | 3 โปรเจกต์, 300K token/โปรเจกต์ |
| **Starter** | **฿299** | ~6-10 โปรเจกต์, Sonnet loop เต็ม, auto-deploy, ไม่มี watermark | 400K token/โปรเจกต์, ≤25 turn |
| **Pro** | **฿790-990** | ~15-20 โปรเจกต์, +Opus วางแผน, cache 1ชม., priority | kill-switch เมื่อ COGS เกินเส้น |
| **Top-up** | ฿99/5 เครดิต · ฿299/20 | เครดิตล้น จ่าย PromptPay | ไม่หมดอายุ 6 เดือน |
| **Power/Agency (BYOK)** | **฿390 platform fee** | **ไม่จำกัด**, ใช้ key ตัวเอง | ไม่มี (token เป็นของลูกค้า) |
| **GAS Builder (done-for-you)** | **฿3,000-9,000+/โปรเจกต์** | คนทำให้ ส่งทาง LINE | – |

⚠️ **margin warning:** ฿299 cap 10 โปรเจกต์ = ฿550 ต้นทุนถ้าใช้เต็ม → ขาดทุน! เดิมพันว่าคนส่วนใหญ่ใช้ ~2-3 โปรเจกต์ ปลอดภัยกว่า: Starter cap 5-6 โปรเจกต์ หรือ Pro ฿990. สูตรนอนหลับสบาย: **cap/เดือน × ฿55 ≤ 40% ของราคาแพ็ก**

## 4. อยู่ร่วมกับ GAS Builder (done-for-you) — 2 SKU บน funnel เดียว ไม่แย่งกัน
- **easygas (self-serve, ฿299-990)** = top-of-funnel + lead-gen, กินงานปลายล่างที่ไม่คุ้มเวลา founder
- **GAS Builder (฿3,000-9,000)** = high-margin upsell, งานที่อยากได้การันตี/เกินขอบเขต self-serve
- **กลไก handoff:** ปุ่ม "ให้ทีมช่วยทำให้" เมื่อแชทซับซ้อน/deploy fail → route ไป LINE OA **พร้อมแนบ spec + บทสนทนา** → เปลี่ยน token ที่เผาไปเป็น qualified lead

## 5. กระจาย & แปลงลูกค้า (CAC ~ศูนย์ส่วนเพิ่ม)
- **LINE OA friend base เดิม** (จาก GAS Builder/KPPromptCreator) re-market ให้คนที่แสดง intent ซื้อ GAS มาแล้ว
- **PromptPay slip = รางจ่ายเงินที่มีอยู่แล้ว** — QR → อัปสลิป → ปลดล็อก (ดีกว่าผูกบัตร recurring สำหรับ SMB ไทย)
- Flow: broadcast → ฟรี 3 โปรเจกต์ (เก็บ LINE lead) → ชน cap → PromptPay → Starter → ติดงานยาก → handoff → GAS Builder

## 6. กันขาดทุน/โดนใช้เกิน (บังคับ ไม่ใช่ทางเลือก)
1. เพดาน token/โปรเจกต์ (~400K) + `max_tokens` ต่อ response (ใช้ Anthropic Task Budgets)
2. จำกัดโมเดลตาม tier — Free/Starter = Sonnet เท่านั้น, Opus = Pro
3. จำกัด turn (≤25/โปรเจกต์) + rate limit — กัน tool-loop วิ่งหนี
4. บังคับ caching ฝั่ง server — เช็ค `cache_read_input_tokens > 0` ใน telemetry (ถ้า 0 = มีตัวทำลาย cache เผา input แพง 10×)
5. เพดาน COGS/user/เดือน + kill-switch → downgrade เป็น BYOK เมื่อแตะเส้น margin

## 7. MVP monetization — เก็บเงินวันแรกแบบเบาสุด (อย่าเพิ่งสร้าง credit metering + recurring)
1. ฟรี cap แข็ง 3 โปรเจกต์/เดือน (counter ใน Supabase) + เพดาน token/โปรเจกต์ — **ห้ามข้าม**
2. ชน cap → **PromptPay QR ฿299 → อัปสลิป (หรือส่ง LINE)** → founder กดยืนยัน set `plan/credits` ด้วยมือ (เหมือน GAS Builder เป๊ะ ยังไม่ต้องมี gateway/recurring)
3. UI โชว์ "เหลือ 7 โปรเจกต์" ไม่โชว์ token
4. ปุ่ม handoff GAS Builder ตั้งแต่วันแรก — **รายได้ก้อนแรกจริงน่าจะมาจากตรงนี้** (฿3,000+) ก่อน subscription scale

**โค้ดวันแรกที่ห้ามข้าม:** counter โปรเจกต์/เดือน + เพดาน token, prompt caching บน rulebook, หน้า PromptPay QR + อัปสลิป (reuse จาก kpbeautyclinic `payments.slip_*`), ปุ่ม admin set plan, ปุ่ม handoff LINE
**ยังไม่ต้องทำ:** payment gateway อัตโนมัติ, recurring billing, token-level metering, BYOK UI
