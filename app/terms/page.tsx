export const metadata = { title: "เงื่อนไขการใช้งาน — EasyGAS" };

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

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-slate-700 dark:text-slate-300">
      <h1 className="mb-1 text-3xl font-bold">เงื่อนไขการใช้งาน</h1>
      <p className="mb-6 text-xs text-slate-400 dark:text-slate-500">ปรับปรุงล่าสุด {UPDATED}</p>

      <p className="text-sm leading-relaxed">
        เงื่อนไขนี้เป็นข้อตกลงระหว่างคุณกับ EasyGAS (&ldquo;เรา&rdquo;) เมื่อคุณสมัครหรือใช้งาน
        ถือว่าคุณได้อ่านและยอมรับเงื่อนไขนี้แล้ว · ติดต่อ:{" "}
        <a href={`mailto:${CONTACT}`} className="text-emerald-600 underline dark:text-emerald-400">{CONTACT}</a>
      </p>

      <div className="text-sm leading-relaxed">
        <Section title="1. EasyGAS คืออะไร">
          <p>
            EasyGAS ช่วยให้คุณสร้างเครื่องมือบน Google Apps Script จากการพิมพ์คุยกับ AI
            ดูตัวอย่างผลลัพธ์ แล้วติดตั้ง (deploy) ขึ้น<b>บัญชี Google ของคุณเอง</b>
            งานทุกชิ้นที่สร้างขึ้น — โค้ด สคริปต์ และ Google Sheet ที่แอปสร้าง — เป็นของคุณ
            และอยู่ในบัญชี Google ของคุณ ไม่ได้อยู่กับเรา
          </p>
        </Section>

        <Section title="2. ช่วงทดสอบ (Beta)">
          <p>
            ขณะนี้ EasyGAS อยู่ในช่วงทดสอบแบบจำกัดผู้ใช้ ฟีเจอร์อาจเปลี่ยนแปลง หยุดชั่วคราว
            หรือมีข้อจำกัดการใช้งานต่อวัน เราอาจปรับปรุงหรือรีเซ็ตข้อมูลทดสอบได้ และจะพยายามแจ้งล่วงหน้าเท่าที่ทำได้
          </p>
        </Section>

        <Section title="3. บัญชีและการเข้าสู่ระบบ">
          <ul className="list-disc space-y-1 pl-5">
            <li>เข้าสู่ระบบด้วยบัญชี Google เท่านั้น — บัญชีเดียวใช้ทั้งล็อกอินและเชื่อมต่อเพื่อ deploy</li>
            <li>คุณต้องรักษาความปลอดภัยของบัญชี Google ของคุณเอง และรับผิดชอบกิจกรรมที่เกิดขึ้นภายใต้บัญชีของคุณ</li>
            <li>คุณต้องมีสิทธิ์ใช้บัญชี Google ที่นำมาเชื่อมต่อ และปฏิบัติตามเงื่อนไขของ Google ด้วย</li>
          </ul>
        </Section>

        <Section title="4. สิ่งที่ห้ามทำ">
          <ul className="list-disc space-y-1 pl-5">
            <li>สร้างหรือใช้เครื่องมือเพื่อสิ่งที่ผิดกฎหมาย หลอกลวง หรือละเมิดสิทธิ์ผู้อื่น</li>
            <li>ส่งสแปม อีเมลขยะ หรือใช้งานในทางที่ละเมิดเงื่อนไขของ Google / Apps Script</li>
            <li>พยายามเจาะระบบ ทำให้บริการล่ม หรือใช้ช่องโหว่เพื่อเลี่ยงข้อจำกัดการใช้งาน</li>
            <li>ใช้บริการต่อเพื่อขายให้ผู้อื่น (resell) โดยไม่ได้รับอนุญาตในช่วงทดสอบ</li>
          </ul>
          <p>เราขอสงวนสิทธิ์ระงับหรือยกเลิกการใช้งานที่ละเมิดเงื่อนไขเหล่านี้</p>
        </Section>

        <Section title="5. โค้ดที่ AI สร้าง — ตรวจก่อนใช้จริง">
          <p>
            โค้ดที่ AI เขียนให้ช่วยประหยัดเวลาได้มาก แต่<b>ควรลองและตรวจดูก่อนนำไปใช้กับงานจริง</b>
            โดยเฉพาะงานที่เกี่ยวกับข้อมูลลูกค้า เงิน หรือการส่งอีเมล ผลลัพธ์ขึ้นกับสิ่งที่คุณสั่ง
            และอาจมีข้อผิดพลาดได้ คุณเป็นผู้รับผิดชอบการนำโค้ดไปใช้งาน
          </p>
        </Section>

        <Section title="6. บริการตามสภาพ และข้อจำกัดความรับผิด">
          <p>
            EasyGAS ให้บริการ &ldquo;ตามสภาพที่เป็นอยู่&rdquo; (as-is) โดยไม่รับประกันว่าจะไม่มีข้อผิดพลาด
            ไม่หยุดชะงัก หรือเหมาะกับวัตถุประสงค์ใดวัตถุประสงค์หนึ่ง
          </p>
          <p>
            เท่าที่กฎหมายอนุญาต เราไม่รับผิดต่อความเสียหายทางอ้อม การสูญเสียข้อมูล รายได้ หรือโอกาสทางธุรกิจ
            ที่เกิดจากการใช้หรือไม่สามารถใช้บริการได้ คุณควรสำรองข้อมูลสำคัญของคุณเองเสมอ
          </p>
        </Section>

        <Section title="7. การยกเลิกและการลบข้อมูล">
          <ul className="list-disc space-y-1 pl-5">
            <li>คุณเลิกใช้และยกเลิกการเชื่อมต่อ Google ได้ทุกเมื่อ</li>
            <li>การลบโปรเจกต์ในแอปจะลบข้อมูลในระบบเรา แต่สคริปต์/ชีตใน Google Drive ของคุณ<b>ไม่ถูกลบ</b> — คุณเป็นเจ้าของ</li>
            <li>ขอลบบัญชีและข้อมูลทั้งหมดได้โดยส่งอีเมลมาที่ {CONTACT}</li>
          </ul>
        </Section>

        <Section title="8. การเปลี่ยนแปลงเงื่อนไข">
          <p>เราอาจปรับปรุงเงื่อนไขนี้ และจะอัปเดตวันที่ด้านบน หากมีการเปลี่ยนแปลงสำคัญจะแจ้งให้ทราบ การใช้งานต่อหลังการเปลี่ยนแปลงถือว่ายอมรับเงื่อนไขใหม่</p>
        </Section>

        <Section title="9. ติดต่อเรา">
          <p>
            มีคำถามเกี่ยวกับเงื่อนไขนี้ ติดต่อ{" "}
            <a href={`mailto:${CONTACT}`} className="text-emerald-600 underline dark:text-emerald-400">{CONTACT}</a>
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            เอกสารนี้สรุปด้วยภาษาที่เข้าใจง่าย ไม่ใช่คำแนะนำทางกฎหมาย
          </p>
        </Section>

        <p className="mt-6 text-slate-500 dark:text-slate-400">
          เรื่องการเก็บและใช้ข้อมูล อ่านที่{" "}
          <a href="/privacy" className="text-emerald-600 underline dark:text-emerald-400">นโยบายความเป็นส่วนตัว</a>
        </p>
      </div>
    </main>
  );
}
