import { createServiceClient } from "@/lib/supabase/service";

/**
 * LLM provider routing for the A/B experiment. A user is assigned an "arm" (claude/chatgpt/deepseek)
 * by the superadmin; a project locks to the arm it was first generated with (history format differs
 * per family). API keys live in env (per the chosen setup). ChatGPT + DeepSeek share the OpenAI
 * wire format (DeepSeek via baseURL override); Claude uses the Anthropic format.
 */

export type LlmProvider = "claude" | "chatgpt" | "deepseek";
export type LlmFamily = "anthropic" | "openai";

export const LLM_PROVIDERS: LlmProvider[] = ["claude", "chatgpt", "deepseek"];
export const DEFAULT_PROVIDER: LlmProvider = "claude";

export interface ProviderConfig {
  provider: LlmProvider;
  family: LlmFamily;
  label: string;
  model: string;
  baseURL?: string; // openai family only
  apiKey: string | undefined; // from env
}

export function providerConfig(p: LlmProvider): ProviderConfig {
  switch (p) {
    case "chatgpt":
      return {
        provider: "chatgpt",
        family: "openai",
        label: "ChatGPT",
        model: process.env.OPENAI_MODEL ?? "gpt-4o",
        apiKey: process.env.OPENAI_API_KEY,
      };
    case "deepseek":
      return {
        provider: "deepseek",
        family: "openai",
        label: "DeepSeek",
        model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
        baseURL: "https://api.deepseek.com",
        apiKey: process.env.DEEPSEEK_API_KEY,
      };
    default:
      return {
        provider: "claude",
        family: "anthropic",
        label: "Claude",
        model: "claude-sonnet-4-6",
        apiKey: process.env.ANTHROPIC_API_KEY,
      };
  }
}

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

/** Full config with the model name resolved from DB (use this on the request path). */
export async function resolveProvider(p: LlmProvider): Promise<ProviderConfig> {
  return { ...providerConfig(p), model: await getProviderModel(p) };
}

/** The user's assigned arm, or the system default when unassigned. */
export async function getUserProvider(userId: string): Promise<LlmProvider> {
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
