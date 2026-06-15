# easygas — STYLE-LAB: ช็อปองค์ประกอบ → คำสั่งให้ AI (/styleshopping)

> เคาะ + เริ่ม implement 2026-06-15. ต่อยอดจาก Style Picker ([[QUALITY-MOAT.md]] §5) ให้เป็นแบบ "เดินช็อป" แบบหน้า Live Examples ของ KPPromptCreator
> เกี่ยวข้อง: [[QUALITY-MOAT.md]] §5 (Style Picker/style-kits) · `lib/gas-codegen.ts` GAS_RULEBOOK (snippet ต้อง map กับ rule) · [[BUILDPLAN.md]] §K (Showcase = คนละเรื่อง)

## แนวคิด
ลูกค้า non-coder ไม่รู้ศัพท์ ("sidebar คืออะไร") → ให้ **เดินดูตัวอย่างกดเล่นได้ + ชื่อรูปแบบ** แล้วหยิบใส่ตะกร้า → รวมเป็น **คำสั่งภาษาไทยก้อนเดียว (แก้ได้)** → เปิดโปรเจกต์ใหม่พร้อม prompt ในแชต ต่างจาก PromptCreator ตรงที่ **ครบลูปในระบบ** (ไม่ต้อง copy ไปแปะที่อื่น) + snippet ผูกกับ rulebook → output ตรง+ปลอดภัย

## สถานะ implement (2026-06-15)
- ✅ `lib/style-catalog.ts` — data shape + **seed catalog** (7 หมวด ~14 ตัว): nav (sidebar/topbar/bottom) · buttons (rounded / +loading) · feedback (SweetAlert2 / toast) · theme (dark toggle) · data (table / KPI) · thai (PromptPay / พ.ศ. / leading-zero phone) · forms (clean)
- ✅ `/styleshopping` (`app/styleshopping/page.tsx` + `components/style/StyleShopping.tsx`) — public, browsable; preview ใน `<iframe sandbox="allow-scripts" srcDoc>`; ตะกร้า + ช่อง "อยากได้ระบบอะไร" + prompt แก้ได้ (มีปุ่ม "↺ สร้างใหม่จากที่เลือก" เมื่อแก้มือ)
- ✅ kickoff hand-off: `newProjectReturnId(name)` (action, คืน id) → client `sessionStorage['egs:kickoff']` → `ChatPanel` อ่าน **one-shot** ตอน mount แล้ว prefill ช่องแชต (ไม่ auto-send — ให้ผู้ใช้กดเอง)
- ✅ landing `/` ใหม่ (hero + features + แถบ Style Lab + teaser Showcase); ล็อกอินแล้ว redirect `/projects`

## data shape (`StyleItem`)
`{ id, category, title, when (คำแนะนำไทย), promptSnippet (ฉีดเข้า prompt), previewHtml (self-contained รันใน iframe) }`
รวม prompt: `สร้าง<purpose>\n\nโดยใช้สไตล์และองค์ประกอบเหล่านี้:\n- <snippet>…`

## roadmap หมวดที่ยัง "ขาด" (จากที่เสนอ — ยังไม่ seed)
🔧=GAS · 🇹🇭=ไทย · ✨=SPA · ⚠️=มี caveat
- 12. แจ้งเตือน/ส่งข้อความ 🔧🇹🇭 — อีเมล (MailApp) · **LINE Messaging API push** (ไม่ใช่ LINE Notify ที่ปิดแล้ว) · LIFF
- 13. ตั้งเวลา/อัตโนมัติ 🔧 — time-trigger (รายงาน/เตือนนัด) · onFormSubmit/onEdit
- 14. ค้นหา/กรอง — filter chips · เลือกช่วงวันที่
- 15. รายงาน/export 🔧 — กราฟ · PDF/CSV · **mail-merge Doc→PDF**
- 16. กล้อง/ไฟล์/QR 🔧 — ถ่ายรูปนิ่ง `<input capture>` · QR gen · อัปโหลด Drive · ⚠️ กล้องสด/สแกนต่อเนื่องทำไม่ได้บน GAS ([[WEB-TARGET.md]])
- 17. แผนที่/ตำแหน่ง 🇹🇭 — ฝัง Google Maps · ปุ่มนำทาง · ⚠️ geolocation caveat
- 18. เวิร์กโฟลว์/สถานะ 🔧 — อนุมัติ · stepper · มอบหมาย · คอมเมนต์
- 19. ตั้งค่า/แอดมิน — settings · จัดการผู้ใช้
- ตัวตน/สิทธิ์ 🔐 — custom login (เก็บในชีต salt+pepper+iterated, rule `secure-custom-auth` ทำแล้ว) · remember-me (session token) · Alpine SPA role-based / หน้าเดียว
- robustness 🔧 — 429 backoff · pagination ตารางใหญ่ · กัน formula-injection (rule ทำแล้ว) · debounced auto-save

## ข้อควรรู้
- **snippet ต้อง map กับ rule ใน GAS_RULEBOOK** — เพิ่ม item ใหม่ที่แตะเรื่อง security/correctness (auth, สต๊อก, เงิน) ให้เช็คว่ามี rule รองรับก่อน
- **iframe ใช้ `sandbox="allow-scripts"` (ไม่มี allow-same-origin)** — preview เป็น content ที่ "เรา" เขียนเอง (trusted) แต่ยึด posture เดียวกับ PreviewPane; inline script ใน preview จะโดน CSP ตอน **enforce** (ตอนนี้ Report-Only) — ปรับ CSP ก่อนเปิด enforce เหมือน preview หลัก
- **ก่อน build จริง** previewHtml เป็น mock เพื่อโชว์หน้าตา — โค้ดจริงที่ AI สร้างมาจาก rulebook + snippet ไม่ใช่ก๊อป previewHtml
