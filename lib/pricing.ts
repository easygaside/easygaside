/**
 * LLM cost model for the /admin finance page. USD per 1M tokens, per model. DeepSeek figures are the
 * official api-docs.deepseek.com/quick_start/pricing values (2026); the other arms are list-price
 * estimates — update here when they change. Costs are an ESTIMATE: a generation's logged `model` is
 * the codegen model, so the (small) critic/vision-proxy spend on another model is approximated at the
 * codegen rate. Good enough for COGS tracking; tighten later if needed.
 */

export interface ModelPrice {
  input: number; // cache-miss input, USD / 1M
  output: number; // USD / 1M
  cacheRead: number; // cache-hit input, USD / 1M
  cacheWrite: number; // cache-write (Anthropic), USD / 1M
}

export const PRICING: Record<string, ModelPrice> = {
  // DeepSeek — official
  "deepseek-v4-pro": { input: 0.435, output: 0.87, cacheRead: 0.003625, cacheWrite: 0.435 },
  "deepseek-v4-flash": { input: 0.14, output: 0.28, cacheRead: 0.0028, cacheWrite: 0.14 },
  "deepseek-chat": { input: 0.14, output: 0.28, cacheRead: 0.0028, cacheWrite: 0.14 }, // → v4-flash
  "deepseek-reasoner": { input: 0.55, output: 2.19, cacheRead: 0.14, cacheWrite: 0.55 }, // estimate
  // Anthropic — list price
  "claude-sonnet-4-6": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
  // OpenAI / Google / z.ai — estimates
  "gpt-4o": { input: 2.5, output: 10, cacheRead: 1.25, cacheWrite: 2.5 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5, cacheRead: 0.075, cacheWrite: 0.3 },
  "glm-4.6": { input: 0.6, output: 2.2, cacheRead: 0.6, cacheWrite: 0.6 },
  "glm-5.2": { input: 1.4, output: 4.4, cacheRead: 0.26, cacheWrite: 0.26 }, // z.ai list (cache-write n/a — openai-format logs 0)
};

const FALLBACK: ModelPrice = { input: 1, output: 3, cacheRead: 0.5, cacheWrite: 1 };

export function priceFor(model: string | null | undefined): ModelPrice {
  return (model && PRICING[model]) || FALLBACK;
}

export interface GenTokens {
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
}

/** Estimated USD cost of one logged generation. */
export function genCostUsd(g: GenTokens): number {
  const p = priceFor(g.model);
  return (
    (g.input_tokens * p.input +
      g.output_tokens * p.output +
      g.cache_read_tokens * p.cacheRead +
      g.cache_creation_tokens * p.cacheWrite) /
    1_000_000
  );
}

/** Fallback USD→THB rate when egs_app_settings.usd_thb_rate is unset. */
export const DEFAULT_USD_THB = 36.5;
