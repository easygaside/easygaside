/**
 * Pure provider catalog — types, the provider list, and static per-provider config. NO server-only
 * imports (crypto / supabase / beta) live here, so client components can safely import LLM_PROVIDERS
 * and the LlmProvider type without dragging node:crypto into the browser bundle. The server-only
 * routing/resolution helpers live in ./provider.ts (which re-exports everything here).
 */

export type LlmProvider = "claude" | "chatgpt" | "deepseek" | "deepseek-pro" | "gemini" | "zai";
export type LlmFamily = "anthropic" | "openai";

export const LLM_PROVIDERS: LlmProvider[] = ["claude", "chatgpt", "deepseek", "deepseek-pro", "gemini", "zai"];
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
    case "deepseek-pro":
      // DeepSeek V4 Pro — stronger/pricier variant (deepseek=flash). Same DeepSeek key + endpoint.
      return {
        provider: "deepseek-pro",
        family: "openai",
        label: "DeepSeek V4 Pro",
        model: "deepseek-v4-pro",
        baseURL: "https://api.deepseek.com",
        apiKey: process.env.DEEPSEEK_API_KEY,
      };
    case "gemini":
      return {
        provider: "gemini",
        family: "openai",
        label: "Gemini",
        model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
        apiKey: process.env.GEMINI_API_KEY,
      };
    case "zai":
      // z.ai (Zhipu GLM) — OpenAI-format chat/completions at /paas/v4 (Bearer ZAI_API_KEY). A coding-
      // optimised variant lives at /api/coding/paas/v4 — swap baseURL if you want that one.
      return {
        provider: "zai",
        family: "openai",
        label: "GLM (z.ai)",
        model: process.env.ZAI_MODEL ?? "glm-4.6",
        baseURL: "https://api.z.ai/api/paas/v4",
        apiKey: process.env.ZAI_API_KEY,
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
