"use server";

import { createClient } from "@/lib/supabase/server";
import { notifyTelegram } from "@/lib/telegram";

const KINDS = new Set(["bug", "idea", "other", "broken"]);
const KIND_LABEL: Record<string, string> = {
  bug: "🐞 บั๊ก",
  idea: "💡 ข้อเสนอแนะ",
  other: "📝 อื่น ๆ",
  broken: "🚨 โค้ดพัง แก้ไม่ได้",
};
// kinds where capturing the project's code is worth it for the failure-analysis flywheel
const SNAPSHOT_KINDS = new Set(["bug", "broken"]);
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

  // Failure-analysis flywheel (QUALITY-MOAT §6): on a code-related report, snapshot the project's
  // files so we can study real failures and harden the rulebook/repair. RLS scopes egs_files to the
  // owner, so a non-owner projectId simply yields nothing.
  let codeSnapshot: { path: string; content: string }[] | null = null;
  if (projectId && SNAPSHOT_KINDS.has(kind)) {
    const { data: files } = await supabase
      .from("egs_files")
      .select("path, content")
      .eq("project_id", projectId);
    if (files && files.length > 0) codeSnapshot = files as { path: string; content: string }[];
  }

  const { error } = await supabase
    .from("egs_reports")
    .insert({ user_id: user.id, project_id: projectId, kind, message, url, code_snapshot: codeSnapshot });
  if (error) return { ok: false, error: `บันทึกไม่สำเร็จ: ${error.message}` };

  await notifyTelegram(
    [
      `${KIND_LABEL[kind]} — รายงานปัญหา EasyGAS`,
      `จาก: ${user.email ?? user.id}`.trim(),
      projectId ? `โปรเจกต์: ${projectId}` : null,
      codeSnapshot ? `แนบ snapshot โค้ด: ${codeSnapshot.length} ไฟล์` : null,
      url ? `หน้า: ${url}` : null,
      "—",
      message,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return { ok: true };
}
