import { createServiceClient } from "@/lib/supabase/service";

/**
 * Live support chat (paid user <-> admin). egs_support_messages is service-role
 * only; these helpers are called from API routes that already gated the caller
 * (paid plan on the user side / superadmin on the admin side). Realtime delivery
 * happens in the DB: an AFTER INSERT trigger broadcasts to the private topic
 * `support:{user_id}` (+ `support:admin-lobby` for user messages).
 */

export interface SupportMessage {
  id: string;
  user_id: string;
  sender: "user" | "admin";
  body: string;
  project_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface SupportThread {
  userId: string;
  email: string | null;
  lastBody: string;
  lastSender: "user" | "admin";
  lastAt: string;
  unread: number; // user messages the admin hasn't read yet
}

export const SUPPORT_MAX_BODY = 4000;
const HISTORY_LIMIT = 200;

/** Message history for one thread, oldest → newest. */
export async function listSupportMessages(userId: string): Promise<SupportMessage[]> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("egs_support_messages")
    .select("id, user_id, sender, body, project_id, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) throw new Error(`listSupportMessages: ${error.message}`);
  return ((data ?? []) as SupportMessage[]).reverse();
}

export async function insertSupportMessage(input: {
  userId: string;
  sender: "user" | "admin";
  body: string;
  email?: string | null;
  projectId?: string | null;
}): Promise<SupportMessage> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("egs_support_messages")
    .insert({
      user_id: input.userId,
      sender: input.sender,
      body: input.body,
      email: input.email ?? null,
      project_id: input.projectId ?? null,
    })
    .select("id, user_id, sender, body, project_id, read_at, created_at")
    .single<SupportMessage>();
  if (error || !data) throw new Error(`insertSupportMessage: ${error?.message ?? "no row"}`);
  return data;
}

/** Mark everything the given side has now read (i.e. messages from the OTHER side). */
export async function markSupportRead(userId: string, reader: "user" | "admin"): Promise<void> {
  const svc = createServiceClient();
  const from = reader === "user" ? "admin" : "user";
  const { error } = await svc
    .from("egs_support_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("sender", from)
    .is("read_at", null);
  if (error) throw new Error(`markSupportRead: ${error.message}`);
}

/**
 * Admin inbox: one row per customer thread with last message + unread count.
 * Aggregated in JS over the most recent rows — fine at beta scale (a few dozen
 * threads); switch to a SQL function if threads grow past that.
 */
export async function listSupportThreads(): Promise<SupportThread[]> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("egs_support_messages")
    .select("user_id, sender, body, email, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(`listSupportThreads: ${error.message}`);

  const threads = new Map<string, SupportThread>();
  for (const raw of data ?? []) {
    const m = raw as {
      user_id: string;
      sender: "user" | "admin";
      body: string;
      email: string | null;
      read_at: string | null;
      created_at: string;
    };
    let t = threads.get(m.user_id);
    if (!t) {
      // rows arrive newest-first, so the first row per user IS the last message
      t = {
        userId: m.user_id,
        email: null,
        lastBody: m.body,
        lastSender: m.sender,
        lastAt: m.created_at,
        unread: 0,
      };
      threads.set(m.user_id, t);
    }
    if (!t.email && m.sender === "user" && m.email) t.email = m.email;
    if (m.sender === "user" && !m.read_at) t.unread += 1;
  }
  return [...threads.values()].sort((a, b) => {
    if ((a.unread > 0) !== (b.unread > 0)) return a.unread > 0 ? -1 : 1;
    return a.lastAt < b.lastAt ? 1 : -1;
  });
}
