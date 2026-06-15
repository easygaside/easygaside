# easygas — GATE2: run-and-repair (verify it actually RUNS)

> Build 2026-06-15. ต่อจาก [[QUALITY-MOAT.md]] §4 — Gate 0 (lint) + Gate 1 (rulebook critic) บอกได้แค่ "best-practice ผ่านไหม"; Gate 2 ตอบ **"รันจริงแล้วพังไหม"** ซึ่งคู่แข่ง (Cursor/ChatGPT/Superpowers) ทำไม่ได้เพราะรัน `.gs` ไม่ได้

## รูปแบบที่เลือก: ปุ่ม on-demand (ไม่ใช่อัตโนมัติทุกเทิร์น)
- อัตโนมัติทุกครั้งที่สร้าง = Gate 0 + Gate 1 (ไม่ต้อง deploy)
- **ปุ่ม "ทดสอบรันจริง"** ในหัวแชต (โผล่เมื่อ `hasFiles`) = Gate 2 — กดเมื่อ deploy แล้วอยากชัวร์/เจอปัญหา
- เหตุผล: ไม่เผา token ทุกเทิร์น · ทดสอบ /exec จริง (มีความหมายกว่า) · เลี่ยงปัญหา /dev ที่ต้อง login

## สถาปัตยกรรม
- **Channel 1 (ที่ build) — HTTP probe:** `lib/gas-verify.ts#probeExec` server-fetch `/exec` (`redirect:follow`) แล้ว classify จาก signature ของ GAS error page (`Exception:`, `TypeError/ReferenceError`, `Script function not found`, server-error page, authorization-required, login wall). คืน `{ok, error}`
  - ทำได้เพราะ deploy จริงตั้ง `webapp.access=ANYONE_ANONYMOUS` + `executeAs=USER_DEPLOYING` ([deploy.ts](../lib/deploy.ts)) → เซิร์ฟเวอร์เปิดได้ (ต่างจาก `/dev` ที่ต้องเจ้าของ login)
  - heuristic ตาม content (GAS error มัก HTTP 200) — ไม่เชื่อ status อย่างเดียว
- **Route:** `app/api/verify/[id]/route.ts` (SSE, event protocol เดียวกับ /api/agent)
  ```
  auth + gate + rate-limit + acquireProjectRun (กันชนกับ agent)
  url = getDeployedUrl(id); ถ้าไม่มี → บอกให้กด Deploy ก่อน
  loop i=0..2:
    probe /exec
    ok → "✅ ทดสอบรันจริงผ่าน" → break
    fail → emit error → repair (runAgentLoop, Claude, skipCritic) → deployProject (ลิงก์เดิม) → วนใหม่
  ครบ cap ยังพัง → บอกตรงๆ; logGeneration; emit done(tokens)
  ```
- **Client:** `ChatPanel` แยก `pumpStream(res)` (ใช้ร่วม chat + verify) + ปุ่ม `ทดสอบรันจริง` → stream ผลเข้าแชต + แถบสถานะ "กำลังเปิดแอป…/กำลังแก้แล้ว deploy ใหม่…"

## ทำไม skipCritic ตอน repair
verify ใช้ **execution เป็น oracle** (แรงกว่า critic) → ตอนซ่อมไม่ต้องรัน Gate 1 ซ้ำ ประหยัด+เร็ว (`skipCritic` ใน `RunAgentArgs`, honored ทั้ง Claude/OpenAI arm)

## ข้อจำกัด/ค้าง (รอบนี้ MVP)
- **Channel 2 (`scripts.run` devMode, stack+บรรทัดเป๊ะ)** — ยังไม่ทำ; ต้อง scope `script.scriptapp` + api_executable + เหมาะกับโปรเจกต์แบบฟังก์ชัน (web app ใช้ HTTP probe พอ)
- **Channel 3 (Cloud Logging)** — ยังไม่ทำ; สคริปต์ user อยู่ default GCP project → อ่าน log ตรงไม่ได้ (ต้อง standard project + logging.read)
- classify เป็น heuristic ตาม signature — อาจ false negative ถ้า GAS เปลี่ยนหน้า error / แอปขึ้น 200 พร้อม error ที่ไม่ match → ปรับ signature เพิ่มได้ใน `gas-verify.ts`
- verify-repair ใช้ **Claude เสมอ** (ไม่ตาม arm A/B) + **ไม่หักโควตารายวัน** (กันด้วย run-lock + N≤2) — ทบทวนตอนสเกล
- propagation: re-probe ทันทีหลัง redeploy — ถ้าเจอแคชชั่วครู่อาจต้องเพิ่ม retry สั้นๆ
- ยังไม่ persist สถานะ "verified" ลง DB (ไว้โยงป้าย "✅ รันผ่านจริง" + Showcase §K ภายหลัง)
