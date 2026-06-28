-- Admin-editable per-PAID-plan limits (monthly token pool + new-tools/month). Free tier keeps its own
-- knobs in egs_app_settings (free_monthly_pool / monthly_tool_limit). Read by lib/plan.ts getPlanLimits,
-- falling back to PLAN_CONFIG when a row is absent. RLS on + no policy => service-role only.

create table if not exists public.egs_plan_config (
  plan  text primary key check (plan in ('lite','starter','pro')),
  pool  bigint not null,   -- monthly token pool (= pool/10000 แต้ม)
  tools int not null       -- new tools / month
);

insert into public.egs_plan_config (plan, pool, tools) values
  ('lite',    1500000, 3),
  ('starter', 2500000, 5),
  ('pro',     6000000, 15)
on conflict (plan) do nothing;

alter table public.egs_plan_config enable row level security;

comment on table public.egs_plan_config is
  'Admin-editable per-PAID-plan limits (pool tokens + new-tools/month). Free tier stays in egs_app_settings. Falls back to lib/plan.ts PLAN_CONFIG when a row is absent.';
