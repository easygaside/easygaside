"use server";

import { createClient } from "@/lib/supabase/server";
import { notifyTelegram } from "@/lib/telegram";

const KINDS = new Set(["bug", "idea", "other"]);
const KIND_LABEL: Record<string, string> = { bug: "🐞 บั๊ก", idea: "💡 ข้อเสนอแนะ", other: "📝 อื่น ๆ" };
const MAX_MESSAGE = 2000;

export interface ReportInput {
  message: string;
  kind?: string;
  projectId?: string | null;
  url?: string;
}

/**
 * Store a problem report (RLS: insert-own) and fire a best-effort Telegram notification with the
 * auto-attached context (who / which project / which page).
 */
export async function submitReportAction(
  input: ReportInput,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ยังไม่ได้เข้าสู่ระบบ" };

  const message = (input.message ?? "").trim().slice(0, MAX_MESSAGE);
  if (!message) return { ok: false, error: "กรุณาพิมพ์รายละเอียดปัญหา" };
  const kind = input.kind && KINDS.has(input.kind) ? input.kind : "bug";
  const projectId = input.projectId || null;
  const url = (input.url ?? "").slice(0, 500) || null;

  const { error } = await supabase
    .from("egs_reports")
    .insert({ user_id: user.id, project_id: projectId, kind, message, url });
  if (error) return { ok: false, error: `บันทึกไม่สำเร็จ: ${error.message}` };

  await notifyTelegram(
    [
      `${KIND_LABEL[kind]} — รายงานปัญหา EasyGAS`,
      `จาก: ${user.email ?? user.id}`.trim(),
      projectId ? `โปรเจกต์: ${projectId}` : null,
      url ? `หน้า: ${url}` : null,
      "—",
      message,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return { ok: true };
}
