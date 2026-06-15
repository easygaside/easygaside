# EasyGAS — OAuth verification kit (demo video script + scope justifications)

> ใช้ตอน **เปิดสาธารณะ** (Publish consent screen → Production → submit for verification).
> **ช่วงเบต้า Testing mode (≤100 test users) ไม่ต้องใช้ไฟล์นี้เลย** — ไม่ต้อง verify.
> Scopes ของเราเป็น **sensitive ไม่ใช่ restricted** (เพราะใช้ `drive.file` ไม่ใช่ Drive เต็ม) → **ไม่ต้องทำ CASA**.

## คลิปไม่ต้องพูด / ไม่ต้องพูดอังกฤษ
อัดหน้าจอเงียบ ๆ แล้วแปะ **caption ภาษาอังกฤษ** (ข้อความ) ตามจังหวะก็ผ่าน — ไม่ต้องมีเสียง/ไม่ต้องโชว์หน้า.
ถ้าอยากมีเสียง: เอา caption ด้านล่างไปให้ TTS อ่าน. อัปขึ้น YouTube แบบ **Unlisted** แล้ววางลิงก์ในฟอร์ม verify.

---

## 1. Pre-submit checklist
- [ ] แอปอยู่บน prod (ไม่ใช่ localhost), HTTPS, โดเมนที่ Google เข้าถึงได้
- [ ] OAuth consent screen: ชื่อ **EasyGAS**, โลโก้, support email = `easygaside@gmail.com`
- [ ] **Privacy policy** = `https://<domain>/privacy` · **Terms** = `https://<domain>/terms` (มีแล้วในโปรเจกต์)
- [ ] **Authorized domain** เพิ่มโดเมน prod แล้ว
- [ ] **Domain ownership** ยืนยันใน Google Search Console (ด้วยบัญชี easygaside@gmail.com)
- [ ] Scopes ที่ลงทะเบียน = `openid`, `email`, `script.projects`, `script.deployments`, `drive.file` (เท่านั้น — ห้ามเกิน)
- [ ] Demo video (Unlisted YouTube) แสดงครบทุก scope + ลิงก์พร้อม

---

## 2. Scope justifications (ตอบในฟอร์ม — ภาษาอังกฤษ)

**openid, email**
> Used only to authenticate the user and identify their account (email + a stable user id) so each person sees only their own projects. No other profile data is collected.

**.../auth/script.projects**
> EasyGAS is an AI builder for non-developers: the user describes a tool in plain language and the AI writes Google Apps Script code. We use `script.projects` to programmatically create the user's Apps Script project and push the generated files (Code.gs, HTML, appsscript.json) into the user's OWN account via the Apps Script REST API. This is the core action — without it we cannot create or update the script the user is building.

**.../auth/script.deployments**
> After the code is generated, the user clicks "Deploy". We use `script.deployments` to create and update a web-app deployment of that script in the user's own account, producing a live `/exec` URL they can use and share. We reuse a single deployment (update, not create-new) so the URL stays stable across iterations.

**.../auth/drive.file**
> Many generated tools store their data in a Google Sheet. We use `drive.file` (per-file, app-created scope) to create the Sheet the tool needs and to read/write only files the app itself created. We deliberately do NOT request full Drive access — EasyGAS can never see or touch the user's other Drive files.

> **Limited Use:** EasyGAS's use of information from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.

---

## 3. Demo video — script + English captions (~1–2 นาที)

> อัดจอตามขั้น แล้วแปะข้อความในคอลัมน์ "Caption (overlay)" ลงคลิป. คอลัมน์ "ทำอะไรบนจอ" คือสิ่งที่คุณกดให้กล้องเห็น.

| # | ทำอะไรบนจอ | Caption (overlay — English) |
|---|---|---|
| 0 | โชว์ URL bar ที่หน้า EasyGAS (โดเมน prod) | "EasyGAS — an AI tool builder for Google Apps Script. This is our app at https://<domain>." |
| 1 | กด "เข้าสู่ระบบด้วย Google" → หน้า consent ของ Google โผล่ (เห็นชื่อ EasyGAS + รายการ scopes) | "The user signs in with Google. The consent screen shows the EasyGAS app and the scopes we request." |
| 2 | กดอนุญาต → กลับเข้าแอป | "openid + email are used only to sign the user in and identify their account." |
| 3 | พิมพ์ในแชต เช่น "ทำฟอร์มจองคิว" → AI สร้างไฟล์ (เห็นโค้ดขึ้นใน editor) | "The user describes a tool in plain language; the AI writes the Apps Script files." |
| 4 | กดปุ่ม "Deploy เข้า Google" → ขึ้น Deploy สำเร็จ + ลิงก์ /exec | "script.projects: we create the Apps Script project and push the generated files into the user's own account. script.deployments: we deploy it as a web app, producing the live /exec URL." |
| 5 | เปิดลิงก์ /exec → แอปทำงาน → โชว์ว่ามันสร้าง/บันทึกลง Google Sheet | "drive.file: the tool creates a Google Sheet (app-created only) to store its data. We access only files the app created — never the user's other Drive files." |
| 6 | (จบ) โชว์ลิงก์ privacy | "All scripts and data live in the user's own Google account. Privacy policy: https://<domain>/privacy" |

**เคล็ดลับอัดคลิป:** ใช้ OBS/ตัวอัดจอฟรี · ความละเอียดอ่านออก · โชว์ consent screen + /exec ของจริงให้ชัด (Google อยากเห็นว่าใช้จริง ไม่ใช่ mock) · ไม่ต้องตัดต่อสวย แค่ครบขั้น

---

## 4. Cloud Logging (Channel 3 ของ Gate 2) — **ไม่อยู่ใน verification นี้**
การอ่าน log (ถ้าทำ) จะอ่านจาก **GCP project ของ EasyGAS เอง ฝั่งเซิร์ฟเวอร์** (service account / internal identity ของเรา) — **ไม่ใช่ scope ที่ขอจากผู้ใช้** จึง:
- ไม่โผล่ในหน้า consent ของผู้ใช้
- ไม่อยู่ในรายการ scope ที่ verify
- ไม่ต้องอธิบายในคลิป

→ คง scope ฝั่งผู้ใช้ให้เหลือแค่ 3 ตัว = verify ง่ายสุด (ดู [[GATE2.md]] สำหรับ Channel 3)

---

## 5. หลัง submit
รอรีวิวไม่กี่วัน–สัปดาห์. ระหว่างรอ Testing mode ยังใช้ได้ปกติ. ผ่านแล้ว: ไม่มีหน้าเตือน "unverified" + เกิน 100 ผู้ใช้ได้.
