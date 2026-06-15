"use server";

import { revalidatePath } from "next/cache";
import { isSuperAdmin } from "@/lib/admin";
import { LLM_PROVIDERS, type LlmProvider } from "@/lib/llm/provider";
import { getCurrentUser } from "@/lib/projects";
import { createServiceClient } from "@/lib/supabase/service";

async function requireSuperAdmin(): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !isSuperAdmin(user.email)) throw new Error("forbidden");
}

/** Assign one user to a provider arm. */
export async function setUserArmAction(userId: string, arm: LlmProvider): Promise<void> {
  await requireSuperAdmin();
  if (!LLM_PROVIDERS.includes(arm)) throw new Error("bad_provider");
  const svc = createServiceClient();
  const { error } = await svc
    .from("egs_user_settings")
    .upsert({ user_id: userId, llm_provider: arm }, { onConflict: "user_id" });
  if (error) throw new Error(`setUserArm: ${error.message}`);
  revalidatePath("/admin");
}

/** Evenly distribute ALL users across the 3 arms (round-robin) — for the 10/10/10 split. */
export async function autoBalanceArmsAction(): Promise<void> {
  await requireSuperAdmin();
  const svc = createServiceClient();
  const { data: list } = await svc.auth.admin.listUsers({ perPage: 1000 });
  const users = (list?.users ?? []).slice().sort((a, b) => a.id.localeCompare(b.id));
  const rows = users.map((u, i) => ({
    user_id: u.id,
    llm_provider: LLM_PROVIDERS[i % LLM_PROVIDERS.length],
  }));
  if (rows.length === 0) return;
  const { error } = await svc.from("egs_user_settings").upsert(rows, { onConflict: "user_id" });
  if (error) throw new Error(`autoBalance: ${error.message}`);
  revalidatePath("/admin");
}
