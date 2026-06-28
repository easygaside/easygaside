"use server";

import { revalidatePath } from "next/cache";
import { notifyTelegram } from "@/lib/telegram";
import { BYO_PRICE_THB, PLAN_CONFIG, normalizePlan, type Plan } from "@/lib/plan";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const MAX_SLIP_BYTES = 5 * 1024 * 1024;

export interface UpgradeFormState {
  ok?: boolean;
  error?: string;
}

/**
 * Submit a paid-plan upgrade request: validate + store the PromptPay slip (private bucket) + create a
 * pending egs_upgrade_requests row + ping Discord. The founder approves/rejects in /admin (Stage C).
 * useActionState shape so the pricing card can show inline success/error.
 */
export async function submitUpgradeRequest(
  _prev: UpgradeFormState | undefined,
  formData: FormData,
): Promise<UpgradeFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบก่อน" };

  // "byo" = the BYO add-on (own Anthropic key, ฿99/mo); everything else is a normal plan tier.
  const raw = String(formData.get("plan") ?? "");
  const isByo = raw === "byo";
  const plan = isByo ? "byo" : normalizePlan(raw);
  if (!isByo && plan === "free") return { error: "แพ็กเกจไม่ถูกต้อง" };

  const slip = formData.get("slip");
  if (!(slip instanceof File) || slip.size === 0) return { error: "กรุณาแนบสลิปโอนเงิน" };
  if (slip.size > MAX_SLIP_BYTES) return { error: "ไฟล์สลิปใหญ่เกินไป (สูงสุด 5MB)" };
  if (!slip.type.startsWith("image/")) return { error: "สลิปต้องเป็นรูปภาพ" };

  const svc = createServiceClient();
  const ext = slip.type === "image/png" ? "png" : "jpg";
  const path = `${user.id}/${Date.now()}.${ext}`;
  const buf = Buffer.from(await slip.arrayBuffer());
  const up = await svc.storage.from("egs-slips").upload(path, buf, { contentType: slip.type, upsert: false });
  if (up.error) {
    console.error("[upgrade] slip upload failed:", up.error);
    return { error: "อัปโหลดสลิปไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }

  const amount = isByo ? BYO_PRICE_THB : PLAN_CONFIG[plan as Plan].priceThb;
  const label = isByo ? "BYO (คีย์ตัวเอง)" : PLAN_CONFIG[plan as Plan].label;
  const { error } = await svc.from("egs_upgrade_requests").insert({
    user_id: user.id,
    email: user.email ?? null,
    plan,
    amount_thb: amount,
    slip_path: path,
  });
  if (error) {
    console.error("[upgrade] insert failed:", error);
    return { error: "บันทึกคำขอไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }

  await notifyTelegram(
    `🧾 คำขออัปเกรดใหม่ — ${label} ฿${amount}\n` +
      `ผู้ใช้: ${user.email ?? user.id}\n` +
      `อนุมัติ/ปฏิเสธที่ /admin → แท็บ แพ็กเกจ`,
  );
  revalidatePath("/pricing");
  return { ok: true };
}
