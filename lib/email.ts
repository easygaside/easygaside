import { Resend } from "resend";

/**
 * Transactional email via Resend. Server-only.
 * Sending is always best-effort: callers must not let a mail failure roll back their own work
 * (e.g. approving a beta applicant still succeeds even if the email can't be sent).
 */

/** App origin for links in emails — derived from our OAuth redirect URI (always our own domain). */
function appOrigin(): string {
  const uri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (uri) {
    try {
      return new URL(uri).origin;
    } catch {
      /* fall through */
    }
  }
  return "https://easygaside.tech";
}

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

// Until a domain is verified in Resend, only `onboarding@resend.dev` works (and only to your own
// account email). Set RESEND_FROM to a verified-domain address to email real applicants.
const FROM = process.env.RESEND_FROM || "EasyGAS <onboarding@resend.dev>";

function approvedHtml(loginUrl: string, greeting: string): string {
  return `<!doctype html>
<html lang="th">
  <body style="margin:0;background:#eef3fb;font-family:'Segoe UI',Tahoma,sans-serif;color:#1f2937;">
    <div style="max-width:520px;margin:0 auto;padding:32px 20px;">
      <div style="background:#ffffff;border-radius:20px;padding:32px;box-shadow:0 12px 40px rgba(60,70,110,0.12);">
        <div style="font-size:22px;font-weight:800;color:#0f766e;">Easy<span style="color:#10b981;">GAS</span> IDE</div>
        <h1 style="margin:20px 0 8px;font-size:22px;line-height:1.3;">🎉 คุณได้รับเลือกเข้าร่วม Closed Beta แล้ว!</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#475569;">
          ${greeting} ขอบคุณที่สนใจร่วมทดสอบ EasyGAS — ตอนนี้บัญชีของคุณได้รับสิทธิ์เข้าใช้งานเรียบร้อยแล้ว
          เข้าสู่ระบบด้วยบัญชี Google เดิมที่คุณใช้สมัคร แล้วเริ่มสร้างเครื่องมือ Google Apps Script ตัวแรกได้เลย
        </p>
        <a href="${loginUrl}" style="display:inline-block;margin:8px 0 20px;background:#10b981;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 28px;border-radius:12px;">
          เข้าสู่ระบบ EasyGAS →
        </a>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#94a3b8;">
          ถ้าปุ่มกดไม่ได้ ให้คัดลอกลิงก์นี้ไปเปิดในเบราว์เซอร์:<br />
          <span style="color:#0f766e;">${loginUrl}</span>
        </p>
      </div>
      <p style="text-align:center;margin:18px 0 0;font-size:12px;color:#94a3b8;">
        อีเมลนี้ส่งจากระบบ EasyGAS — หากคุณไม่ได้สมัคร สามารถละเว้นอีเมลนี้ได้
      </p>
    </div>
  </body>
</html>`;
}

/**
 * Notify a beta applicant that they've been approved. Returns true on send, false if there's no
 * API key configured or the send failed (logged server-side). Never throws.
 */
export async function sendBetaApprovedEmail(to: string, name?: string | null): Promise<boolean> {
  const resend = getClient();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipped beta-approved email to", to);
    return false;
  }
  const loginUrl = `${appOrigin()}/login`;
  const greeting = name?.trim() ? `สวัสดีคุณ ${name.trim()}` : "สวัสดีครับ";
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: "🎉 คุณได้รับเลือกเข้าร่วม EasyGAS Closed Beta",
      html: approvedHtml(loginUrl, greeting),
    });
    if (error) {
      console.error("[email] sendBetaApprovedEmail rejected:", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[email] sendBetaApprovedEmail threw:", e);
    return false;
  }
}
