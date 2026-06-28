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

/**
 * Admin endpoint presets per provider — so the operator switches the base URL by PICKING from a
 * dropdown, not typing. url:"" = clear the override (fall back to env/static default in providerConfig).
 * Only providers listed here show the endpoint selector in /admin.
 */
export const BASE_URL_PRESETS: Partial<Record<LlmProvider, { label: string; url: string }[]>> = {
  zai: [
    { label: "ค่าเริ่มต้น · standalone API (ปลอดภัยเชิงพาณิชย์)", url: "" },
    { label: "Coding Plan · /api/coding (เสี่ยง ToS)", url: "https://api.z.ai/api/coding/paas/v4" },
  ],
};

export interface ProviderConfig {
  provider: LlmProvider;
  family: LlmFamily;
  label: string;
  model: string;
  baseURL?: string; // openai family only
  apiKey: string | undefined; // from env
  /**
   * Max output tokens per single API call (the model's real ceiling). This is NOT the energy tank
   * (a cumulative per-project budget) — it bounds one completion. Set per arm to the model's limit:
   * a big build that exceeds it caps mid-write and the loop auto-continues. gpt-4o tops out ~16K;
   * DeepSeek V4 (flash/pro) allows up to 384K; Claude ≥64K.
   */
  maxOutputTokens: number;
  /**
   * Thinking/reasoning model (DeepSeek V4 Pro). These 400 if `tool_choice` is sent, and stream a
   * separate `reasoning_content` that must be preserved on assistant messages in multi-turn tool
   * histories — the openai loop branches on this flag.
   */
  reasoning?: boolean;
  /** Vision-capable (accepts image input). Text-only arms (DeepSeek / GLM) must NOT be sent image parts. */
  vision?: boolean;
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
        maxOutputTokens: 16000, // gpt-4o hard ceiling ≈ 16,384
        vision: true,
      };
    case "deepseek":
      // deepseek-chat (V3) is the GA id today and supports tool-calls + json mode (what our codegen +
      // critic need). NOTE: deepseek-chat/deepseek-reasoner are slated to deprecate 2026-07-24 —
      // confirm DeepSeek's actual GA replacement id (their docs name deepseek-v4-flash, UNVERIFIED on
      // the live API) and update this + the DB before then. 8K output ceiling.
      return {
        provider: "deepseek",
        family: "openai",
        label: "DeepSeek",
        model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
        baseURL: "https://api.deepseek.com",
        apiKey: process.env.DEEPSEEK_API_KEY,
        maxOutputTokens: 8000,
      };
    case "deepseek-pro":
      // DeepSeek V4 Pro — stronger/pricier variant (deepseek=flash). Same DeepSeek key + endpoint.
      // 384K output ceiling; use a generous per-call cap so big builds finish in one turn.
      return {
        provider: "deepseek-pro",
        family: "openai",
        label: "DeepSeek V4 Pro",
        model: "deepseek-v4-pro",
        baseURL: "https://api.deepseek.com",
        apiKey: process.env.DEEPSEEK_API_KEY,
        maxOutputTokens: 64000,
        reasoning: true, // V4 Pro thinking model: omit tool_choice + preserve reasoning_content
      };
    case "gemini":
      return {
        provider: "gemini",
        family: "openai",
        label: "Gemini",
        model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
        apiKey: process.env.GEMINI_API_KEY,
        maxOutputTokens: 16000,
        vision: true,
      };
    case "zai":
      // z.ai (Zhipu GLM) — OpenAI-format chat/completions. ZAI_BASE_URL is env so we can swap the
      // endpoint without a code change:
      //   - https://api.z.ai/api/paas/v4         = standalone API (pay-as-you-go) — commercial/SaaS-safe (default)
      //   - https://api.z.ai/api/coding/paas/v4  = Coding Plan subscription endpoint — NOTE: that plan
      //     forbids "custom integrations / SDK-based access" (only supported coding tools); use the
      //     standalone API for this product. See docs/CRITIC-FINDINGS.md / MONETIZATION notes.
      return {
        provider: "zai",
        family: "openai",
        label: "GLM (z.ai)",
        model: process.env.ZAI_MODEL ?? "glm-4.6",
        baseURL: process.env.ZAI_BASE_URL ?? "https://api.z.ai/api/paas/v4",
        apiKey: process.env.ZAI_API_KEY,
        maxOutputTokens: 16000,
      };
    default:
      return {
        provider: "claude",
        family: "anthropic",
        label: "Claude",
        model: "claude-sonnet-4-6",
        apiKey: process.env.ANTHROPIC_API_KEY,
        maxOutputTokens: 32000, // sonnet-4-6 handles ≥64K; the anthropic loop uses its own const too
        vision: true,
      };
  }
}
