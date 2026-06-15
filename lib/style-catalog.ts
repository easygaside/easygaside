/**
 * Style Lab catalog — curated, shoppable UI building blocks for GAS web apps (docs/STYLE-LAB.md).
 * Each item has a self-contained `previewHtml` (rendered in a sandboxed iframe on /styleshopping) and
 * a Thai `promptSnippet` that gets bundled into the new-project prompt. Snippets map to patterns the
 * rulebook already knows (nav, SweetAlert2, loading state, leading-zero, …) so the output stays
 * consistent + safe. This is a SEED set — grow it; nothing here is load-bearing beyond the page.
 */

export interface StyleCategory {
  id: string;
  title: string;
  hint: string; // one-line guidance shown atop the category
}

export interface StyleItem {
  id: string;
  category: StyleCategory["id"];
  title: string;
  when: string; // when to use (Thai)
  promptSnippet: string; // injected into the combined prompt
  previewHtml: string; // self-contained, renders in a sandboxed iframe
}

export const STYLE_CATEGORIES: StyleCategory[] = [
  { id: "nav", title: "เมนู & การจัดวาง", hint: "เลือกวิธีจัดเมนู — sidebar เหมาะจอใหญ่/หลายเมนู, top tabs เรียบง่าย, bottom bar เน้นมือถือ" },
  { id: "buttons", title: "ปุ่ม & การโต้ตอบ", hint: "หน้าตาปุ่ม + สถานะระหว่างรอเซิร์ฟเวอร์ (สำคัญมากบน Apps Script)" },
  { id: "feedback", title: "แจ้งเตือน & ป๊อปอัป", hint: "ยืนยัน/แจ้งผล แบบสวยและไม่รบกวน" },
  { id: "theme", title: "ธีม & โทนสี", hint: "โหมดสว่าง/มืด และโทนสีรวม" },
  { id: "data", title: "แสดงข้อมูล", hint: "ตาราง/การ์ดสรุป สำหรับข้อมูลจาก Google Sheet" },
  { id: "thai", title: "เฉพาะธุรกิจไทย", hint: "พร้อมเพย์ · วันที่ พ.ศ. · เบอร์โทร — สิ่งที่ AI ทั่วไปมักทำพลาด" },
  { id: "forms", title: "ฟอร์ม", hint: "รูปแบบฟอร์มกรอกข้อมูล" },
];

const FONT = "font-family:system-ui,'Noto Sans Thai',sans-serif";
const doc = (body: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
  `<style>*{box-sizing:border-box}body{${FONT};margin:0;padding:14px;background:#f8fafc;color:#0f172a;font-size:14px}` +
  `button{cursor:pointer;font-family:inherit}</style></head><body>${body}</body></html>`;

export const STYLE_CATALOG: StyleItem[] = [
  // ── nav ──
  {
    id: "nav-sidebar",
    category: "nav",
    title: "เมนูข้าง (Sidebar)",
    when: "มีหลายเมนู/หน้า และใช้บนจอใหญ่เป็นหลัก — บนมือถือพับเป็นปุ่มขีดสามขีด",
    promptSnippet: "ใช้เมนูแบบ Sidebar (เมนูข้างซ้าย ไฮไลต์เมนูที่เลือก พับเก็บเป็น hamburger บนมือถือ)",
    previewHtml: doc(
      `<div style="display:flex;gap:0;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#fff;height:150px">
        <nav style="width:120px;background:#0f172a;color:#cbd5e1;padding:12px 8px;font-size:13px">
          <div style="font-weight:700;color:#fff;margin-bottom:10px">เมนู</div>
          <div style="background:#1e293b;color:#fff;padding:7px 9px;border-radius:8px">📊 สรุป</div>
          <div style="padding:7px 9px">📋 รายการ</div>
          <div style="padding:7px 9px">⚙️ ตั้งค่า</div>
        </nav>
        <div style="flex:1;padding:14px"><div style="font-weight:700">สรุป</div><div style="color:#64748b;font-size:13px;margin-top:6px">เนื้อหาของหน้าที่เลือก</div></div>
      </div>`,
    ),
  },
  {
    id: "nav-topbar",
    category: "nav",
    title: "แท็บด้านบน (Top tabs)",
    when: "เมนูไม่เยอะ (2–4) อยากได้แบบเรียบง่าย สลับหน้าเร็ว",
    promptSnippet: "ใช้เมนูแบบแท็บด้านบน (Top tabs) สลับเนื้อหาแบบ SPA ไม่รีโหลดหน้า",
    previewHtml: doc(
      `<div style="border:1px solid #e2e8f0;border-radius:12px;background:#fff;overflow:hidden">
        <div style="display:flex;gap:4px;border-bottom:1px solid #e2e8f0;padding:8px 8px 0">
          <div style="padding:8px 14px;border-bottom:2px solid #6366f1;color:#4338ca;font-weight:600">สรุป</div>
          <div style="padding:8px 14px;color:#64748b">รายการ</div>
          <div style="padding:8px 14px;color:#64748b">ตั้งค่า</div>
        </div>
        <div style="padding:16px;color:#64748b;font-size:13px">เนื้อหาแท็บที่เลือก</div>
      </div>`,
    ),
  },
  {
    id: "nav-bottom",
    category: "nav",
    title: "แถบล่างมือถือ (Bottom bar)",
    when: "ใช้บนมือถือเป็นหลัก เอื้อมนิ้วถึงง่าย 3–5 เมนู",
    promptSnippet: "ใช้เมนูแบบแถบล่างมือถือ (Bottom tab bar) ไอคอน+ป้ายกำกับ 3–5 ปุ่ม",
    previewHtml: doc(
      `<div style="border:1px solid #e2e8f0;border-radius:12px;background:#fff;height:150px;display:flex;flex-direction:column;overflow:hidden">
        <div style="flex:1;padding:16px;color:#64748b;font-size:13px">หน้าจอแอป</div>
        <div style="display:flex;border-top:1px solid #e2e8f0;text-align:center;font-size:12px">
          <div style="flex:1;padding:10px;color:#4338ca">🏠<br>หน้าหลัก</div>
          <div style="flex:1;padding:10px;color:#94a3b8">📋<br>รายการ</div>
          <div style="flex:1;padding:10px;color:#94a3b8">👤<br>โปรไฟล์</div>
        </div>
      </div>`,
    ),
  },
  // ── buttons ──
  {
    id: "btn-rounded",
    category: "buttons",
    title: "ปุ่มมุมโค้ง โทนเดียว",
    when: "อยากได้ลุคสะอาด ทันสมัย ปุ่มหลักเด่นชัด",
    promptSnippet: "ใช้ปุ่มมุมโค้งมน โทนสีหลักเดียวเด่นชัด ปุ่มรองเป็นขอบเส้น",
    previewHtml: doc(
      `<div style="display:flex;gap:10px;align-items:center;padding:10px">
        <button style="background:#6366f1;color:#fff;border:0;padding:11px 20px;border-radius:12px;font-weight:600">บันทึก</button>
        <button style="background:#fff;color:#475569;border:1px solid #cbd5e1;padding:11px 20px;border-radius:12px;font-weight:600">ยกเลิก</button>
      </div>`,
    ),
  },
  {
    id: "btn-loading",
    category: "buttons",
    title: "ปุ่ม + สถานะกำลังโหลด",
    when: "ทุกปุ่มที่บันทึก/เรียกเซิร์ฟเวอร์ — กันกดซ้ำ + บอกผู้ใช้ว่ากำลังทำงาน",
    promptSnippet: "ทุกปุ่มที่เรียกเซิร์ฟเวอร์ (google.script.run) ให้ปิดปุ่ม + แสดง spinner 'กำลังบันทึก…' ระหว่างรอ แล้วเปิดคืนทั้งตอนสำเร็จและตอนผิดพลาด",
    previewHtml: doc(
      `<div style="display:flex;gap:10px;padding:10px;align-items:center">
        <button id="b" style="background:#6366f1;color:#fff;border:0;padding:11px 20px;border-radius:12px;font-weight:600">บันทึก</button>
        <span style="color:#94a3b8;font-size:12px">กดดูตอนกำลังโหลด</span>
      </div>
      <script>var b=document.getElementById('b');b.onclick=function(){if(b.disabled)return;var t=b.textContent;b.disabled=true;b.style.opacity=.6;b.textContent='⏳ กำลังบันทึก…';setTimeout(function(){b.disabled=false;b.style.opacity=1;b.textContent=t;},1400);};</script>`,
    ),
  },
  // ── feedback ──
  {
    id: "fb-sweetalert",
    category: "feedback",
    title: "SweetAlert2 (ยืนยัน/สำเร็จ)",
    when: "ยืนยันก่อนลบ/บันทึก, แจ้งสำเร็จ-ผิดพลาด แบบสวยกว่า alert ธรรมดา",
    promptSnippet: "ใช้ SweetAlert2 (โหลดจาก CDN) สำหรับยืนยันลบ/บันทึก และแจ้งผลสำเร็จ-ผิดพลาด แทน alert/confirm ธรรมดา",
    previewHtml: doc(
      `<script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
      <div style="padding:10px"><button id="d" style="background:#ef4444;color:#fff;border:0;padding:11px 18px;border-radius:10px;font-weight:600">🗑 ลบรายการ</button></div>
      <script>document.getElementById('d').onclick=function(){Swal.fire({title:'ลบรายการนี้?',text:'ลบแล้วกู้คืนไม่ได้',icon:'warning',showCancelButton:true,confirmButtonColor:'#ef4444',cancelButtonColor:'#94a3b8',confirmButtonText:'ลบเลย',cancelButtonText:'ยกเลิก'}).then(function(r){if(r.isConfirmed)Swal.fire({title:'ลบแล้ว!',icon:'success',timer:1200,showConfirmButton:false});});};</script>`,
    ),
  },
  {
    id: "fb-toast",
    category: "feedback",
    title: "Toast แจ้งผลมุมจอ",
    when: "แจ้งสำเร็จเล็กๆ น้อยๆ โดยไม่ขัดจังหวะผู้ใช้",
    promptSnippet: "แจ้งผลสำเร็จด้วย toast มุมขวาบนแบบไม่บล็อก (auto-hide ~2.5 วิ)",
    previewHtml: doc(
      `<div style="padding:10px"><button id="s" style="background:#10b981;color:#fff;border:0;padding:11px 18px;border-radius:10px;font-weight:600">บันทึก</button></div>
      <div id="t" style="position:fixed;top:12px;right:12px;background:#0f172a;color:#fff;padding:9px 14px;border-radius:10px;font-size:13px;opacity:0;transition:.25s;transform:translateY(-6px)">✅ บันทึกแล้ว</div>
      <script>document.getElementById('s').onclick=function(){var t=document.getElementById('t');t.style.opacity=1;t.style.transform='none';clearTimeout(t._x);t._x=setTimeout(function(){t.style.opacity=0;t.style.transform='translateY(-6px)';},2000);};</script>`,
    ),
  },
  // ── theme ──
  {
    id: "theme-darktoggle",
    category: "theme",
    title: "สลับโหมดสว่าง/มืด",
    when: "อยากให้ผู้ใช้เลือกโหมดเองได้ และจำค่าไว้รอบหน้า",
    promptSnippet: "มีปุ่มสลับโหมดสว่าง/มืด ใช้ CSS variables + คลาส .dark ที่ <html> และจำค่าที่เลือกใน localStorage",
    previewHtml: doc(
      `<div id="c" style="border:1px solid #e2e8f0;border-radius:12px;padding:16px;max-width:260px;background:#fff;color:#0f172a;transition:.2s">
        <div style="font-weight:700">ยอดขายวันนี้</div>
        <div style="font-size:26px;font-weight:800;margin:6px 0">฿12,450</div>
        <button id="t" style="border:1px solid #cbd5e1;background:transparent;color:inherit;padding:8px 12px;border-radius:9px">🌙 สลับเป็น Dark</button>
      </div>
      <script>var c=document.getElementById('c'),t=document.getElementById('t'),d=false;t.onclick=function(){d=!d;c.style.background=d?'#1e293b':'#fff';c.style.color=d?'#f1f5f9':'#0f172a';c.style.borderColor=d?'#334155':'#e2e8f0';t.textContent=d?'☀️ สลับเป็น Light':'🌙 สลับเป็น Dark';};</script>`,
    ),
  },
  // ── data ──
  {
    id: "data-table",
    category: "data",
    title: "ตารางค้นหา/เรียงได้",
    when: "แสดงข้อมูลจาก Sheet เป็นตาราง ค้นหาและแบ่งหน้าได้",
    promptSnippet: "แสดงข้อมูลเป็นตารางที่ค้นหา/เรียงได้ และแบ่งหน้าเมื่อข้อมูลเยอะ (ดึงข้อมูลแบบ pagination ไม่โหลดทั้งหมดรวด)",
    previewHtml: doc(
      `<div style="border:1px solid #e2e8f0;border-radius:12px;background:#fff;overflow:hidden">
        <div style="padding:8px"><input placeholder="🔍 ค้นหา…" style="width:100%;border:1px solid #e2e8f0;border-radius:8px;padding:7px 10px;font-size:13px"></div>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <tr style="background:#f1f5f9;text-align:left"><th style="padding:8px">ชื่อ</th><th style="padding:8px">ยอด</th><th style="padding:8px">สถานะ</th></tr>
          <tr style="border-top:1px solid #eef2f7"><td style="padding:8px">สมชาย</td><td style="padding:8px">฿1,200</td><td style="padding:8px"><span style="background:#dcfce7;color:#16a34a;padding:2px 8px;border-radius:999px;font-size:11px">จ่ายแล้ว</span></td></tr>
          <tr style="border-top:1px solid #eef2f7"><td style="padding:8px">มาลี</td><td style="padding:8px">฿890</td><td style="padding:8px"><span style="background:#fef9c3;color:#ca8a04;padding:2px 8px;border-radius:999px;font-size:11px">รอจ่าย</span></td></tr>
        </table>
      </div>`,
    ),
  },
  {
    id: "data-kpi",
    category: "data",
    title: "การ์ดสรุป KPI",
    when: "แดชบอร์ด — โชว์ตัวเลขสำคัญด้านบนก่อนรายละเอียด",
    promptSnippet: "มีการ์ดสรุปตัวเลขสำคัญ (KPI) เรียงด้านบนของหน้า เช่น ยอดวันนี้/จำนวนรายการ/ค้างจ่าย",
    previewHtml: doc(
      `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div style="border:1px solid #e2e8f0;border-radius:12px;background:#fff;padding:12px"><div style="color:#64748b;font-size:12px">ยอดขายวันนี้</div><div style="font-size:22px;font-weight:800">฿12,450</div></div>
        <div style="border:1px solid #e2e8f0;border-radius:12px;background:#fff;padding:12px"><div style="color:#64748b;font-size:12px">ออเดอร์</div><div style="font-size:22px;font-weight:800">38</div></div>
        <div style="border:1px solid #e2e8f0;border-radius:12px;background:#fff;padding:12px"><div style="color:#64748b;font-size:12px">ลูกค้าใหม่</div><div style="font-size:22px;font-weight:800">7</div></div>
        <div style="border:1px solid #e2e8f0;border-radius:12px;background:#fff;padding:12px"><div style="color:#64748b;font-size:12px">ค้างจ่าย</div><div style="font-size:22px;font-weight:800;color:#ea580c">฿2,100</div></div>
      </div>`,
    ),
  },
  // ── thai ──
  {
    id: "thai-promptpay",
    category: "thai",
    title: "QR พร้อมเพย์ (PromptPay)",
    when: "รับเงินผ่าน QR — ลูกค้าสแกนจ่ายด้วยแอปธนาคาร",
    promptSnippet: "แสดง QR พร้อมเพย์ (PromptPay) สำหรับรับเงินตามยอด พร้อมปุ่มแนบสลิป",
    previewHtml: doc(
      `<div style="border:1px solid #e2e8f0;border-radius:12px;background:#fff;padding:16px;max-width:220px;text-align:center">
        <div style="font-weight:700;color:#1d4ed8">พร้อมเพย์</div>
        <div style="width:96px;height:96px;margin:10px auto;background:repeating-linear-gradient(45deg,#0f172a 0 6px,#fff 6px 12px);border-radius:8px"></div>
        <div style="font-size:13px;color:#64748b">ยอดชำระ</div>
        <div style="font-size:22px;font-weight:800">฿350.00</div>
      </div>`,
    ),
  },
  {
    id: "thai-date",
    category: "thai",
    title: "วันที่แบบไทย (พ.ศ.)",
    when: "เอกสาร/ใบเสร็จ/รายงานที่ต้องเป็นปี พ.ศ. แบบไทย",
    promptSnippet: "แสดงวันที่แบบไทย (ปี พ.ศ. เช่น 15 มิ.ย. 2569) และจัดรูปวันที่ด้วย Utilities.formatDate timezone Asia/Bangkok",
    previewHtml: doc(
      `<div style="border:1px solid #e2e8f0;border-radius:12px;background:#fff;padding:16px;max-width:240px">
        <div style="color:#64748b;font-size:12px">วันที่ออกเอกสาร</div>
        <div style="font-size:18px;font-weight:700">15 มิถุนายน 2569</div>
        <div style="color:#94a3b8;font-size:12px;margin-top:4px">(พ.ศ. — รูปแบบไทย)</div>
      </div>`,
    ),
  },
  {
    id: "thai-phone",
    category: "thai",
    title: "เบอร์โทร (เก็บเลข 0 นำหน้า)",
    when: "ฟอร์มที่มีเบอร์โทร/เลขบัตร — กัน Google Sheet กินเลข 0 ตัวหน้า",
    promptSnippet: "ช่องเบอร์โทร/เลขบัตร ให้เก็บเลข 0 นำหน้าได้ถูกต้อง (setNumberFormat('@') ก่อนเขียน + getDisplayValue ตอนอ่าน)",
    previewHtml: doc(
      `<div style="border:1px solid #e2e8f0;border-radius:12px;background:#fff;padding:16px;max-width:260px">
        <label style="font-size:13px;color:#475569">เบอร์โทร</label>
        <input value="089-123-4567" style="width:100%;border:1px solid #e2e8f0;border-radius:9px;padding:9px 11px;margin-top:5px;font-size:14px">
        <div style="color:#16a34a;font-size:12px;margin-top:6px">✓ เก็บเป็นข้อความ — เลข 0 ไม่หาย</div>
      </div>`,
    ),
  },
  // ── forms ──
  {
    id: "form-clean",
    category: "forms",
    title: "ฟอร์มสะอาด คอลัมน์เดียว",
    when: "ฟอร์มกรอกข้อมูล/จองคิว/ลงทะเบียน — อ่านง่าย กรอกง่าย",
    promptSnippet: "ใช้ฟอร์มสะอาด คอลัมน์เดียว เว้นช่องโปร่ง ป้ายกำกับชัด ปุ่มส่งเด่น ตรวจค่าที่กรอกก่อนส่ง",
    previewHtml: doc(
      `<div style="border:1px solid #e2e8f0;border-radius:12px;background:#fff;padding:16px;max-width:280px">
        <div style="font-weight:700;margin-bottom:10px">จองคิว</div>
        <label style="font-size:13px;color:#475569">ชื่อ</label>
        <input style="width:100%;border:1px solid #e2e8f0;border-radius:9px;padding:9px 11px;margin:5px 0 12px">
        <label style="font-size:13px;color:#475569">วันที่</label>
        <input type="date" style="width:100%;border:1px solid #e2e8f0;border-radius:9px;padding:9px 11px;margin:5px 0 14px">
        <button style="width:100%;background:#10b981;color:#fff;border:0;padding:11px;border-radius:10px;font-weight:600">จองเลย</button>
      </div>`,
    ),
  },
];
