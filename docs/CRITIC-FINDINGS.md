# CRITIC-FINDINGS.md

> บันทึกการวิเคราะห์คุณภาพของ **rulebook critic** (`lib/critic.ts`, Gate 1) — วันที่วิเคราะห์ **2026-06-28**
> ใช้เป็น source-of-truth สำหรับ session ใหม่: อ่านก่อนจะวิเคราะห์ critic-issue ซ้ำ และดู ledger ที่ตาราง `public.egs_known_issues`
> เกี่ยวข้อง: `docs/QUALITY-MOAT.md` (ดีไซน์ Gate 0/1/2), `lib/critic.ts`, `lib/gas-codegen.ts`, `lib/deploy.ts`, `lib/manifest.ts`

## 0. ที่มา

ตอนวิเคราะห์มี **388** `critic_issues` สะสมในตาราง `egs_generations` (331 generations, เฉลี่ย 1.17 จุด/รอบ, 134 รอบเจอ ≥1 จุด, critic = **DeepSeek** ทั้งหมด).
ตัวเนื้อหา issue **ไม่ได้ persist** — กู้คืนได้จาก "repair messages" ใน `egs_messages` เท่านั้น = **252 actionable issues (high/medium)** จาก 96 รอบ (≈65% ของ 388; low + รอบจากปุ่ม recheck กู้ไม่ได้). severity ราย issue กู้ไม่ได้.

> ⚠️ ข้อจำกัดเชิงสถาปัตยกรรม: critic-issue **detail ไม่ถูกเก็บลง DB** (เก็บแค่ count). ถ้าจะวิเคราะห์ลึกในอนาคตต้องเพิ่มการ persist issue (เช่นคอลัมน์ jsonb ใน `egs_generations` หรือตารางใหม่).

## 1. โค้ด AI ชนกฎไหนบ่อยสุด (on-rulebook, 92.5% ของ 252)

| กฎ | เรื่อง | นับ | % |
|---|---|---|---|
| R14 | multi-step write ไม่ atomic → ค้าง half-done | 49 | 19.4% |
| R16 | validate วันที่/ตัวเลขฝั่ง server หลวม/ขาด | 32 | 12.7% |
| R10 | server entry ไม่เช็ค required fields | 32 | 12.7% |
| R9 | formula/CSV injection | 31 | 12.3% |
| R15 | `.withFailureHandler` ว่าง → กลืน error | 29 | 11.5% |
| **R3** | **oauthScopes ผิด (ขาด/เกิน)** | **26** | **10.3%** |
| R8/R11/R12/R7/R4/R2/R17 | ที่เหลือ | 34 | ~13% |

**Why:** โมเดล codegen เขียน "happy path" — เขียนหลายจุดโดยไม่ห่อ transaction, ไม่ re-validate ฝั่ง server, ไม่ดัน error ขึ้น UI. (rulebook ทำงานถูกต้อง — จับสิ่งที่ควรจับ)

## 2. OFF-rulebook (7.5%) → ที่มาของ 3 กฎใหม่

critic drift นอกกติกาแค่ 7.5% แต่ของที่หลุดมามีค่าสูง — เป็น bug จริงที่ rulebook ไม่มีข้อครอบ:

1. **Endpoint authorization / secret-exposure** — `google.script.run` คืน/แก้ข้อมูล admin หรือคืน secret/PIN โดยไม่ auth (เช่น `getAdminPinForInit`, `getAllBookings`)
2. **Re-entrant lock / deadlock** — ขอ lock ซ้อน lock ตัวเดิมจน hang
3. **Status-transition guard** — `approveBooking`/`cancelBooking` ไม่เช็คสถานะปัจจุบันก่อนเปลี่ยน

→ เพิ่มเป็นกฎ (ดู §5)

## 3. R3 Deep Dive — oauthScopes mismatch (26 จุด)

ทั้ง 26 flag บน `appsscript.json`. **R3 ตรวจ scope ของสคริปต์ปลายทาง** (โมเดลเขียนเอง) ไม่ใช่ platform scope ของ easygas.

แยกกลุ่ม: **MISSING 14 · OVERBROAD 9 · WRONG 3 (drive.file ไม่พออ่าน external doc → ต้อง full drive) · NO_MANIFEST 0**

**ทำไม R3 ส่วนใหญ่เป็นของจริง:** `lib/deploy.ts` `ensureWebAppDeployConfig` ทำ `{ ...m, runtimeVersion, webapp }` → **push `oauthScopes` ของโมเดลขึ้นสคริปต์จริงเป๊ะ ไม่ sanitize** → over-broad = consent น่ากลัว + เสี่ยง OAuth verification; missing-แบบ explicit = runtime auth error จริง.

**False-positive ≈ 4–6/26 (~15–23%)** กระจุกที่จุดเดียว: critic **เสก scope ปลอม `auth/script.storage`** และโยง PropertiesService มั่ว (บ้าง `script.storage` บ้าง `script.scriptapp`).
ยืนยันกับ official doc: `script.storage` **ไม่มีอยู่จริง**; PropertiesService/LockService/CacheService/Utilities/HtmlService/ContentService **ไม่ต้องการ scope ใด ๆ**. (ที่มา: [Apps Script Authorization Scopes](https://developers.google.com/apps-script/concepts/scopes))
รากของ false-positive = judge (deepseek) ไม่มี scope→service map ที่นิ่ง → ตัดสิน scope เดียวกันขัดกันเองข้ามโปรเจกต์.

→ แก้ด้วยการฝัง **scope ground-truth map** เข้า critic + codegen prompt (ดู §5)

## 4. เคสจริงจากผู้ใช้ (2026-06-28) — 2 ปัญหา = รากเดียวกัน

โปรเจกต์ตระกูล "ถังดับเพลิง"/"ติดตามผู้ป่วยเบาหวาน" (มี `setupDailyTrigger_`).

```
Exception: ...not sufficient to call ScriptApp.getProjectTriggers.
Required: .../auth/script.scriptapp  at setupDailyTrigger_ (Code:152)  at doGet (Code:19)
```
+ "ใช้งานหน้า login ไม่ได้"

**วินิจฉัย:** `doGet` เรียก provisioning ในก้อน try เดียวก่อน render:
```js
function doGet(e) {
  try {
    getDataSpreadsheet_(); setupSheet_(ss); setupDriveFolders_();
    setupDailyTrigger_();                 // throw (ขาด script.scriptapp)
    return HtmlService.createTemplateFromFile('Index')...  // login ไม่มีวันถึง
  } catch (err) { return HtmlService.createHtmlOutput('<!DOCTYPE html>...error...') } // ผู้ใช้เห็น error แทน login
}
```
→ **ปัญหา 2 (login ไม่ได้) คือผลพวงของปัญหา 1** (ยืนยัน: โปรเจกต์นี้ไม่มีบั๊ก `row[x]===true` vs `'TRUE'`).

**ทำไม error ยังเกิดทั้งที่ manifest ตอนนี้มี scope แล้ว** (timeline `egs_file_versions`/`egs_deployments`):
- เวอร์ชันที่ **deploy จริง** (17:47 / 18:06) เป็น **no_scope**; scope เพิ่งถูกเพิ่มลงไฟล์ 18:09+ แต่ **ไม่มี deploy ใหม่หลังจากนั้น**
- การเพิ่ม sensitive scope ต้องให้เจ้าของ **re-authorize** — push manifest ผ่าน REST API ไม่ทริกเกอร์ consent ใหม่อัตโนมัติ
- ผู้ใช้ยัง **restore กลับเวอร์ชัน no_scope** (07:31/07:34) = พา bug กลับมา

**วิธีแก้ 3 ชั้น:** (1) ใช้เวอร์ชันที่มี scope → deploy ใหม่ → re-authorize; (2) แก้ generated code: doGet ต้อง render UI/login ให้ได้แม้ provisioning ล้ม + เอา trigger setup ออกจาก main path; (3) platform: บังคับ re-consent เมื่อ manifest scope เปลี่ยน

## 5. หลักการ (durable principles)

1. **Scope ground truth** — มี service→scope map ที่ตายตัว; PropertiesService/LockService/Cache/Utilities/HtmlService = ไม่ต้อง scope; `auth/script.storage` ไม่มีจริง; อ่าน external doc ใช้ `drive.readonly` ไม่ใช่ full `drive` (easygas เลี่ยง restricted scope)
2. **doGet resilience** — UI/login ต้องขึ้นเสมอ; provisioning/trigger setup เป็น best-effort ห่อ try/catch แยก ห้าม throw ออกจาก doGet
3. **Scope ถูกตั้งแต่ v1 = ทางแก้หลัก** — ถ้า manifest ประกาศ scope ครบตั้งแต่ deploy ครั้งแรก เจ้าของอนุมัติครบในจอ consent ครั้งแรก (first-access เด้งแน่นอน reliable) → ไม่มีปัญหา trigger ตลอดอายุ ตราบใดที่ scope ไม่โตทีหลัง การ "ใส่ scope ให้ถูก" (scope-map ใน codegen) สำคัญกว่า re-consent UX
4. **Consent 2 ชั้นแยกกัน** — (A) `/connect` = grant ระดับ**บัญชี**ของ easygas เอง (push code ผ่าน REST API; scope ผอม **ห้ามยัด** `script.scriptapp`); (B) consent ของ**สคริปต์ลูกค้า**ตอนเปิด /exec = สิทธิ์ที่ web app ใช้ตอนรัน เป็น **ฝั่งลูกค้า ราย project** ปัญหา trigger อยู่ที่ชั้น B **ไม่ใช่** A — อย่าเอาไปแก้ที่ /connect
5. **prompt vs throw** — Google เด้ง consent เมื่อ grant < "known-required set" (จาก manifest explicit หรือ auto-detect) เช็ค *ก่อน* รัน; **throw** "insufficient permissions" เมื่อโค้ดเรียก scope ที่ **ไม่อยู่ใน** known-set ดังนั้นปัญหาเกิดเฉพาะตอน **scope โตหลัง deploy** (redeploy เพิ่ม scope ที่เจ้าของยังไม่อนุมัติ) — deploy ครั้งแรกที่ scope ครบ + redeploy ที่ scope เท่าเดิม/ลดลง ไม่มีปัญหา (`lib/deploy.ts` ไม่ sanitize oauthScopes → push เป๊ะ)

## 6. การแก้ที่ทำไปแล้ว (✅ applied 2026-06-28)

ใน `lib/critic.ts` (`CRITIC_SYSTEM`):
- ✅ กฎ: endpoint authorization / secret-exposure (= high)
- ✅ กฎ: re-entrant LockService deadlock (= high)
- ✅ กฎ: status-transition guard (= medium)
- ✅ กฎ: doGet provisioning ต้องไม่บล็อกการ render UI/login (= high)
- ✅ scope ground-truth map (ปิด false-positive `script.storage`)

ใน `lib/gas-codegen.ts` (codegen system prompt):
- ✅ service→scope map + "`script.storage` ไม่มีจริง อย่าใส่"
- ✅ กฎ doGet ต้อง render UI ก่อน + trigger setup lazy/guarded ห้าม throw ออกจาก doGet

## 7. ค้างไว้ (open / TODO)

- ⏳ **Deterministic scope-deriver** — สังเคราะห์ oauthScopes ขั้นต่ำจาก service ที่โค้ดอ้างถึงจริง (เลิกพึ่งโมเดลเขียนมือ) → ฆ่า R3 ที่ราก
- ⏳ **Re-consent ตอน scope โตหลัง deploy** (scope ชั้น B — ราย project ฝั่งลูกค้า, **ไม่เกี่ยวกับ /connect**) — เคสที่เหลือหลังแก้ที่ source แล้ว: ผู้ใช้ deploy ไปก่อน แล้วเพิ่งสั่ง AI เพิ่มฟีเจอร์ที่ต้อง scope ใหม่ทีหลัง แนวที่พิจารณา: (a) เก็บ scope set ที่ deploy ไปใน `egs_deployments` → diff ตอน redeploy เพื่อ trigger คำเตือน; (b) ให้ codegen ใส่ guard ใน doGet ด้วย `ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL)` → ถ้า status = REQUIRED ให้ render ปุ่มลิงก์ `getAuthorizationUrl()` ("อนุญาตสิทธิ์เพิ่ม") แทนหน้าแอป (ฝั่งลูกค้า, reliable สำหรับเจ้าของ, ไม่ต้องเปิด editor) **ข้อจำกัด:** ต้องประกาศ scope ใน manifest ก่อน getAuthorizationInfo ถึงจะรู้ว่า REQUIRED; ไม่ช่วย anonymous (เจ้าของต้องอนุมัติก่อน) — การ "เรียก API ตรง ๆ ใน doGet" ไม่ทำให้ popup เด้ง (server รันแบบ headless → throw ไม่ใช่ prompt)
- ⏳ **Persist critic issue detail** — เก็บ problem/fix/severity/line ลง DB เพื่อให้วิเคราะห์ซ้ำได้โดยไม่ต้องขุด `egs_messages`

## 8. Ledger (ดูตาราง `public.egs_known_issues`)

แต่ละ finding มี `signature` ที่ stable — query ตารางนี้ก่อนวิเคราะห์ซ้ำ และข้ามตัวที่ `status` = fixed/analyzed แล้ว:

| signature | category | status |
|---|---|---|
| `critic-rule:endpoint-authorization` | critic-rule-added | fixed |
| `critic-rule:reentrant-lock-deadlock` | critic-rule-added | fixed |
| `critic-rule:status-transition-guard` | critic-rule-added | fixed |
| `critic-rule:doget-provisioning-blocks-render` | critic-rule-added | fixed |
| `critic-fp:script-storage-hallucination` | critic-false-positive | fixed |
| `codegen:oauthscopes-mismatch` | codegen-pattern | mitigated |
| `platform-gap:scope-change-needs-reauth` | platform-gap | open |
| `user-incident:fire-extinguisher-trigger-scope` | user-incident | analyzed |
