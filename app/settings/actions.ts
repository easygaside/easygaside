"use server";

import { revalidatePath } from "next/cache";
import { removeOwnApiKey, setOwnApiKey, validateAnthropicKey } from "@/lib/beta";
import { getCurrentUser } from "@/lib/projects";

export async function saveApiKeyAction(key: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ยังไม่ได้เข้าสู่ระบบ" };

  const trimmed = key.trim();
  if (!trimmed.startsWith("sk-ant-"))
    return { ok: false, error: "รูปแบบคีย์ไม่ถูกต้อง (ต้องขึ้นต้นด้วย sk-ant-)" };

  if (!(await validateAnthropicKey(trimmed)))
    return { ok: false, error: "คีย์ใช้งานไม่ได้ — ตรวจสอบอีกครั้งหรือสร้างใหม่จาก console.anthropic.com" };

  await setOwnApiKey(user.id, trimmed);
  revalidatePath("/settings");
  return { ok: true };
}

export async function removeApiKeyAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("not_authenticated");
  await removeOwnApiKey(user.id);
  revalidatePath("/settings");
}
