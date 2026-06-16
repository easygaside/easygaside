import { NextResponse } from "next/server";
import {
  GoogleApiError,
  NeedsReauthError,
  NotConnectedError,
  ProjectApiDisabledError,
  UserSettingsDisabledError,
} from "@/lib/errors";
import { getValidAccessToken } from "@/lib/google-connection";
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
  return HtmlService.createHtmlOutput(
    '<h1 style="font-family:sans-serif">easygas works \\uD83C\\uDF89</h1>' +
    '<p style="font-family:sans-serif;color:#555">Deployed via the Apps Script REST API — no clasp.</p>'
  );
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
      return NextResponse.json(
        {
          error: "USER_SETTINGS_DISABLED",
          message:
            "ยังไม่ได้เปิด Apps Script API สำหรับบัญชี Google นี้ เปิดที่ script.google.com/home/usersettings แล้วลองใหม่",
          enableUrl: "https://script.google.com/home/usersettings",
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
