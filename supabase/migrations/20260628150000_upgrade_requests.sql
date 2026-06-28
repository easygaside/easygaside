-- Upgrade requests (PromptPay slip → founder approves in /admin → plan set).
-- See app/pricing/actions.ts (submit) + app/admin/actions.ts (approve/reject) + MONETIZATION.md §7.

create table if not exists public.egs_upgrade_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id),
  email       text,
  plan        text not null check (plan in ('lite','starter','pro')),
  amount_thb  numeric not null check (amount_thb >= 0),
  slip_path   text not null,
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  note        text,
  created_at  timestamptz not null default now(),
  decided_at  timestamptz
);

alter table public.egs_upgrade_requests enable row level security;

-- owner may read their OWN requests (to see status); inserts + approve/reject go through service-role.
create policy "own upgrade requests" on public.egs_upgrade_requests
  for select using (user_id = auth.uid());

-- private bucket for PromptPay slips (admin views via service-role signed URLs only)
insert into storage.buckets (id, name, public) values ('egs-slips', 'egs-slips', false)
on conflict (id) do nothing;
