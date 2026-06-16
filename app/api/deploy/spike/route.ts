import { NextResponse } from "next/server";
import {
  GoogleApiError,
  NeedsReauthError,
  NotConnectedError,
  ProjectApiDisabledError,
  UserSettingsDisabledError,
} from "@/lib/errors";
import { userSettingsUrl } from "@/lib/api-helpers";
import { getConnectionStatus, getValidAccessToken } from "@/lib/google-connection";
import {
  createDeployment,
  createProject,
  createVersion,
  toApiFiles,
  updateContent,
} from "@/lib/gas-script-api";
import { buildWebAppManifest } from "@/lib/manifest";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

/**
 * POST /api/deploy/spike
 *
 * Phase 0 de-risking spike. Proves the full critical chain on the founder's own
 * Google account, with NO AI / editor / preview involved:
 *   OAuth refresh token → Apps Script create → push → version → deploy → live /exec URL
 *
 * Deploys one hardcoded web app: doGet returns "<h1>easygas works</h1>".
 */

const SPIKE_CODE_GS = `function doGet() {
  var html = \`<!DOCTYPE html>
<html lang="th"><head><meta charset="utf-8">
<title>EasyGAS</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;
       font-family:-apple-system,"Segoe UI","Sarabun",system-ui,sans-serif;color:#0f172a;
       background:radial-gradient(1100px 560px at 50% -10%,#ffffff,#eef3fb 42%,#e6ecf7)}
  .card{width:100%;max-width:440px;background:rgba(255,255,255,.86);
        border:1px solid rgba(148,163,184,.25);border-radius:28px;padding:40px 32px;text-align:center;
        box-shadow:0 24px 60px rgba(60,70,110,.14)}
  .logo{width:64px;height:64px;margin:0 auto 18px;display:block;border-radius:18px;
        box-shadow:0 10px 24px rgba(16,185,129,.4)}
  .pill{display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:600;color:#059669;
        background:rgba(16,185,129,.12);padding:6px 13px;border-radius:999px;margin-bottom:14px}
  .dot{width:7px;height:7px;border-radius:999px;background:#10b981;box-shadow:0 0 0 4px rgba(16,185,129,.18)}
  h1{margin:0 0 10px;font-size:25px;letter-spacing:-.02em}
  h1 .g{color:#10b981}
  p{margin:0;color:#64748b;font-size:15px;line-height:1.65}
  .foot{margin-top:26px;font-size:12px;color:#94a3b8}
</style></head>
<body><div class="card">
  <img class="logo" src="https://fusjcmcskyssryjvzxbf.supabase.co/storage/v1/object/public/icon/apple-icon-120x120.png" alt="EasyGAS" width="64" height="64">
  <div class="pill"><span class="dot"></span>ระบบพร้อมใช้งาน</div>
  <h1>เชื่อมต่อสำเร็จ · Easy<span class="g">GAS</span></h1>
  <p>เว็บแอปนี้ deploy เข้าบัญชี Google ของคุณเรียบร้อยแล้ว<br>พร้อมให้ AI สร้างเครื่องมือจริงให้คุณ ✨</p>
  <div class="foot">สร้างด้วย EasyGAS</div>
</div></body></html>\`;
  return HtmlService.createHtmlOutput(html)
    .setTitle('EasyGAS')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}`;

export async function POST() {
  // 1. Must be logged into easygas.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  try {
    // 2. Fresh access token from the stored (encrypted) refresh token.
    const accessToken = await getValidAccessToken(user.id);

    // 3. Apps Script pipeline.
    const { scriptId } = await createProject(accessToken, "easygas spike");

    const files = toApiFiles([
      { path: "appsscript.json", content: buildWebAppManifest() },
      { path: "Code.gs", content: SPIKE_CODE_GS },
    ]);
    await updateContent(accessToken, scriptId, files);

    const versionNumber = await createVersion(accessToken, scriptId, "spike v1");
    const { deploymentId, webAppUrl } = await createDeployment(
      accessToken,
      scriptId,
      versionNumber,
      "easygas spike",
    );

    // 4. Persist (service-role; guard owner in code). Upsert a spike project, record the deployment.
    const svc = createServiceClient();
    const { data: project, error: projErr } = await svc
      .from("egs_projects")
      .upsert(
        {
          owner_id: user.id,
          name: "easygas spike",
          kind: "webapp",
          script_id: scriptId,
        },
        { onConflict: "owner_id,name" },
      )
      .select("id")
      .single();
    if (projErr) {
      console.error("[deploy/spike] db_project error:", projErr.message, { scriptId });
      return NextResponse.json({ error: "db_project" }, { status: 500 });
    }

    await svc.from("egs_deployments").insert({
      project_id: project.id,
      deployment_id: deploymentId,
      entry_type: "webapp",
      exec_url: webAppUrl,
      version_number: versionNumber,
    });

    // 5. Done.
    return NextResponse.json({ ok: true, scriptId, deploymentId, execUrl: webAppUrl });
  } catch (err) {
    if (err instanceof UserSettingsDisabledError) {
      const { email } = await getConnectionStatus(user.id);
      return NextResponse.json(
        {
          error: "USER_SETTINGS_DISABLED",
          message: email
            ? `ยังไม่ได้เปิด Apps Script API สำหรับบัญชี ${email} (บัญชีที่โค้ดจะ deploy เข้า) — เปิดลิงก์โดยล็อกอินด้วยบัญชีนั้น แล้วลองใหม่`
            : "ยังไม่ได้เปิด Apps Script API สำหรับบัญชี Google นี้ เปิดที่ script.google.com/home/usersettings แล้วลองใหม่",
          enableUrl: userSettingsUrl(email),
        },
        { status: 409 },
      );
    }
    if (err instanceof ProjectApiDisabledError) {
      return NextResponse.json(
        {
          error: "PROJECT_API_DISABLED",
          message:
            "ระบบยังเปิด Apps Script API ในโปรเจกต์ Google Cloud ไม่ครบ — เปิดที่ Cloud Console แล้วลองใหม่ (ปกติผู้ใช้ทั่วไปไม่ต้องทำขั้นนี้)",
          enableUrl: err.enableUrl,
        },
        { status: 409 },
      );
    }
    if (err instanceof NotConnectedError) {
      return NextResponse.json({ error: "NOT_CONNECTED" }, { status: 409 });
    }
    if (err instanceof NeedsReauthError) {
      return NextResponse.json({ error: "NEEDS_REAUTH" }, { status: 409 });
    }
    if (err instanceof GoogleApiError) {
      return NextResponse.json(
        { error: "GOOGLE_API_ERROR", status: err.status, detail: err.body },
        { status: 502 },
      );
    }
    console.error("[deploy/spike] unexpected error:", err);
    return NextResponse.json({ error: "UNKNOWN" }, { status: 500 });
  }
}
