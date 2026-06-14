export const metadata = { title: "นโยบายความเป็นส่วนตัว — easygas" };

/**
 * Placeholder privacy policy. A real, complete policy on this exact domain is a
 * HARD REQUIREMENT for Google OAuth verification (Phase 8). Fill in before submitting.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-slate-300">
      <h1 className="mb-6 text-3xl font-bold">นโยบายความเป็นส่วนตัว</h1>
      <p className="mb-4 text-sm text-amber-300/80">
        (ฉบับร่าง — ต้องเขียนให้ครบก่อนยื่น Google OAuth verification)
      </p>
      <div className="space-y-4 text-sm leading-relaxed">
        <p>
          easygas ขอสิทธิ์เข้าถึง Google Apps Script และ Google Drive (เฉพาะไฟล์ที่แอปสร้าง)
          เพื่อสร้างและ deploy โปรเจกต์ Apps Script ในนามของคุณ
        </p>
        <p>
          เราเก็บ refresh token แบบเข้ารหัส (AES-256-GCM) เพื่อใช้ push โค้ดเข้าบัญชีของคุณ
          และจะไม่เข้าถึงไฟล์อื่นนอกเหนือจากที่แอปสร้าง
        </p>
        <p>คุณสามารถยกเลิกการเชื่อมต่อได้ทุกเมื่อ ซึ่งจะ revoke token ที่ Google และลบออกจากระบบ</p>
      </div>
    </main>
  );
}
