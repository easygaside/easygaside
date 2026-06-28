-- Per-provider API base URL override (egs_provider_config.base_url).
-- OpenAI-family arms (deepseek / chatgpt / gemini / zai) build their client with this baseURL.
-- Empty/null = fall back to the env (e.g. ZAI_BASE_URL) then the static default in lib/llm/catalog.ts.
-- Lets a superadmin swap an endpoint (e.g. z.ai standalone /api/paas/v4 vs coding /api/coding/paas/v4)
-- straight from /admin without an env change or redeploy.

alter table public.egs_provider_config add column if not exists base_url text;

comment on column public.egs_provider_config.base_url is
  'Optional per-provider API base URL override (OpenAI-family arms). Empty/null = use the env/static default. Lets a superadmin swap e.g. z.ai standalone vs coding endpoint from /admin without a deploy.';
