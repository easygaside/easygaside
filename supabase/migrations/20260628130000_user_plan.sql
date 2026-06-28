-- Billing plan per user. free = DeepSeek arm + free pool/limits; lite/starter/pro = paid (GLM arm +
-- bigger pool/limits). The founder sets it in /admin after approving a PromptPay slip
-- (egs_upgrade_requests). See lib/plan.ts (PLAN_CONFIG) + MONETIZATION.md §3.

alter table public.egs_user_settings
  add column if not exists plan text not null default 'free'
  check (plan in ('free','lite','starter','pro'));

comment on column public.egs_user_settings.plan is
  'Billing plan. free = DeepSeek arm + free pool/limits; lite/starter/pro = paid (GLM arm + bigger pool/limits). Set by the founder in /admin after a PromptPay slip is approved (egs_upgrade_requests).';
