# easygas — COST-MODEL: data-backend cost (Google Sheet vs Supabase)

> สร้างจาก research workflow (2026-06-14). companion ของ [[WEB-TARGET.md]] — WEB-TARGET ตัดสิน **ชั้น HOSTING** (Cloudflare Worker router + R2/KV) ไปแล้ว; ไฟล์นี้ตัดสิน **ชั้น DATA-BACKEND** ที่อยู่ข้างหลัง
> เกี่ยวข้อง: [[WEB-TARGET.md]] §2 (Path A/B) · §6 (tiers) · [[MONETIZATION.md]] · [[BUILDPLAN.md]] §J
> มุมมอง: founder กำลังตัดสินใจว่า **ต้องจ่ายอะไรบ้าง** ต่อ 1 แอป / ต่อเดือน
>
> **อัตราแลกเปลี่ยนอ้างอิงทั้งเอกสาร: ~34 THB/USD.** ราคา Supabase/Cloudflare อาจเปลี่ยนได้ทุกเมื่อ — ทุกตัวเลข "verify ก่อนเอาไปคิดเงินจริง"

---

## TL;DR RECOMMENDATION

- **ชั้น hosting จบไปแล้ว (WEB-TARGET): Cloudflare Worker router + R2/KV, ~$5–25/mo, egress = $0, custom domain 100 ตัวแรกฟรี แล้ว $0.10/domain/mo.** ไฟล์นี้บวก *ชั้น data* เข้าไปข้างบนนั้นเท่านั้น — total ต่อแอป = Cloudflare + data backend.
- **Default = Google Sheet-as-DB สำหรับแอปเบา (ฟอร์ม/จองคิว/log).** ต้นทุน data ส่วนเพิ่มของ founder ≈ **฿0** เพราะข้อมูลอยู่บน Google account ของ *ลูกค้าเอง* + Cloudflare egress ฟรี → marginal cost ต่อแอปแทบเป็นศูนย์จริง.
- **Sheet ฟรีแต่มีเพดานแข็ง.** ตัวที่พังก่อนเพื่อนคือ **Sheets API v4 = 60 req/นาที/user, 300 req/นาที/project** (คืน HTTP 429) — แอปที่คนใช้พร้อมกัน 5+ คนชนเพดานนี้ *ก่อน* จะใกล้เพดาน 10 ล้าน cell ด้วยซ้ำ. ไม่มี CORS จริง/ไม่มี auth ต่อแถว/ไม่มี Storage รูป → **ทำกล้องไม่ได้**.
- **Supabase = backend จริง มีค่าใช้จ่ายจริง.** Free มี 2 active project + auto-pause หลัง idle 7 วัน (ใช้ production ไม่ได้); Pro = **$25/org/เดือน** + compute ~$10/project − เครดิต compute $10 ≈ **$25/mo flat** สำหรับ project แรก.
- **มี 3 โมเดลความเป็นเจ้าของ.** (a) **shared project เดียว แยกด้วย RLS + `tenant_id`** → founder จ่าย ~$25/mo *คงที่* เพิ่มแอปกี่ตัวก็ +$0 — **เลือกตัวนี้สำหรับ tier กล้อง/modern ที่ขายแบบ managed**. (b) project ต่อ tenant → ~$10/tenant **ไม่ scale, ห้าม**. (c) **BYO-Supabase** (ลูกค้าเอา project ตัวเองมา) → founder จ่าย **$0** ทุก tenant ลงบิลลูกค้าเอง.
- **₿149 Starter ครอบ shared-Supabase ได้ไหม?** ได้สบายแบบ pooled: $25/mo ÷ 34 ≈ **฿850/เดือน** หารกับ Starter หลายสิบราย → ต่อหัว **฿5–25/mo** เท่านั้น (1 ราย Starter = ฿149 จ่ายค่า Supabase ของ ~6 ราย). **ห้ามให้ทุกราย Starter ได้ Supabase แยก project** — อันนั้นเจ๊ง.
- **กฎเดียวจำง่าย:** แอปเบา → Sheet (founder cost ฿0). แอปกล้อง/modern → Supabase **โมเดล (a) shared** สำหรับ tier ที่ขายเอง; แต่ **power/Pro tier ดัน BYO-Supabase โมเดล (c)** เพื่อให้ marginal cost ของ founder กลับมา ~$0 และตัด blast-radius ออก.

---

## 1. สองหลังบ้าน data — recap

WEB-TARGET §2 วาง data path ไว้ 2 ทางหลัง SPA ที่เสิร์ฟจาก origin ของเรา (Cloudflare). ไฟล์นี้คือ "ราคา" ของแต่ละทาง:

| | **Google Sheet (Path A)** | **Supabase (Path B)** |
|---|---|---|
| **ข้อมูลอยู่ที่** | Google account ของ **ลูกค้า** | infra ของ **founder** (ยกเว้นโมเดล c = ของลูกค้า) |
| **founder จ่าย** | **≈ $0** (data ไม่อยู่กับเรา + Cloudflare egress ฟรี) | **มีจริง** — $25/mo ขึ้นไป (ดู §4) |
| **ความสามารถ** | จำกัด: ไม่มี CORS จริง, ไม่มี auth ต่อแถว, ไม่มี Realtime, ไม่มี Storage รูป (ดู WEB-TARGET §1.2/§4) | backend จริง: PostgREST API, GoTrue Auth + JWT, RLS ต่อแถว, Storage รูป, Edge Functions, Realtime |
| **เพดาน** | quota แข็ง (§3) — ฟรีแต่ชนกำแพง | จ่ายเพิ่มได้ตาม overage (§4) — โตได้ |
| **กล้อง/modern app** | **ทำไม่ได้** (ทำได้แค่ log แบบ write-mostly) | **ทำได้** (default ของ tier กล้อง) |

**สรุปแก่น:** Sheet = ฟรีต่อ founder แต่เพดานเตี้ย; Supabase = ความสามารถครบแต่มีบิล. คำถามทั้งหมดของ §6 คือ "แอปนี้คุ้มที่จะจ่ายค่า Supabase ไหม ถ้าจ่าย ใครจ่าย".

> **earlier conclusion (ยึดเป็นหลัก):** Sheet-as-DB ทำให้ marginal cost ต่อแอปของ founder ≈ ฿0 เพราะ (1) data ลงบน Google account ของลูกค้า ไม่ใช่ของเรา และ (2) Cloudflare egress = $0. ค่าใช้จ่ายเดียวที่เพิ่มคือ Worker invocation ระดับเศษสตางค์ที่นับรวมอยู่ใน ~$5–25/mo ของชั้น hosting แล้ว.

---

## 2. Sheet-as-DB: เพดานอยู่ตรงไหน (ฟรีแต่ชน) — อะไรพังก่อนสำหรับแอปที่คนใช้เยอะ

Sheet ฟรีจริง แต่ Apps Script + Sheets API มี quota แข็ง (verified กับ Google docs ทางการ, มิ.ย. 2026). Apps Script quota = **ต่อ user, รอบ 24 ชม.**; Sheets API quota = **ต่อนาที** และเป็นเพดาน real-time ที่โหดกว่า.

### 2.1 Apps Script quota (consumer vs Workspace)

| Quota | Consumer (gmail.com) | Workspace | หมายเหตุ |
|---|---|---|---|
| UrlFetch / วัน | **20,000/วัน** | **100,000/วัน** | เฉพาะตอน handler เรียก API ภายนอก |
| Runtime ต่อ execution | **6 นาที** | **6 นาที** | web app request ต้องจบในนี้ |
| Simultaneous executions / user | **30/user** | **30/user** | **เพดาน concurrency — คอขวดของแอปที่คนใช้เยอะ** |
| Triggers runtime / วัน | 90 นาที/วัน | 6 ชม./วัน | trigger ทั้งหมดรวมกัน |

**เกิน quota → script throw exception + execution หยุด** (hard error ไม่ใช่ throttle): *"If you exceed a quota or limitation, your script throws an exception and execution stops."* เช่น `Service invoked too many times`, `Limit exceeded`.

### 2.2 Sheets API v4 — เพดาน real-time ที่ชนก่อน

| Limit | ต่อ project | ต่อ user/project |
|---|---|---|
| **Read / นาที** | **300** | **60** |
| **Write / นาที** | **300** | **60** |
| ต่อวัน | **ไม่มี** | ไม่มี — อยู่ใน per-minute ก็ยิงได้ไม่จำกัด/วัน |

**เกิน → HTTP `429 Too many requests`** (Google แนะ exponential backoff, max ~32–64s). payload แนะนำ ≤ ~2 MB/request. หมายเหตุ: `SpreadsheetApp` ใน Apps Script **ไม่กิน** quota REST นี้ — quota นี้ใช้ตอนเรียก REST API v4 ตรง (เช่นจาก `UrlFetchApp` / advanced Sheets service) ซึ่งคือสิ่งที่ SPA บน origin เราจะทำ.

### 2.3 เพดาน cell แข็ง

**10,000,000 cell** หรือ **18,278 คอลัมน์ (ZZZ)** ต่อ 1 spreadsheet — เกินแล้ว **write ถูกปฏิเสธ** (เพิ่มแถว/คอลัมน์ไม่ได้). เป็นงบ **ทั้ง spreadsheet** แชร์ทุก tab — แถวว่าง/คอลัมน์ว่างใน tab อื่นกินโควตาเงียบ ๆ. ที่ 20 คอลัมน์/แถว ≈ **~500k แถว** ทั้งไฟล์.

### 2.4 อะไรพังก่อน (ลำดับความล้มเหลวของแอปที่คนใช้เยอะ)

1. **Sheets API per-minute (60/user, 300/project)** — พังก่อนเพื่อนแบบทิ้งห่าง. user คนเดียวทำ CRUD batch ก็เกิน 60/นาทีได้; **5+ คนพร้อมกันชน 300/project → 429**. แก้: `batchUpdate`/`values.batchGet` ให้หลาย cell op นับเป็น 1 request + backoff.
2. **30 simultaneous executions / user** — กำแพงถัดมาสำหรับ handler ที่ใช้เวลาหลายวินาที พอ overlap เกิน 30 ก็ queue/fail.
3. **6 นาที/execution** — กัดงาน bulk (import/export/report ใหญ่) ต้องหั่นเป็น chunk ข้าม trigger.
4. **20,000 UrlFetch/วัน (consumer)** — สำคัญเฉพาะถ้า handler เรียก API นอก; Workspace 100,000/วัน แทบหมดห่วง.
5. **10M cell** — เพดานโครงสร้างแบบช้า ไม่ throttle แต่ **hard-stop** การโต = สัญญาณต้องย้ายออกจาก Sheet ไป DB จริง.

**สรุป:** *Sheets API per-minute throttle แอปที่คนใช้เยอะ ก่อนที่ 10M cell จะเต็มเสียอีก.* 429 ต่อนาที + เพดาน 30 concurrency/user = สิ่งที่ชนใน production จริง; กำแพง 10M cell คือหน้าผา scaling ระยะยาว. **เมื่อแอปเริ่มชน 429 เป็นประจำ = เวลาย้ายไป Supabase**.

---

## 3. Supabase pricing + 3 โมเดลความเป็นเจ้าของ (ต้นทุน founder ต่อแบบ)

### 3.1 ราคา Supabase (Free vs Pro) — verified ~2026-06-14, verify ก่อนเดิมพันเงิน

| มิติ | Free | Pro (รวมในแพ็ก) | Pro overage (จ่ายตามโต) |
|---|---|---|---|
| ราคา/เดือน | $0 | **$25 / org / เดือน** | — |
| DB / disk | 500 MB/project | 8 GB disk/project | **$0.125/GB** |
| File storage | 1 GB | 100 GB | **$0.0213/GB** |
| Egress | 5 GB | 250 GB (+250 GB cached) | **$0.09/GB** (cached $0.03/GB) |
| MAU (Auth) | 50,000 | 100,000 | **$0.00325/MAU** |
| Edge Function calls | 500,000 | 2,000,000 | **$2 / 1M** |
| Active projects | **2 active** (paused ไม่นับ) | ไม่ cap แบบเดียวกัน | — |
| Inactivity pause | **paused หลัง idle 7 วัน** (restore ได้ ไม่ลบข้อมูล) | ไม่ auto-pause | — |
| Compute credit | — | **$10/เดือน** (พอ Micro 1 ตัว) | compute เกินคิดแยก |
| Backups | — | 7 วัน (รายวัน) | PITR/retention ยาว = add-on |

**กติกาบิลที่ founder ต้องรู้:**
- **บิลต่อ organization ไม่ใช่ต่อ project.** $25/mo Pro + quota ที่รวมในแพ็ก pool ที่ระดับ org แล้ว compute ของแต่ละ project บวกบนนั้น. **ผลต่อ multi-tenant: ถ้ารัน 1 project/tenant ทุก project = compute line item แยก** → pooled single-DB (RLS) ถูกกว่ามาก.
- **Spend cap เปิดเป็น default บน Pro.** เปิดไว้ = ตันที่ quota (block overage กันบิลเซอร์ไพรส์ แต่ก็ hard-stop การโต). **ปิด spend cap** ถึงจะจ่าย overage ตามราคาต่อหน่วยข้างบนได้. เป็น toggle on/off ไม่มีเพดานดอลลาร์ละเอียด.
- **MAU math ที่ scale:** $0.00325/MAU เกิน 100K → auth อย่างเดียวที่ ~1M user ≈ **$2,925/เดือน**. high-MAU consumer ต้องโมเดลก่อน commit.

> Sources (verify ตรง): [pricing](https://supabase.com/pricing) · [billing docs](https://supabase.com/docs/guides/platform/billing-on-supabase) · 7-day pause ([nocode.mba](https://www.nocode.mba/articles/supabase-pricing), [itpathsolutions](https://www.itpathsolutions.com/supabase-free-tier-limits))

### 3.2 สามโมเดลความเป็นเจ้าของ + ต้นทุน founder

| โมเดล | ใครเป็นเจ้าของ DB | founder จ่าย | scale | ใช้กับ |
|---|---|---|---|---|
| **(a) shared project + RLS `tenant_id`** | founder (1 project รวมทุก tenant) | **~$25/mo *คงที่*** เพิ่ม tenant = +$0 | ดีสุด (cost flat) | **default ของ tier กล้อง/modern ที่ขายแบบ managed** |
| **(b) 1 project / tenant** | founder (N project) | **~$10/tenant** (100 tenant ≈ $1,000/mo idle) | **ไม่ scale — ห้าม** | เฉพาะ tenant เดี่ยวที่จ่ายแพงพอ/ต้อง compliance |
| **(c) BYO-Supabase** | **ลูกค้า** (project ตัวเอง) | **$0** ทุก tenant ลงบิลลูกค้า | infinite ฝั่งเรา | **power/Pro tier + ลูกค้า technical** |

**(a) shared project เดียว — RLS + คอลัมน์ `tenant_id`**
- ต้นทุน: 1 org / 1 project / 1 บิล. บน Pro = **$25 org + ~$10 compute − $10 credit ≈ $25/mo** สำหรับ project แรก. **เพิ่ม tenant = +$0** (แชร์ quota org: 250 GB egress, 8 GB disk, 100k MAU รวมทั้ง org). โมเดลเดียวที่ cost flat เมื่อ tenant โต — และเป็นแพทเทิร์นที่ maintainer Supabase เองเรียกว่า "straightforward ที่สุด" ([discussions #1615](https://github.com/orgs/supabase/discussions/1615)).
- **non-negotiable วันแรก:** เปิด RLS ทุกตาราง; บังคับ `tenant_id` ผ่าน policy ไม่ใช่ app code; index `tenant_id`; wrap auth เป็น `(select auth.uid())` (cache ต่อ statement, เร็วขึ้นถึง ~99.99% ใน benchmark ของ Supabase); ต่อผ่าน **Supavisor pooler** เสมอ; `service_role` key อยู่เฉพาะ server code ([RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security), [going-into-prod](https://supabase.com/docs/guides/deployment/going-into-prod)).
- **ความเสี่ยงหลัก:** RLS เป็นกำแพง isolation เดียว (policy ผิด 1 ที่ = data รั่วข้าม tenant); noisy neighbor (query หนักของ 1 ราย ทำช้าทั้งหมด); connection ceiling (**Micro = 60 direct / 200 pooler client**, ต้องขยาย compute ถึงเพิ่มได้); blast radius ร่วม (1 migration พัง / quota เกิน / บิลค้าง = จำกัด *ทุก* tenant พร้อมกัน, Fair Use คืน 402 ทั้ง org).

**(b) 1 project / tenant — ไม่ scale**
- Free ใช้ไม่ได้: ฟรีให้แค่ **2 active project ทั้ง org** + **auto-pause หลัง idle 7 วัน** (paused คืน 540 เสิร์ฟไม่ได้จนกด restore เอง). SMB เล็ก = แอป traffic ต่ำที่โดน pause พอดี → non-starter.
- Pro แพง: แต่ละ project = VM + Postgres เฉพาะ. ตัวอย่าง Supabase เอง: 3 project = **$25 + $30 compute − $10 = $45/mo** → ~**$10/tenant** ใน compute ล้วน. **100 tenant ≈ ~$1,000/mo** idle compute เปล่า ๆ.
- **verdict:** เก็บไว้เฉพาะ tenant เดี่ยวที่จ่ายคุ้ม $10+/mo dedicated หรือมี compliance/residency แข็ง.

**(c) BYO-Supabase — ลูกค้าเอามาเอง**
- 2 แบบ: (1) OAuth เข้า org ลูกค้า (Management API, provision project ใน org เขา) หรือ (2) ลูกค้าวาง URL + `anon` + `service_role` key เข้าแอปเรา.
- ต้นทุน founder = **$0** ทุก compute/storage/egress ลงบิล Supabase ของลูกค้า. scale ฝั่งเราไม่จำกัด.
- friction: ตั้งค่ายากสำหรับ non-coder (สร้าง org/project/รัน migration/copy key) — ขัดกับ no-code value prop; ถือ `service_role` key ลูกค้า = liability (bypass RLS เต็ม ต้อง encrypt + scope แคบ, prefer OAuth scoped token); Free project ลูกค้าก็ auto-pause 7 วัน *แล้วเราโดนด่า*; support N project ที่เราคุมไม่ได้.
- **verdict:** เหมาะ **ลูกค้า technical/enterprise ที่ *อยาก* เป็นเจ้าของ data เอง** = **power/Pro tier**. ผิดฝาผิดตัวกับ SMB no-code ทั่วไป.

---

## 4. Side-by-side cost ที่ 10 / 100 / 1000 active apps

**สูตร: total = Cloudflare hosting (WEB-TARGET, ~$5–25/mo) + data backend.** Cloudflare ส่วนนี้ *แชร์* ทุกแอป (router เดียว, ไม่ใช่ต่อแอป) — egress $0, custom domain 100 ตัวแรกฟรี แล้ว $0.10/domain/mo. ตัวเลขเป็น **founder cost รวม/เดือน** (THB @ 34/USD).

### 4.1 ทุกแอปใช้ Sheet (Path A)

| Active apps | Cloudflare (แชร์) | Data (Sheet) | **Total/mo** |
|---|---|---|---|
| 10 | ~$5 (฿170) | **$0** — data บน Google ลูกค้า | **~$5 / ฿170** |
| 100 | ~$5 (฿170) | **$0** | **~$5 / ฿170** |
| 1000 | ~$25 (฿850)¹ | **$0** | **~$25 / ฿850** |

¹ ที่ 1000 แอป Cloudflare ขยับจาก Workers Paid traffic + custom domain เกิน 100 ตัว ($0.10 ต่อตัวเพิ่ม) — ยังเป็นเงินเศษเทียบ tenant count. **marginal cost ต่อแอป ≈ ฿0** ตรงตาม earlier conclusion.

### 4.2 ทุกแอปใช้ Supabase

| Active apps | Cloudflare | **(a) shared project** | **(b) project/tenant** | **(c) BYO** |
|---|---|---|---|---|
| 10 | ~$5 (฿170) | +$25 (฿850) → **~$30 / ฿1,020** | +~$100² (฿3,400) → ~$105 / ฿3,570 | +$0 → **~$5 / ฿170** |
| 100 | ~$5 (฿170) | +$25–50³ (฿850–1,700) → **~$30–55 / ฿1,020–1,870** | +~$1,000 (฿34,000) → ~$1,005 / ฿34,170 | +$0 → **~$5 / ฿170** |
| 1000 | ~$25 (฿850) | +~$50–150⁴ (฿1,700–5,100) → **~$75–175 / ฿2,550–5,950** | +~$10,000 (฿340,000) → ☠️ **ห้าม** | +$0 → **~$25 / ฿850** |

² (b) ที่ 10 tenant ≈ $25 org + ~$90 compute (9 × $10 หลังเครดิตตัวแรก). ³ (a) ที่ 100 tenant อาจต้องขยับ compute 1 ขั้นถ้า connection/disk ตึง. ⁴ (a) ที่ 1000 tenant = shard เป็นไม่กี่ project (50–100 tenant/project) + overage egress/disk เล็กน้อย — **ยังเกือบ flat**.

**อ่านตาราง:**
- **Sheet** = founder cost คงที่ ~$5–25 ไม่ว่ากี่แอป (data ฟรี).
- **Supabase (a) shared** = ~$30 คงที่ถึงหลักร้อย tenant, ค่อยขยับเป็น ~$75–175 ที่ 1000 (shard). **ถูกและคุมได้**.
- **Supabase (b)** = ระเบิดเป็นเชิงเส้นตาม tenant — **ตัดทิ้ง**.
- **Supabase (c) BYO** = founder cost = ชั้น Cloudflare ล้วน (~$5–25) เพราะ data ลงบิลลูกค้า — **marginal ≈ $0 เท่า Sheet** แต่ได้ความสามารถ Supabase เต็ม.

---

## 5. กฎตัดสินใจ + map เข้า tier monetization

### 5.1 กฎเดียว

```
แอปเบา (ฟอร์ม / จองคิว / log / dashboard อ่านอย่างเดียว)
   → Google Sheet        (founder cost ฿0, data บน Google ลูกค้า)
   ↳ ย้ายออกเมื่อ: ชน 429 เป็นประจำ / คนใช้พร้อมกัน 5+ / ใกล้ 10M cell

แอปกล้อง / modern (getUserMedia, Realtime, auth ต่อแถว, Storage รูป, npm, SEO)
   → Supabase
       • tier ที่ขายแบบ managed (Starter/Business)  → โมเดล (a) shared project + RLS
       • power / Pro tier + ลูกค้า technical          → โมเดล (c) BYO-Supabase
       • (b) project/tenant = เฉพาะเคส compliance/residency ที่จ่ายแพงพอ
```

WEB-TARGET capability router gate ตรงนี้อยู่แล้ว: `liveCamera`/`realtime`/`npmPackages`/`customDomain`/`publicSeo` → web+Supabase; `workspaceData` + zero-hosting + internal → GAS/Sheet.

### 5.2 ฿149 Starter ครอบ shared-Supabase ได้ไหม — **ได้ ถ้า pooled**

- Supabase (a) ต้นทุนคงที่ ~$25/mo = **~฿850/เดือน** ที่ระดับ org ไม่ว่ามีกี่ tenant.
- เฉลี่ยกับฐาน Starter: **10 ราย → ฿85/หัว · 50 ราย → ฿17/หัว · 100 ราย → ฿8.5/หัว**. ดูตาราง §4.2: ที่ 100 แอป shared, data ต่อหัว ≈ **฿5–25/mo**.
- **Starter ฿149 มี gross margin เหลือเยอะ** หลังหักทั้ง data (฿5–25) และส่วนแบ่ง Cloudflare (เศษสตางค์/หัว). **1 ราย Starter ≈ จ่ายค่า Supabase ของ ~6 ราย** (฿149 ÷ ฿25).
- **เงื่อนไขเดียวที่ทำให้พัง: ถ้าเผลอให้ทุกราย Starter ได้ Supabase แยก project (โมเดล b)** → ต้นทุนพุ่งเป็น ~$10/ราย = ~฿340/ราย > ฿149 → **ขาดทุนทุกบิล**. ดังนั้น **บังคับ pooled shared (a)** สำหรับทุก managed tier.

### 5.3 map เข้า tier (WEB-TARGET §6)

| Tier | ราคา/mo | data backend ที่แนะนำ | founder data cost/ราย | margin |
|---|---|---|---|---|
| **Free** (subdomain + badge) | ฿0 | **Sheet** เท่านั้น (camera ปิด, เป็น log/ฟอร์ม) | ฿0 | — |
| **Starter** | **฿149** | Sheet (default); **shared-Supabase (a)** ถ้าแอปต้องกล้อง | ฿0 (Sheet) / **฿5–25** (shared) | สูง |
| **Business** | **฿390** | shared-Supabase (a) — pooled | ฿5–25 | สูงมาก |
| **Pro / Multi** | **฿990** | **BYO-Supabase (c)** สำหรับ power user | **฿0** (ลูกค้าจ่าย Supabase เอง) | สูงสุด |

**คำแนะนำชัด:**
1. **Free/Starter/Business ที่ขายเอง → Sheet ก่อน, shared-Supabase (a) เมื่อจำเป็นต้องกล้อง** — pooled ทำให้ ฿149 ครอบได้สบาย.
2. **Pro/power tier → ดัน BYO-Supabase (c)** เพื่อให้ marginal cost ของ founder **กลับมา ~$0** — power user ใช้หนัก (MAU/egress/Storage สูง) คือกลุ่มที่จะกิน overage ของ shared มากที่สุด; ให้เขาถือบิล Supabase เอง + ตัด blast-radius/noisy-neighbor ออกจาก project รวม + ลูกค้า technical กลุ่มนี้ *อยาก* เป็นเจ้าของ data อยู่แล้ว. Pro ฿990 = platform/management fee บน infra ที่ founder ไม่ต้องจ่าย.

---

## 6. ความเสี่ยง + สิ่งที่ต้องเฝ้า

| ความเสี่ยง | ระดับ | เฝ้า/แก้ |
|---|---|---|
| **RLS policy ผิด 1 ที่ = data รั่วข้าม tenant** (โมเดล a มี RLS เป็นกำแพงเดียว) | **Critical** | RLS เปิดทุกตาราง + Security Advisor scan ก่อนทุก deploy; บังคับ `tenant_id` ผ่าน policy; `service_role` ห้ามขึ้น browser (Edge Function เท่านั้น) — security-review gate ก่อนแอป web ขึ้น |
| **เผลอ provision Supabase แยก project ต่อ tenant (b)** บน tier ฿149/฿390 | **Critical (เงิน)** | hard rule: managed tier = pooled shared (a) เท่านั้น; ห้าม code path สร้าง project/tenant อัตโนมัติสำหรับ tier ที่ต่ำกว่า Pro |
| **Sheet ชน 429 เงียบ ๆ** แล้วลูกค้าโทษเรา | High | ตรวจ 429 + exponential backoff ใน adapter; เตือนย้าย Supabase เมื่อชนถี่; batch ด้วย `batchUpdate`/`batchGet` |
| **Supabase Free auto-pause 7 วัน** (รวม BYO ของลูกค้า) → แอปดับ ลูกค้าโทษเรา | High | tier ที่ใช้ Supabase production = **Pro org ของ founder** (ไม่ pause); ถ้า BYO บน Free ของลูกค้า ต้องเตือน/แนะ Pro + แสดงสถานะ paused (540) ชัด |
| **Noisy neighbor / connection ceiling** บน shared (a) — Micro 60 direct/200 pooler | Medium | ต่อผ่าน Supavisor pooler เสมอ; เฝ้า pooler client ใกล้เพดาน; index `tenant_id`; ขยับ compute ก่อนตัน; **shard** เป็นหลาย shared project ที่ ~50–100 tenant/project |
| **Overage บานปลาย** (egress $0.09/GB, disk $0.125/GB, MAU $0.00325) | Medium | ปิด spend cap ต้องตั้งใจ + monitor; ดัน power user ที่ MAU/egress สูงไป BYO (c); เฝ้า MAU math ก่อนแตะ scale ใหญ่ |
| **บิลค้าง/quota เกิน → 402 ทั้ง org** (blast radius ร่วม) | Medium | จ่ายอัตโนมัติ + alert ก่อนถึง quota; shard เพื่อจำกัด blast radius; แยก project สำคัญออกจาก free/abuse-prone |
| **Spend cap default ON บน Pro = service หยุดที่ quota** (ตันเงียบ) | Medium | ตัดสินใจชัดว่าจะปิด cap (จ่าย overage) หรือเปิด (ตันแต่ไม่เซอร์ไพรส์); document policy; alert ก่อนถึงเพดาน |
| **ตัวเลขราคา Supabase/Cloudflare เปลี่ยน** | Low–Med | ทุกตัวเลขในไฟล์นี้ "verify ก่อนเดิมพันเงิน" — re-check pricing page ตอนตัดสินใจ |
| **Sheet 10M cell hard-stop** (write ถูกปฏิเสธ) | Low (ช้า) | เฝ้า cell count; วางแผนย้าย Supabase ล่วงหน้าก่อนชน; ลบ tab/คอลัมน์ว่างที่กินโควตา |

**Bottom line:** ชั้น hosting เป็น Cloudflare ~$5–25/mo จบแล้ว. ชั้น data: **default Sheet** สำหรับแอปเบา (founder cost ฿0 ตรงตาม earlier conclusion) → ย้าย **Supabase shared project (a)** เมื่อต้องกล้อง/modern (~$25/mo flat, pooled ให้ ฿149 Starter ครอบสบาย ต่อหัว ฿5–25) → **power/Pro tier ดัน BYO-Supabase (c)** ให้ founder กลับมา marginal cost ~$0. **ห้ามแตะโมเดล (b) project-ต่อ-tenant** ยกเว้นเคส compliance ที่จ่ายแพงพอ — มันระเบิดเป็นเชิงเส้นตาม tenant.
