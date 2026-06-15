-- Per-project concurrency guard for the agent loop (H-2). A row = a run in progress; the PK makes
-- "acquire" atomic. Service-role only (no client policies). Stale rows (crashed/timed-out runs) are
-- stolen after a timeout in code.
create table if not exists egs_agent_runs (
  project_id uuid primary key references egs_projects(id) on delete cascade,
  started_at timestamptz not null default now()
);
alter table egs_agent_runs enable row level security;
