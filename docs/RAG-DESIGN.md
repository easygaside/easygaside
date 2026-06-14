# easygas — RAG-DESIGN: คลังความรู้ + retrieval (ยังไม่เปิดใช้, ออกแบบรอเสียบ)

> สถานะ: **seam วางแล้ว, RAG ยังปิด** — `lib/retrieval.ts#retrieveContext()` คืนค่าว่างวันนี้
> (static `GAS_RULEBOOK` ใน `lib/gas-codegen.ts` ทำงานคนเดียว). เอกสารนี้คือแผนเปิดใช้เมื่อถึงเงื่อนไข
>
> เกี่ยวข้อง: [[QUALITY-MOAT.md]] §6 Flywheel · `lib/anthropic-agent.ts` (จุด inject) · `lib/retrieval.ts` (seam)

## 1. ทำไมตอนนี้ยัง "ไม่ใช่ RAG" (และทำไมถูกแล้ว)

ปัจจุบัน best-practices = **rulebook ตายตัว** ยัดทั้งก้อนเข้า `system` ทุกครั้งแล้ว prompt-cache.
เหมาะกับ MVP เพราะ:

- rulebook ยังเล็ก (~20 กฎ) → ใส่หมดได้ + cache ถูกกว่า retrieval
- **corpus ว่าง** — ยังไม่มีโปรเจกต์ที่ "รันเขียว+deploy จริง" ให้ดึงมาเป็นตัวอย่าง → retrieve มาก็ไม่มีอะไร
- KISS: เพิ่ม pgvector ตอนนี้ = over-engineer

**ความต่างหลัก:** static = ส่งทุกอย่างเสมอ (ไม่เลือก) · RAG = embed คำสั่งผู้ใช้ → ค้น top-K ที่เกี่ยว → ใส่เฉพาะนั้น

## 2. เปิด RAG เมื่อ (trigger condition — อย่าทำก่อน)

ทำเมื่อถึง **ข้อใดข้อหนึ่ง**:

1. **มี verified corpus พอ** — โปรเจกต์ที่รันเขียว+deploy จริง ≥ ~50 ตัว → index เป็น few-shot = "ยิ่งสร้างเยอะยิ่งเก่ง" ของจริง (flywheel ใน [[QUALITY-MOAT.md]] §6)
2. **rulebook โตจนแยก domain** — LINE / Sheets รายงาน / ฟอร์ม / ระบบจอง ฯลฯ จนไม่อยากส่งทั้งหมดทุกครั้ง (เปลือง token + กลบ signal)

ก่อนถึงจุดนั้น: **เก็บ data ไว้ก่อน** (ดู §6 capture) แต่ยังไม่ต้อง retrieve

## 3. Schema — `egs_knowledge` (Supabase pgvector)

```sql
-- future migration: supabase/migrations/<ts>_egs_knowledge.sql
create extension if not exists vector;

create table egs_knowledge (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('rulebook','snippet','verified_project','failure_fix')),
  domain       text,                       -- 'line' | 'sheets-report' | 'form' | 'booking' | null = ทั่วไป
  title        text not null,
  -- เนื้อหาที่จะ inject เข้า prompt (โค้ด/กฎ/few-shot pair). เก็บแบบ anonymized
  body         text not null,
  -- ที่มา (อ้างกลับได้ แต่ไม่ผูก owner ใน body): project ที่รันเขียว ฯลฯ
  source_project_id uuid references egs_projects(id) on delete set null,
  ran_green    boolean not null default false,   -- ผ่าน gate 2 (dynamic) จริงไหม
  -- text-embedding (เช่น text-embedding-3-small = 1536 มิติ; ปรับตามโมเดล)
  embedding    vector(1536) not null,
  use_count    int not null default 0,           -- ถูก retrieve ไปใช้กี่ครั้ง (จัดอันดับ)
  win_count    int not null default 0,           -- ใช้แล้วผลลัพธ์รันเขียว (signal คุณภาพ)
  created_at   timestamptz not null default now()
);

-- ANN index (เลือก hnsw — แม่นกว่า ivfflat สำหรับชุดเล็ก-กลาง)
create index egs_knowledge_embedding_idx on egs_knowledge
  using hnsw (embedding vector_cosine_ops);
create index egs_knowledge_domain_idx on egs_knowledge(domain) where domain is not null;

-- RLS: คลังเป็น "ทรัพย์สินกลาง" ของ easygas — อ่านผ่าน service-role เท่านั้น (ไม่ expose ให้ client)
alter table egs_knowledge enable row level security;
-- ไม่มี policy = client ปกติแตะไม่ได้; การ retrieve ทำฝั่ง server (service-role) เท่านั้น
```

หมายเหตุ: **ห้ามเก็บ PII/ความลับลูกค้าใน `body`** — เก็บแค่ pattern/โครงสร้าง/snippet ที่ anonymized แล้ว, และ **opt-in** (ผู้ใช้ยอมให้โปรเจกต์ตัวเองช่วยพัฒนาคลัง)

## 4. Retrieval flow (เสียบที่ `retrieveContext` — ที่เดียว)

```
userMessage + project.domain
   ▼ embed(userMessage)  ← OpenAI text-embedding-3-small / Gemini embeddings
   ▼ SQL: select body,title from egs_knowledge
        where (domain = $domain or domain is null) and ran_green
        order by embedding <=> $queryEmbedding        -- cosine distance
        limit K (=4)
   ▼ ตัดด้วย threshold (distance < 0.35) — กัน retrieve ขยะตอน corpus บาง
   ▼ ประกอบเป็น text block:
        "## ตัวอย่างที่พิสูจน์แล้วว่ารันได้ (อ้างอิงประกอบ ไม่ใช่ก๊อปทั้งดุ้น):\n=== <title> ===\n<body>\n..."
   ▼ return { text, sources:[id...] }
```

`lib/anthropic-agent.ts#runTurn` ทำส่วนที่เหลือให้แล้ว: prepend `text` หน้า user message (ไม่แตะ
`system` → cache ยัง hit), และ **persist เฉพาะ original message** (ไม่เก็บ prefix ลง history).
→ เปิด RAG = แก้ `retrieveContext` ฟังก์ชันเดียว ไม่ต้องรื้อ loop

## 5. ทำไม inject หน้า user message (ไม่ใช่ใน `system`)

`system` ถูก `cache_control: ephemeral` — ต้อง **byte-identical** ถึงจะ cache hit. ถ้ายัด retrieved
(เปลี่ยนทุก request) เข้า `system` = cache พังทุกครั้ง = แพง. วางใน user message → rulebook ยัง cache,
retrieved เป็น input ปกติ. (ดู comment ใน `runTurn`)

## 6. Capture loop — เก็บ data **ตั้งแต่ตอนนี้** (ก่อนเปิด retrieve)

แม้ retrieve ยังปิด ควรเริ่มสะสม signal เพื่อให้ corpus พร้อมเมื่อถึง §2:

```
generation → gate 0 (lint) → gate 1 (critic) → [gate 2 dynamic — เมื่อทำเสร็จ]
   รันเขียว + deploy จริง → capture { spec, files, ran_green:true, edits_to_fix }
      ├─ run ดี       → candidate 'verified_project' (รอ curate)
      ├─ failure ซ้ำ  → candidate 'failure_fix' / rulebook entry ใหม่
      └─ (เปิด RAG แล้ว) embed → egs_knowledge → few-shot รอบถัดไป
```

**KPI ติดผนัง:** `first-run-green rate` (% รันผ่านโดยไม่ต้องซ่อม) ควรไต่ขึ้น monotonic เมื่อ corpus โต

## 7. Build order (เมื่อถึงเวลา)

1. migration `egs_knowledge` + เปิด `vector` extension
2. `lib/embeddings.ts` — `embed(text): number[]` (provider เดียว, cache ผลลัพธ์)
3. seed `kind='rulebook'/'snippet'` ชุดแรกจาก `GAS_RULEBOOK` + golden snippets (มีของอยู่แล้ว)
4. เปิด `retrieveContext` จริง (embed → ANN query → threshold → format)
5. capture pipeline หลัง deploy เขียว (§6) + curate UI ใน superadmin
6. วัด first-run-green rate ก่อน/หลัง → ตัดสินใจ K, threshold, domain split

## 8. ขอบเขต — สิ่งที่ "ข้ามเลย" (overkill สำหรับ indie)

repo-graph RAG · RL/fine-tune · constrained decoding · multi-vector/HyDE rerank ราคาแพง —
เริ่มด้วย ANN + threshold ตรง ๆ ก่อน, เพิ่ม rerank (cross-encoder) ต่อเมื่อวัดแล้วว่า retrieve เริ่มไม่แม่น
