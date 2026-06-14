export const metadata = { title: "เงื่อนไขการใช้งาน — easygas" };

/**
 * Terms of use. Plain-language draft — have it reviewed before the public launch / Google OAuth
 * verification. Linked from the login accept-terms checkbox.
 */
export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-slate-300">
      <h1 className="mb-2 text-3xl font-bold">เงื่อนไขการใช้งาน</h1>
      <p className="mb-8 text-sm text-amber-300/80">(ฉบับร่าง — จะปรับให้ครบก่อนเปิดใช้งานจริง)</p>

      <div className="space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="mb-1.5 font-semibold text-slate-100">EasyGAS ทำอะไรให้คุณ</h2>
          <p>
            EasyGAS ช่วยคุณสร้างเครื่องมือบน Google Apps Script จากการพิมพ์คุยกับ AI
            แล้วติดตั้งขึ้นบัญชี Google ของคุณเอง งานทุกชิ้นที่สร้างขึ้นเป็นของคุณ
            และอยู่ในบัญชี Google ของคุณ ไม่ได้อยู่กับเรา
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 font-semibold text-slate-100">สิทธิ์ที่เราขอ</h2>
          <p>
            เราขอเข้าถึงเฉพาะไฟล์ที่แอปสร้างขึ้นเพื่อเขียนโค้ดและติดตั้งให้คุณเท่านั้น
            ไม่ยุ่งกับไฟล์อื่นในไดรฟ์ของคุณ และคุณยกเลิกการเชื่อมต่อได้ทุกเมื่อ
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 font-semibold text-slate-100">ตรวจงานก่อนใช้จริง</h2>
          <p>
            โค้ดที่ AI เขียนให้ช่วยประหยัดเวลาได้มาก แต่ควรลองและตรวจดูก่อนนำไปใช้กับงานจริง
            โดยเฉพาะงานที่เกี่ยวกับข้อมูลลูกค้า เงิน หรือการส่งอีเมล เพราะผลลัพธ์ขึ้นกับสิ่งที่คุณสั่ง
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 font-semibold text-slate-100">สิ่งที่ห้ามทำ</h2>
          <p>
            อย่าใช้ EasyGAS สร้างสิ่งที่ผิดกฎหมาย ส่งสแปม หรือละเมิดสิทธิ์ผู้อื่น
            รวมถึงเงื่อนไขการใช้งานของ Google เองด้วย
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 font-semibold text-slate-100">ช่วงพัฒนา</h2>
          <p>
            ตอนนี้ EasyGAS ยังอยู่ในช่วงพัฒนา ให้บริการตามสภาพที่เป็นอยู่ อาจมีปรับปรุง
            หยุดชั่วคราว หรือเปลี่ยนแปลงฟีเจอร์ได้ เราจะพยายามแจ้งล่วงหน้าเท่าที่ทำได้
          </p>
        </section>

        <p className="pt-2 text-slate-400">
          เรื่องการเก็บและใช้ข้อมูล อ่านเพิ่มได้ที่{" "}
          <a href="/privacy" className="text-emerald-400 underline">
            นโยบายความเป็นส่วนตัว
          </a>
        </p>
      </div>
    </main>
  );
}
