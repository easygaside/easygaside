# easygas — โมเดลหาเงิน (จาก research workflow, 2026-06-13)

> วิจัยราคาคู่แข่งปี 2026 (bolt.new/Lovable/v0/Replit/Copilot) + คำนวณ unit economics จากราคา Anthropic จริง + ตลาดไทย
>
> **ขอบเขต:** เอกสารนี้ = รายได้ก้อน **AI credit (ตอน build) = รายได้หลัก ทุกคนจ่าย**. รายได้ก้อนที่ 2 (ค่าโฮสต์รายเดือน เฉพาะกลุ่ม "โตเกิน GAS") อยู่ใน [[HOSTING-PRICING.md]] — สองก้อนนี้แยกกัน อย่าปน

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

## 3. แพ็กเกจราคา (THB) — หน่วย = "เครื่องมือใหม่/เดือน" (แก้ของเดิมไม่กินสิทธิ์)

**โมเดลที่ทำให้รู้สึกคุ้ม (เคาะ 2026-06-15):** ขายเป็น **จำนวนเครื่องมือใหม่/เดือน** (พาดหัวที่ลูกค้าเข้าใจ) — **การแก้/ปรับเครื่องมือเดิม "ไม่กินสิทธิ์ใหม่"** แต่ถูกคุมเงียบๆ ด้วย "ถังพลังงาน" (เพดาน token/โปรเจกต์ §6). บนจอโชว์ "เหลือสร้างใหม่ N ตัว" + แถบพลังงานต่อเครื่องมือ — **ไม่โชว์ token**.

| Tier | ฿/เดือน | รายปี (~2 ด.ฟรี) | สร้างใหม่/เดือน | ใช้งานพร้อมกัน | ถังพลังงาน/ตัว | model + ของแถม |
|---|---|---|---|---|---|---|
| **Free** | ฿0 | — | 2 | 2 | ~150K | Sonnet · watermark · ไม่มี auto-deploy |
| **Lite** | **฿149** | **฿1,490** | 3 | 5 | ~250K | Sonnet · เอา watermark · auto-deploy |
| **Starter** | **฿299** | **฿2,990** | 5 | 10 | ~400K | Sonnet loop เต็ม · ≤25 turn |
| **Pro** | **฿990** | **฿9,900** | 15 | ไม่จำกัด | ~600K | +Opus วางแผน · cache 1ชม. · priority |
| **BYOK** | ฿390 platform | ฿3,900 | ไม่จำกัด | ไม่จำกัด | — | key ตัวเอง (token เป็นของลูกค้า) |
| **Top-up** | ฿99 / 3 ตัว · ฿299 / 12 ตัว | — | เติม | — | — | PromptPay · ไม่หมดอายุ 6 ด. |
| **GAS Builder (done-for-you)** | **฿3,000-9,000+/โปรเจกต์** | — | — | — | — | คนทำให้ ส่งทาง LINE |

**roll-over:** สิทธิ์ "สร้างใหม่" ที่ไม่ใช้ เก็บข้ามได้ 1-2 เดือน — ไม่เพิ่มต้นทุน (token จ่ายตอนใช้จริง) ลด churn เดือนที่ไม่ได้สร้าง.

⚠️ **margin (realistic-bet ไม่ใช่ profit-at-cap):** "ถังพลังงาน" = เพดานต้นทุนจริงต่อโปรเจกต์ (~400K ≈ ฿55). คิดที่เพดานเต็มถัง: **Lite 3×~฿34 = ฿102 < ฿149 → ปลอดภัยแม้ max** (ถังเล็กช่วย); **Starter 5×฿55 = ฿275 / Pro 15×~฿82 = ฿1,230 → ขาดทุนถ้า max ทุกตัวจนเต็มถัง** → พึ่งค่าเฉลี่ยจริง (~2-3 ตัว, ถังไม่เต็ม) + **kill-switch COGS/user → เด้ง BYOK** กัน whale. เฝ้า `cache_read>0` + COGS/user ใน telemetry.

> **หมายเหตุชื่อชนกับ hosting:** ฿149 ที่นี่ = **Lite (build credit)**; ฿149 ใน [[HOSTING-PRICING.md]] = **Starter (ค่าโฮสต์)** — คนละก้อน. ภายหลังควรรวมเป็นหน้าราคาเดียว 2 แกน (build × host) หรือเปลี่ยนชื่อกันสับสน.

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
1. ฟรี cap แข็ง 2 เครื่องมือใหม่/เดือน (counter ใน Supabase) + เพดาน token/โปรเจกต์ (ถังพลังงาน) — **ห้ามข้าม**; การแก้ของเดิมไม่กินสิทธิ์ใหม่ (ดู §3)
2. ชน cap → **PromptPay QR (฿149 impulse / ฿299) → อัปสลิป (หรือส่ง LINE)** → founder กดยืนยัน set `plan/credits` ด้วยมือ (เหมือน GAS Builder เป๊ะ ยังไม่ต้องมี gateway/recurring)
3. UI โชว์ "เหลือสร้างใหม่ N ตัว" + แถบพลังงานต่อเครื่องมือ — **ไม่โชว์ token**
4. ปุ่ม handoff GAS Builder ตั้งแต่วันแรก — **รายได้ก้อนแรกจริงน่าจะมาจากตรงนี้** (฿3,000+) ก่อน subscription scale

**โค้ดวันแรกที่ห้ามข้าม:** counter โปรเจกต์/เดือน + เพดาน token, prompt caching บน rulebook, หน้า PromptPay QR + อัปสลิป (reuse จาก kpbeautyclinic `payments.slip_*`), ปุ่ม admin set plan, ปุ่ม handoff LINE
**ยังไม่ต้องทำ:** payment gateway อัตโนมัติ, recurring billing, token-level metering, BYOK UI
