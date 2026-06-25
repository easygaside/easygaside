import { NextResponse } from "next/server";
import { mapGoogleError } from "@/lib/api-helpers";
import { createProject, toApiFiles, updateContent } from "@/lib/gas-script-api";
import { getConnectionStatus, getValidAccessToken, markAppsScriptReady } from "@/lib/google-connection";
import { buildWebAppManifest } from "@/lib/manifest";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const DRIVE = "https://www.googleapis.com/drive/v3";

/**
 * POST /api/gas/verify — silent Apps Script readiness check (used by AppsScriptAutoVerify).
 *
 * Proves the per-user Apps Script API is really usable by doing real writes (create + updateContent)
 * — the only reliable signal, since Google exposes no API to read the usersettings toggle. On
 * success it caches the flag and cleans up the throwaway project (no egs_projects/egs_deployments
 * rows, no leftover card). The toggle-off case surfaces as a mapped 409 the caller can ignore.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(user.id);
  } catch (e) {
    return mapGoogleError(e, (await getConnectionStatus(user.id)).email);
  }

  let scriptId: string | undefined;
  try {
    const proj = await createProject(accessToken, "EasyGAS readiness check");
    scriptId = proj.scriptId;
    await updateContent(
      accessToken,
      scriptId,
      toApiFiles([
        { path: "appsscript.json", content: buildWebAppManifest() },
        { path: "Code.gs", content: "function doGet(){return ContentService.createTextOutput('ok');}" },
      ]),
    );
    await markAppsScriptReady(user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return mapGoogleError(e, (await getConnectionStatus(user.id)).email);
  } finally {
    // Best-effort cleanup of the throwaway (a leftover empty script is harmless, at most once).
    if (scriptId) {
      try {
        await fetch(`${DRIVE}/files/${scriptId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      } catch {
        /* ignore */
      }
    }
  }
}
