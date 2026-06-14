-- Closed-beta allowlist. Checked server-side via the service role; clients never read it
-- (no policies → RLS denies anon/auth, service role bypasses).
create table if not exists egs_beta_allowlist (
  email      text primary key,
  note       text,
  created_at timestamptz not null default now()
);
alter table egs_beta_allowlist enable row level security;

-- Per-user daily generation counter — the cost guardrail for the default (platform-key) path.
create table if not exists egs_usage_daily (
  user_id  uuid not null references auth.users(id) on delete cascade,
  day      date not null default current_date,
  requests int  not null default 0,
  primary key (user_id, day)
);
alter table egs_usage_daily enable row level security;
create policy "egs_usage_daily owner read" on egs_usage_daily
  for select using (user_id = auth.uid());
-- increments happen via the service role only.

-- Optional BYOK: per-user Anthropic API key, AES-256-GCM encrypted at rest (same scheme as the
-- Google refresh token). No client policies — written/read only via service-role server actions,
-- so the key never reaches the browser.
create table if not exists egs_user_settings (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  anthropic_key_enc  text,
  anthropic_key_iv   text,
  anthropic_key_tag  text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table egs_user_settings enable row level security;

-- seed the owner so beta gating never locks them out
insert into egs_beta_allowlist (email, note) values ('kpcrmv4@gmail.com', 'owner')
on conflict (email) do nothing;
