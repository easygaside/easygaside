-- Two more schema drifts found in the full audit:

-- 1) egs_file_versions — lib/versions.ts snapshots the whole file set on every ai/manual/deploy/
--    restore event and the IDE's VersionHistory reads it, but the table was never created. So every
--    snapshot failed silently ("non-fatal") and version history / rollback was entirely dead. Create it.
create table if not exists egs_file_versions (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references egs_projects(id) on delete cascade,
  source     text not null default 'ai' check (source in ('ai', 'manual', 'deploy', 'restore')),
  label      text,
  files      jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists egs_file_versions_project_idx
  on egs_file_versions(project_id, created_at desc);
alter table egs_file_versions enable row level security;
create policy "egs_file_versions owner" on egs_file_versions
  for all using (
    project_id in (select id from egs_projects where owner_id = auth.uid())
  ) with check (
    project_id in (select id from egs_projects where owner_id = auth.uid())
  );

-- 2) egs_user_settings.llm_provider CHECK was stuck at claude/chatgpt/deepseek/gemini, so assigning a
--    user to the newer deepseek-pro / zai arms (in LLM_PROVIDERS) violated it. Drop it — the arm is
--    validated in code (setUserArmAction against LLM_PROVIDERS), same as egs_provider_config.
alter table egs_user_settings drop constraint if exists egs_user_settings_llm_provider_check;
