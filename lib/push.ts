import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Web Push sender (VAPID). Best-effort everywhere — like notifyTelegram, a missing
 * config or a failed send NEVER breaks the caller; the triggering action already
 * succeeded and is persisted in the DB. Dead endpoints (404/410 = the browser
 * dropped the subscription) are pruned after each send.
 */

export interface PushPayload {
  title: string;
  body: string;
  /** Path the notification opens on click (default /projects). */
  url?: string;
  /** Same tag → notifications collapse (e.g. one bubble per chat thread). */
  tag?: string;
  urgent?: boolean;
}

interface SubRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

let configured: boolean | null = null;
function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (configured = false); // not set up → silently skip
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:easygaside@gmail.com", pub, priv);
  return (configured = true);
}

async function sendToSubs(subs: SubRow[], payload: PushPayload): Promise<void> {
  if (!ensureConfigured() || subs.length === 0) return;
  const dead: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 24 },
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(s.endpoint);
        else console.error("[push] send failed (non-fatal):", status ?? err);
      }
    }),
  );
  if (dead.length > 0) {
    const svc = createServiceClient();
    await svc.from("egs_push_subscriptions").delete().in("endpoint", dead);
  }
}

/** Push to every device of one user (e.g. admin replied in live chat, plan approved). */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  try {
    if (!ensureConfigured()) return;
    const svc = createServiceClient();
    const { data } = await svc
      .from("egs_push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", userId);
    await sendToSubs((data ?? []) as SubRow[], payload);
  } catch (e) {
    console.error("[push] sendPushToUser failed (non-fatal):", e);
  }
}

/** Push to every device of every superadmin (new chat message / upgrade request / report). */
export async function sendPushToAdmins(payload: PushPayload): Promise<void> {
  try {
    if (!ensureConfigured()) return;
    const svc = createServiceClient();
    const { data: admins } = await svc.from("egs_admins").select("user_id");
    const ids = (admins ?? []).map((a) => (a as { user_id: string }).user_id);
    if (ids.length === 0) return;
    const { data } = await svc
      .from("egs_push_subscriptions")
      .select("endpoint, p256dh, auth")
      .in("user_id", ids);
    await sendToSubs((data ?? []) as SubRow[], payload);
  } catch (e) {
    console.error("[push] sendPushToAdmins failed (non-fatal):", e);
  }
}
