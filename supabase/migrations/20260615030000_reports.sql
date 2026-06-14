-- User-submitted problem reports. Clients can only INSERT their own; admin reads via service role.
create table if not exists egs_reports (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null,
  project_id uuid references egs_projects(id) on delete set null,
  kind       text not null default 'bug' check (kind in ('bug','idea','other')),
  message    text not null,
  url        text,
  status     text not null default 'open',
  created_at timestamptz not null default now()
);

create index if not exists egs_reports_created_idx on egs_reports(created_at desc);

alter table egs_reports enable row level security;
create policy "egs_reports insert own" on egs_reports
  for insert with check (user_id = auth.uid());
-- no select policy → only the service role (admin) can read reports.
