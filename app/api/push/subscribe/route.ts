import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Store / remove the caller's Web Push subscription. egs_push_subscriptions is
 * service-role-only (RLS with no policies), so writes go through here with the
 * user resolved from the session — the client never picks its own user_id.
 */

interface SubscriptionBody {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  let body: SubscriptionBody;
  try {
    body = (await req.json()) as SubscriptionBody;
  } catch {
    return NextResponse.json({ error: "BAD_JSON" }, { status: 400 });
  }
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const auth = typeof body.keys?.auth === "string" ? body.keys.auth : "";
  if (!endpoint.startsWith("https://") || !p256dh || !auth)
    return NextResponse.json({ error: "BAD_SUBSCRIPTION" }, { status: 400 });

  const svc = createServiceClient();
  // Upsert on endpoint: the same device re-subscribing (or a different account on
  // this browser) simply re-binds the endpoint to the current user.
  const { error } = await svc.from("egs_push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );
  if (error) {
    console.error("[push/subscribe] upsert failed:", error);
    return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  let body: { endpoint?: string };
  try {
    body = (await req.json()) as { endpoint?: string };
  } catch {
    return NextResponse.json({ error: "BAD_JSON" }, { status: 400 });
  }
  if (!body.endpoint) return NextResponse.json({ error: "BAD_SUBSCRIPTION" }, { status: 400 });

  const svc = createServiceClient();
  // Scoped to the caller: you can only remove your own device rows.
  await svc
    .from("egs_push_subscriptions")
    .delete()
    .eq("endpoint", body.endpoint)
    .eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
