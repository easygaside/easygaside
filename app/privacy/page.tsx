export const metadata = { title: "นโยบายความเป็นส่วนตัว — EasyGAS" };

const UPDATED = "15 มิถุนายน 2026";
const CONTACT = "easygaside@gmail.com";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-1.5 font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-slate-700 dark:text-slate-300">
      <h1 className="mb-1 text-3xl font-bold">นโยบายความเป็นส่วนตัว</h1>
      <p className="mb-6 text-xs text-slate-400 dark:text-slate-500">ปรับปรุงล่าสุด {UPDATED}</p>

      <p className="text-sm leading-relaxed">
        EasyGAS (&ldquo;เรา&rdquo;) เป็นเครื่องมือช่วยสร้างและติดตั้งสคริปต์ Google Apps Script ผ่าน AI
        นโยบายนี้อธิบายว่าเราเก็บ ใช้ และปกป้องข้อมูลของคุณอย่างไร · ติดต่อ:{" "}
        <a href={`mailto:${CONTACT}`} className="text-emerald-600 underline dark:text-emerald-400">{CONTACT}</a>
      </p>

      <div className="text-sm leading-relaxed">
        <Section title="1. ข้อมูลที่เราเก็บ">
          <ul className="list-disc space-y-1 pl-5">
            <li>บัญชี Google ของคุณ: อีเมลและรหัสผู้ใช้ (จากการเข้าสู่ระบบ)</li>
            <li>Google OAuth refresh token (เก็บแบบ<b>เข้ารหัส</b>) เพื่อสร้าง/ติดตั้งสคริปต์ในบัญชีคุณ</li>
            <li>เนื้อหาที่คุณสร้าง: ข้อความแชต โค้ดที่ AI สร้าง ไฟล์โปรเจกต์ และรูปอ้างอิงที่แนบ</li>
            <li>ข้อมูลการใช้งานเชิงเทคนิค: จำนวนการสร้าง ปริมาณ token เวลา และผลลัพธ์ (เพื่อปรับปรุงบริการ)</li>
          </ul>
        </Section>

        <Section title="2. สิทธิ์ Google ที่เราขอ และเหตุผล">
          <ul className="list-disc space-y-1 pl-5">
            <li><code>openid</code>, <code>email</code> — เพื่อยืนยันตัวตนและเข้าสู่ระบบ</li>
            <li><code>script.projects</code>, <code>script.deployments</code> — เพื่อสร้างและ deploy โปรเจกต์ Apps Script ในบัญชีคุณ</li>
            <li><code>drive.file</code> — เพื่อสร้าง Google Sheet สำหรับเก็บข้อมูลของแอปที่คุณสร้าง <b>เฉพาะไฟล์ที่แอปสร้างเท่านั้น</b> เราไม่เข้าถึงไฟล์อื่นในไดรฟ์ของคุณ</li>
          </ul>
          <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[13px] dark:bg-slate-800/60">
            การใช้และการถ่ายโอนข้อมูลที่ได้รับจาก Google APIs ของ EasyGAS เป็นไปตาม{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noreferrer"
              className="text-emerald-600 underline dark:text-emerald-400"
            >
              Google API Services User Data Policy
            </a>{" "}
            รวมถึงข้อกำหนด Limited Use
            <br />
            <span className="text-slate-500 dark:text-slate-400">
              EasyGAS&rsquo;s use and transfer of information received from Google APIs adheres to the Google
              API Services User Data Policy, including the Limited Use requirements.
            </span>
          </p>
        </Section>

        <Section title="3. เราใช้ข้อมูลทำอะไร">
          <ul className="list-disc space-y-1 pl-5">
            <li>สร้าง แสดงตัวอย่าง และ deploy เครื่องมือ Apps Script ตามที่คุณสั่ง</li>
            <li>ส่งคำสั่ง/โค้ดไปยังผู้ให้บริการ AI ที่เลือก เพื่อสร้างผลลัพธ์</li>
            <li>วัดผลและปรับปรุงคุณภาพบริการ (รวมการเปรียบเทียบโมเดล)</li>
          </ul>
          <p>เรา<b>ไม่</b>ขายข้อมูลของคุณ และไม่ใช้เนื้อหาของคุณเพื่อโฆษณา</p>
        </Section>

        <Section title="4. การเปิดเผยต่อบุคคลที่สาม">
          <p>เพื่อให้บริการทำงาน เราส่งข้อมูลที่จำเป็นไปยัง:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><b>ผู้ให้บริการ AI</b> (Anthropic, OpenAI, DeepSeek, Google Gemini) — คำสั่งและโค้ดถูกส่งไปเพื่อสร้างผลลัพธ์ ตามที่โปรเจกต์ของคุณถูกตั้งค่าให้ใช้</li>
            <li><b>Supabase</b> — ฐานข้อมูลและการยืนยันตัวตน</li>
            <li><b>Telegram</b> — เฉพาะเมื่อคุณกด &ldquo;แจ้งปัญหา&rdquo; ข้อความจะถูกส่งหาทีมงาน</li>
            <li><b>Google</b> — เพื่อสร้าง/ติดตั้งสคริปต์ในบัญชีของคุณเอง</li>
          </ul>
        </Section>

        <Section title="5. การเก็บรักษาและความปลอดภัย">
          <ul className="list-disc space-y-1 pl-5">
            <li>refresh token เข้ารหัสด้วย AES-256-GCM และใช้เฉพาะฝั่งเซิร์ฟเวอร์</li>
            <li>ข้อมูลแยกตามผู้ใช้ด้วย Row Level Security — ผู้ใช้เห็นเฉพาะข้อมูลของตัวเอง</li>
            <li>API key ของระบบเก็บเป็นความลับ ไม่ส่งไปฝั่งเบราว์เซอร์</li>
          </ul>
        </Section>

        <Section title="6. การลบข้อมูลและการเพิกถอน">
          <ul className="list-disc space-y-1 pl-5">
            <li><b>ยกเลิกการเชื่อมต่อ Google</b> ได้ทุกเมื่อ — เราจะ revoke token ที่ Google และลบออกจากระบบ</li>
            <li><b>ลบโปรเจกต์</b> ในแอปจะลบข้อมูลโปรเจกต์ในระบบเรา (สคริปต์/ชีตใน Google Drive ของคุณ <b>ไม่ถูกลบ</b> — คุณเป็นเจ้าของ)</li>
            <li><b>ขอลบบัญชีและข้อมูลทั้งหมด</b> ส่งอีเมลมาที่ {CONTACT} เราจะดำเนินการให้</li>
            <li>ถอนสิทธิ์ที่ Google ได้เองที่{" "}
              <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer" className="text-emerald-600 underline dark:text-emerald-400">
                myaccount.google.com/permissions
              </a>
            </li>
          </ul>
        </Section>

        <Section title="7. สิทธิ์ของคุณ">
          <p>คุณมีสิทธิ์เข้าถึง แก้ไข หรือขอลบข้อมูลของคุณ และถอนความยินยอมได้ทุกเมื่อ ติดต่อ {CONTACT}</p>
        </Section>

        <Section title="8. การเปลี่ยนแปลงนโยบาย">
          <p>เราอาจปรับปรุงนโยบายนี้ และจะอัปเดตวันที่ด้านบน หากมีการเปลี่ยนแปลงสำคัญจะแจ้งให้ทราบ</p>
        </Section>

        <p className="mt-6 text-slate-500 dark:text-slate-400">
          ดูเงื่อนไขการใช้งานที่{" "}
          <a href="/terms" className="text-emerald-600 underline dark:text-emerald-400">เงื่อนไขการใช้งาน</a>
        </p>
      </div>
    </main>
  );
}
