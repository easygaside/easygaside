import { createServiceClient } from "@/lib/supabase/service";

/**
 * Generic key/value access for egs_app_settings — the superadmin-editable system tunables
 * (default provider, daily cap, monthly tool cap, energy tank, beta toggle…). Server-only:
 * RLS denies clients, all reads/writes go through the service role.
 */

export async function getAppSetting(key: string): Promise<string | null> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("egs_app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle<{ value: string }>();
  return data?.value ?? null;
}

export async function setAppSetting(key: string, value: string): Promise<void> {
  const svc = createServiceClient();
  const { error } = await svc
    .from("egs_app_settings")
    .upsert({ key, value }, { onConflict: "key" });
  if (error) throw new Error(`setAppSetting(${key}): ${error.message}`);
}

/** Positive-integer setting; falls back when missing or unparseable. */
export async function getNumberSetting(key: string, fallback: number): Promise<number> {
  const n = Number(await getAppSetting(key));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Boolean setting ('on'/'true'/'1' = true). Falls back when the key is absent. */
export async function getBoolSetting(key: string, fallback: boolean): Promise<boolean> {
  const v = await getAppSetting(key);
  if (v === null) return fallback;
  return v === "on" || v === "true" || v === "1";
}
