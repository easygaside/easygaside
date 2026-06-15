-- Per-user fixed-window burst limiter (SECURITY-TODO H-2 burst part). Service-role only.
create table if not exists egs_rate_limit (
  user_id           uuid not null references auth.users(id) on delete cascade,
  bucket            text not null,            -- 'agent' | 'deploy'
  window_started_at timestamptz not null default now(),
  count             int not null default 0,
  primary key (user_id, bucket)
);
alter table egs_rate_limit enable row level security;
