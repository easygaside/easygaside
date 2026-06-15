# easygas — โมเดลหาเงิน (จาก research workflow, 2026-06-13)

> วิจัยราคาคู่แข่งปี 2026 (bolt.new/Lovable/v0/Replit/Copilot) + คำนวณ unit economics จากราคา Anthropic จริง + ตลาดไทย
>
> **ขอบเขต:** เอกสารนี้ถือ **แพ็กเกจรวม (build credit + hosting) เป็น source of truth** (§3, เคาะ 2026-06-15 — รวม 2 ladder เป็นก้อนเดียว). เศรษฐศาสตร์/สถาปัตยกรรมเฉพาะฝั่ง hosting (ใครจ่าย, cost model, pooled-Supabase, ToS, guardrails) อยู่ใน [[HOSTING-PRICING.md]]

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

## 3. แพ็กเกจรวม (build × hosting) — source of truth (เคาะ 2026-06-15)

**รวม build credit + hosting เป็นก้อนเดียว** (เลิกแยก 2 ladder — แก้ปัญหา ฿149 ชนชื่อด้วย). หน่วย build = **เครื่องมือใหม่/เดือน** (พาดหัวที่ลูกค้าเข้าใจ) — **การแก้/ปรับเครื่องมือเดิมไม่กินสิทธิ์ใหม่** แต่คุมเงียบๆ ด้วย "ถังพลังงาน" (เพดาน token/โปรเจกต์ §6). โชว์บนจอ: "เหลือสร้างใหม่ N ตัว" + แถบพลังงาน/เครื่องมือ — **ไม่โชว์ token**.

| | **Free** | **Lite ฿149** | **Starter ฿299** | **Pro ฿990** |
|---|---|---|---|---|
| **รายปี** (~2 ด.ฟรี) | — | ฿1,490 | ฿2,990 | ฿9,900 |
| **สร้างใหม่/เดือน** | 2 | 3 | 5 | 15 |
| **โปรเจกต์ที่ใช้งานได้** | 2 | 5 | 10 | ไม่จำกัด |
| **ถังพลังงาน/ตัว** | ~150K | ~250K | ~400K | ~600K |
| **โมเดล AI** | Sonnet | Sonnet | Sonnet เต็ม · ≤25 turn | +Opus วางแผน · cache 1ชม. · priority |
| **โดเมน** | `ชื่อ.easygas.app` | โดเมนตัวเอง 1 | โดเมนตัวเอง 1 | โดเมนตัวเอง 5 |
| **badge** | แสดง | เอาออก | เอาออก | เอาออก |
| **ใช้เชิงพาณิชย์** | ✗ | ✓ | ✓ | ✓ |
| **always-on** | อาจหลับ | ✓ | ✓ | ✓ |
| **backend** | Sheet | Sheet | +Supabase pooled (กล้อง/realtime) | +BYO-Supabase · password page |
| **ซัพพอร์ต** | docs/ชุมชน | LINE | LINE priority | priority + onboarding |

+ **BYOK** ฿390 platform (build ไม่จำกัด, key ตัวเอง, hosting ตาม add-on) · **Top-up** ฿99 / 3 ตัว · ฿299 / 12 ตัว (PromptPay, ไม่หมดอายุ 6 ด.) · **GAS Builder (done-for-you)** ฿3,000-9,000+/โปรเจกต์ (ส่งทาง LINE)

**เส้นเรื่อง ladder:** Free=ลอง → ฿149=ทำให้เป็นของจริง (โดเมน/ไม่มี badge/ขายได้/always-on) → ฿299=ทำแอปกล้อง·modern (Supabase) → ฿990=power/agency

**roll-over:** สิทธิ์สร้างใหม่ที่ไม่ใช้ เก็บข้าม 1-2 เดือน — ไม่เพิ่มต้นทุน (token จ่ายตอนใช้จริง) ลด churn.

⚠️ **margin (realistic-bet ไม่ใช่ profit-at-cap):** "ถังพลังงาน" = เพดานต้นทุนจริงต่อโปรเจกต์ (~400K ≈ ฿55). **Lite 3×~฿34 = ฿102 < ฿149 → ปลอดภัยแม้ max** (ถังเล็กช่วย); **Starter 5×฿55 + Supabase pooled ฿5-25 / Pro 15×~฿82** → พึ่งค่าเฉลี่ยจริง (~2-3 ตัว, ถังไม่เต็ม) + **kill-switch COGS/user → เด้ง BYOK** กัน whale. managed tier = **Supabase pooled shared + RLS เท่านั้น** (ห้ามแยก project/tenant). เฝ้า `cache_read>0` + COGS/user.

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
