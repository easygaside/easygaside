"use server";

import { sendPushToAdmins } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export interface BetaApplicationInput {
  email: string;
  name: string;
  businessType: string;
  buildIdea: string;
  techLevel: string;
  device: string;
  willingFeedback: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Store a closed-beta application. Public (may be logged-out → email fallback). If the applicant
 * signed in with Google and the typed email matches the session, we mark it verified + link user_id.
 * Writes go through the service role; the table has no client RLS policy, so it stays locked.
 */
export async function submitBetaApplication(
  input: BetaApplicationInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: "อีเมลไม่ถูกต้อง — ตรวจสอบอีกครั้ง" };
  if (!input.buildIdea.trim()) return { ok: false, error: "ช่วยบอกสั้น ๆ ว่าอยากสร้างเครื่องมืออะไร" };

  // capture verified identity if they signed in with Google and the email matches
  let userId: string | null = null;
  let verified = false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.email && user.email.toLowerCase() === email) {
      userId = user.id;
      verified = true;
    }
  } catch {
    /* logged out — email-only application is fine */
  }

  const svc = createServiceClient();
  const { error } = await svc.from("egs_beta_applications").upsert(
    {
      user_id: userId,
      email,
      email_verified: verified,
      name: input.name.trim() || null,
      business_type: input.businessType.trim() || null,
      build_idea: input.buildIdea.trim(),
      tech_level: input.techLevel || null,
      device: input.device || null,
      willing_feedback: input.willingFeedback,
      status: "pending",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "email" },
  );
  if (error) return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้งในอีกสักครู่" };
  await sendPushToAdmins({
    title: "📥 ใบสมัครเบต้าใหม่",
    body: `${email} — ${input.buildIdea.trim().slice(0, 100)}`,
    url: "/admin",
    tag: "admin-beta",
  });
  return { ok: true };
}
