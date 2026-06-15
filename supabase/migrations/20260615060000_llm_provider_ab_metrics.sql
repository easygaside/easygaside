-- A/B: which LLM a user is assigned to (null → default 'claude'); set by superadmin.
alter table egs_user_settings add column if not exists llm_provider text
  check (llm_provider in ('claude','chatgpt','deepseek'));

-- A project is locked to the provider it was first generated with (history format differs per provider).
alter table egs_projects add column if not exists llm_provider text;

-- Per-generation metrics for the experiment. Admin reads via service role.
create table if not exists egs_generations (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references egs_projects(id) on delete set null,
  user_id       uuid references auth.users(id) on delete set null,
  provider      text not null,
  model         text,
  input_tokens  int not null default 0,
  output_tokens int not null default 0,
  critic_issues int not null default 0,
  duration_ms   int,
  outcome       text,            -- 'ok' | 'error'
  rating        smallint,        -- 1 = up, -1 = down
  created_at    timestamptz not null default now()
);
create index if not exists egs_generations_provider_idx on egs_generations(provider, created_at desc);
create index if not exists egs_generations_user_idx on egs_generations(user_id);

alter table egs_generations enable row level security;
create policy "egs_generations insert own" on egs_generations
  for insert with check (user_id = auth.uid());
create policy "egs_generations rate own" on egs_generations
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
