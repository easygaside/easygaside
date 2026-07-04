-- Web Push subscriptions + in-database admin registry (PWA push notifications).
-- Both tables are platform-internal: RLS enabled with NO policies => service-role only
-- (same pattern as egs_known_issues); all reads/writes go through API routes / server actions.

create table if not exists public.egs_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
comment on table public.egs_push_subscriptions is
  'Web Push (VAPID) subscriptions per user/device. Service-role only; dead endpoints (410/404) pruned after each send.';
create index if not exists egs_push_subscriptions_user_idx
  on public.egs_push_subscriptions (user_id);
alter table public.egs_push_subscriptions enable row level security;

-- Superadmins mirrored from the SUPERADMIN_EMAILS env allowlist (upserted whenever /admin loads).
-- Kept in-database so Realtime authorization policies (live chat) can check admin membership.
create table if not exists public.egs_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);
comment on table public.egs_admins is
  'Mirror of the env superadmin allowlist (source of truth = SUPERADMIN_EMAILS). Used by is_egs_admin() in Realtime RLS.';
alter table public.egs_admins enable row level security;

create or replace function public.is_egs_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.egs_admins where user_id = auth.uid());
$$;
