import Link from "next/link";
import { redirect } from "next/navigation";
import { getConnectionStatus } from "@/lib/google-connection";
import { createClient } from "@/lib/supabase/server";

const ERROR_MESSAGES: Record<string, string> = {
  bad_state: "การยืนยันความปลอดภัยล้มเหลว (state ไม่ตรง) ลองใหม่อีกครั้ง",
  exchange_failed: "แลกเปลี่ยน token กับ Google ไม่สำเร็จ",
  no_refresh_token: "Google ไม่ได้คืน refresh token — ลองใหม่และกดยอมรับสิทธิ์",
  store_failed: "บันทึกการเชื่อมต่อไม่สำเร็จ",
  access_denied: "คุณปฏิเสธการให้สิทธิ์",
};

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { connected, status } = await getConnectionStatus(user.id);
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-6">
      <h1 className="text-2xl font-bold">เชื่อมต่อบัญชี Google</h1>
      <p className="text-sm text-slate-400">
        easygas จะขอสิทธิ์ Apps Script (สร้าง/แก้/deploy โปรเจกต์) + Drive (เฉพาะไฟล์ที่แอปสร้าง)
        เพื่อ push โค้ดเข้าบัญชีของคุณเอง
      </p>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {ERROR_MESSAGES[error] ?? `เกิดข้อผิดพลาด: ${error}`}
        </div>
      )}

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200/90">
        <p className="font-semibold">หมายเหตุระหว่างพัฒนา (unverified app)</p>
        <p className="mt-1 text-amber-200/70">
          ตอนนี้แอปยังไม่ผ่าน Google verification — จะเห็นจอเตือน &ldquo;Google hasn&rsquo;t
          verified this app&rdquo; ให้กด <strong>Advanced → Go to easygas (unsafe)</strong> เพื่อทดสอบ
        </p>
      </div>

      {connected && status === "active" ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">
            ✓ เชื่อมต่อแล้ว
          </div>
          <Link
            href="/connect/done"
            className="w-fit rounded-lg bg-emerald-500 px-5 py-2.5 font-medium text-emerald-950 hover:bg-emerald-400"
          >
            ไปทดสอบ deploy →
          </Link>
        </div>
      ) : (
        <a
          href="/api/auth/google/start"
          className="w-fit rounded-lg bg-emerald-500 px-5 py-2.5 font-medium text-emerald-950 hover:bg-emerald-400"
        >
          {status === "needs_reauth" ? "เชื่อมต่อใหม่อีกครั้ง" : "เชื่อมต่อ Google"}
        </a>
      )}
    </main>
  );
}
