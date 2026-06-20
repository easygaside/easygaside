-- Make every operational tunable editable from /admin (no redeploy, no env edits).
-- API keys stay in env; everything else lives in egs_app_settings / egs_provider_config.

-- 1) The original CHECK only allowed claude/chatgpt/deepseek, so model/tank for the newer arms
--    (deepseek-pro, gemini, zai) could never be stored. Drop it — provider is validated in code.
alter table egs_provider_config drop constraint if exists egs_provider_config_provider_check;

-- 2) Per-arm energy tank (tokens). Backfill from the old hardcoded TANK_BY_PROVIDER, then seed
--    rows for any arm that doesn't exist yet so admin upserts have a row to update.
alter table egs_provider_config add column if not exists energy_tank bigint;
update egs_provider_config set energy_tank = 400000
  where provider in ('claude', 'chatgpt') and energy_tank is null;
update egs_provider_config set energy_tank = 1000000
  where provider in ('deepseek', 'deepseek-pro', 'gemini', 'zai') and energy_tank is null;

insert into egs_provider_config (provider, model, energy_tank) values
  ('deepseek-pro', 'deepseek-v4-pro', 1000000),
  ('gemini', 'gemini-2.5-flash', 1000000),
  ('zai', 'glm-4.6', 1000000)
on conflict (provider) do nothing;

-- 3) Global tunables (key/value). Seed the current code defaults so behaviour is unchanged.
insert into egs_app_settings (key, value) values
  ('monthly_tool_limit', '2'),      -- NEW tools (projects) a Free user may create per month
  ('energy_tank_default', '400000'), -- fallback tank when an arm has no explicit energy_tank
  ('beta_enforced', 'on')            -- 'on' = closed beta (allowlist); 'off' = open to everyone
on conflict (key) do nothing;
