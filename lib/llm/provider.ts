import { hasOwnApiKey } from "@/lib/beta";
import {
  DEFAULT_PROVIDER,
  LLM_PROVIDERS,
  providerConfig,
  type LlmProvider,
  type ProviderConfig,
} from "@/lib/llm/catalog";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * LLM provider routing for the A/B experiment. A user is assigned an "arm" (claude/chatgpt/deepseek)
 * by the superadmin; a project locks to the arm it was first generated with (history format differs
 * per family). API keys live in env (per the chosen setup). ChatGPT + DeepSeek share the OpenAI
 * wire format (DeepSeek via baseURL override); Claude uses the Anthropic format.
 *
 * The pure catalog (types, LLM_PROVIDERS, providerConfig) lives in ./catalog and is re-exported here
 * so existing importers keep working; client components should import from ./catalog directly to
 * avoid pulling these server-only helpers (and node:crypto via beta) into the browser bundle.
 */

export {
  DEFAULT_PROVIDER,
  LLM_PROVIDERS,
  providerConfig,
  type LlmFamily,
  type LlmProvider,
  type ProviderConfig,
} from "@/lib/llm/catalog";

/** System-wide default provider (superadmin-set in egs_app_settings; falls back to claude). */
export async function getDefaultProvider(): Promise<LlmProvider> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("egs_app_settings")
    .select("value")
    .eq("key", "default_provider")
    .maybeSingle<{ value: string }>();
  const v = data?.value as LlmProvider | undefined;
  return v && LLM_PROVIDERS.includes(v) ? v : DEFAULT_PROVIDER;
}

/** Superadmin-set model name for a provider (egs_provider_config); falls back to the static default. */
export async function getProviderModel(p: LlmProvider): Promise<string> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("egs_provider_config")
    .select("model")
    .eq("provider", p)
    .maybeSingle<{ model: string }>();
  return data?.model?.trim() || providerConfig(p).model;
}

/**
 * Full config with the model name + base URL resolved from DB (use this on the request path).
 * Precedence: DB (egs_provider_config) → env/static default in catalog. Empty DB values fall through.
 */
export async function resolveProvider(p: LlmProvider): Promise<ProviderConfig> {
  const base = providerConfig(p);
  const svc = createServiceClient();
  const { data } = await svc
    .from("egs_provider_config")
    .select("model, base_url")
    .eq("provider", p)
    .maybeSingle<{ model: string | null; base_url: string | null }>();
  return {
    ...base,
    model: data?.model?.trim() || base.model,
    baseURL: data?.base_url?.trim() || base.baseURL,
  };
}

/** The user's assigned arm, or the system default when unassigned. */
export async function getUserProvider(userId: string): Promise<LlmProvider> {
  // BYOK (own Anthropic key) → lock to Claude so EVERYTHING (codegen + critic) runs on the user's
  // own quota. Their key is Anthropic-only, and the critic is Claude — one key covers it all.
  if (await hasOwnApiKey(userId)) return "claude";
  const svc = createServiceClient();
  const { data } = await svc
    .from("egs_user_settings")
    .select("llm_provider")
    .eq("user_id", userId)
    .maybeSingle<{ llm_provider: LlmProvider | null }>();
  return data?.llm_provider ?? (await getDefaultProvider());
}

/**
 * Resolve the provider for a project, locking it on first use: once a project has generated with a
 * provider, it stays on it (its stored history is in that provider's wire format).
 */
export async function resolveProjectProvider(
  projectId: string,
  userId: string,
): Promise<LlmProvider> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("egs_projects")
    .select("llm_provider")
    .eq("id", projectId)
    .maybeSingle<{ llm_provider: LlmProvider | null }>();
  if (data?.llm_provider) return data.llm_provider;

  const arm = await getUserProvider(userId);
  await svc.from("egs_projects").update({ llm_provider: arm }).eq("id", projectId);
  return arm;
}
