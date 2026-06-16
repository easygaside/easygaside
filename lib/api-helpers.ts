import { NextResponse } from "next/server";
import {
  GoogleApiError,
  NeedsReauthError,
  NotConnectedError,
  ProjectApiDisabledError,
  UserSettingsDisabledError,
} from "@/lib/errors";

/**
 * Build the usersettings link for the CONNECTED account. The toggle is per-Google-account, and a
 * bare link opens whatever account is default in the browser — which may NOT be the connected
 * deploy account. `authuser=<email>` pins it to the right one.
 */
export function userSettingsUrl(connectedEmail?: string | null): string {
  const base = "https://script.google.com/home/usersettings";
  return connectedEmail ? `${base}?authuser=${encodeURIComponent(connectedEmail)}` : base;
}

/** Map Google/Apps-Script errors to safe client responses (no internal detail leaked). */
export function mapGoogleError(e: unknown, connectedEmail?: string | null): NextResponse {
  if (e instanceof UserSettingsDisabledError) {
    return NextResponse.json(
      {
        error: "USER_SETTINGS_DISABLED",
        enableUrl: userSettingsUrl(connectedEmail),
        message: connectedEmail
          ? `ยังไม่ได้เปิด Apps Script API สำหรับบัญชี ${connectedEmail} (บัญชีที่โค้ดจะ deploy เข้า) — เปิดลิงก์โดยล็อกอินด้วยบัญชีนั้น แล้วลองใหม่`
          : "ยังไม่ได้เปิด Apps Script API สำหรับบัญชี Google นี้ — เปิดที่ usersettings แล้วลองใหม่",
      },
      { status: 409 },
    );
  }
  if (e instanceof ProjectApiDisabledError) {
    return NextResponse.json(
      {
        error: "PROJECT_API_DISABLED",
        enableUrl: e.enableUrl,
        message:
          "ระบบยังเปิด Apps Script API ในโปรเจกต์ Google Cloud ไม่ครบ — เปิดที่ Cloud Console แล้วลองใหม่ (ปกติผู้ใช้ทั่วไปไม่ต้องทำขั้นนี้)",
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
