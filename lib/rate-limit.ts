import { createServiceClient } from "@/lib/supabase/service";

/**
 * Per-user fixed-window burst limiter (SECURITY-TODO H-2). Backstop on top of the daily cap and the
 * per-project run lock — stops rapid-fire bursts (scripted abuse, retry storms). Best-effort: an
 * unexpected error fails OPEN (never blocks a user over a limiter glitch).
 */

export interface RateRule {
  bucket: string;
  max: number;
  windowMs: number;
}

export const AGENT_RATE: RateRule = { bucket: "agent", max: 20, windowMs: 60_000 };
export const DEPLOY_RATE: RateRule = { bucket: "deploy", max: 10, windowMs: 60_000 };

/** Returns true if the request is allowed (and counts it); false if the window is exhausted. */
export async function checkRateLimit(userId: string, rule: RateRule): Promise<boolean> {
  const svc = createServiceClient();
  const now = Date.now();
  try {
    const { data } = await svc
      .from("egs_rate_limit")
      .select("window_started_at, count")
      .eq("user_id", userId)
      .eq("bucket", rule.bucket)
      .maybeSingle<{ window_started_at: string; count: number }>();

    if (!data) {
      await svc
        .from("egs_rate_limit")
        .insert({ user_id: userId, bucket: rule.bucket, window_started_at: new Date(now).toISOString(), count: 1 });
      return true;
    }
    const elapsed = now - new Date(data.window_started_at).getTime();
    if (elapsed > rule.windowMs) {
      await svc
        .from("egs_rate_limit")
        .update({ window_started_at: new Date(now).toISOString(), count: 1 })
        .eq("user_id", userId)
        .eq("bucket", rule.bucket);
      return true;
    }
    if (data.count >= rule.max) return false;
    await svc
      .from("egs_rate_limit")
      .update({ count: data.count + 1 })
      .eq("user_id", userId)
      .eq("bucket", rule.bucket);
    return true;
  } catch (e) {
    console.error("[rate-limit] error (fail-open):", e);
    return true;
  }
}
