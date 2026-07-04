import { NextResponse } from "next/server";
import { markSupportRead } from "@/lib/support";
import { createClient } from "@/lib/supabase/server";

/** Mark admin replies in the caller's own thread as read (widget opened). */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  try {
    await markSupportRead(user.id, "user");
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[support] mark read failed:", e);
    return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  }
}
