import { NextResponse } from "next/server";
import {
  GoogleApiError,
  NeedsReauthError,
  NotConnectedError,
  UserSettingsDisabledError,
} from "@/lib/errors";

/** Map Google/Apps-Script errors to safe client responses (no internal detail leaked). */
export function mapGoogleError(e: unknown): NextResponse {
  if (e instanceof UserSettingsDisabledError) {
    return NextResponse.json(
      {
        error: "USER_SETTINGS_DISABLED",
        enableUrl: "https://script.google.com/home/usersettings",
        message:
          "ยังไม่ได้เปิด Apps Script API สำหรับบัญชี Google นี้ — เปิดที่ usersettings แล้วลองใหม่",
      },
      { status: 409 },
    );
  }
  if (e instanceof NotConnectedError)
    return NextResponse.json({ error: "NOT_CONNECTED" }, { status: 409 });
  if (e instanceof NeedsReauthError)
    return NextResponse.json({ error: "NEEDS_REAUTH" }, { status: 409 });
  if (e instanceof GoogleApiError) {
    console.error("[google-api]", e.status, e.body);
    return NextResponse.json({ error: "GOOGLE_API_ERROR" }, { status: 502 });
  }
  console.error("[deploy/preview] unexpected:", e);
  const code = e instanceof Error && e.message === "no_files" ? "NO_FILES" : "UNKNOWN";
  return NextResponse.json({ error: code }, { status: code === "NO_FILES" ? 400 : 500 });
}
